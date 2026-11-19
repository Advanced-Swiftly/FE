import XCTest
@testable import PawFit

/// 응답을 미리 정해 두는 가짜 전송
final class StubTransport: HTTPTransport, @unchecked Sendable {
    struct Reply { let status: Int; let body: String }
    private let lock = NSLock()
    private var replies: [String: [Reply]] = [:]   // path → 차례대로 돌려줄 응답
    private(set) var requests: [URLRequest] = []

    func enqueue(_ path: String, status: Int, body: String) {
        lock.withLock { replies[path, default: []].append(Reply(status: status, body: body)) }
    }

    func send(_ request: URLRequest) async throws -> (Data, HTTPURLResponse) {
        let reply: Reply? = lock.withLock {
            requests.append(request)
            let path = request.url!.path.replacingOccurrences(of: "/api/v1", with: "")
            guard var queue = replies[path], !queue.isEmpty else { return nil }
            let first = queue.removeFirst()
            replies[path] = queue
            return first
        }
        guard let reply else { throw URLError(.notConnectedToInternet) }
        let response = HTTPURLResponse(url: request.url!, statusCode: reply.status, httpVersion: nil, headerFields: nil)!
        return (Data(reply.body.utf8), response)
    }
}

/// 요청의 토큰을 보고 답하는 가짜 서버 (동시 요청 테스트용)
final class TokenAwareTransport: HTTPTransport, @unchecked Sendable {
    private let lock = NSLock()
    private var _refreshCount = 0
    var refreshCount: Int { lock.withLock { _refreshCount } }

    func send(_ request: URLRequest) async throws -> (Data, HTTPURLResponse) {
        let path = request.url!.path
        let (status, body): (Int, String)
        if path.hasSuffix("/auth/token/refresh") {
            lock.withLock { _refreshCount += 1 }
            try await Task.sleep(for: .milliseconds(50))   // 갱신 중에 다른 요청이 401을 받도록
            (status, body) = (200, #"{"accessToken":"a2","refreshToken":"r2"}"#)
        } else if request.value(forHTTPHeaderField: "Authorization") == "Bearer a2" {
            (status, body) = (200, ServerSample.me)
        } else {
            (status, body) = (401, ServerSample.error(401, "AUTH_001"))
        }
        let response = HTTPURLResponse(url: request.url!, statusCode: status, httpVersion: nil, headerFields: nil)!
        return (Data(body.utf8), response)
    }
}

/// 백엔드 응답 예시 — BE 저장소의 DTO · ApiErrorResponse 모양 그대로
enum ServerSample {
    static let login = """
    {"user":{"userId":1,"role":"GUARDIAN","name":"이채린"},"accessToken":"a1","refreshToken":"r1"}
    """
    static let businessLogin = """
    {"user":{"userId":7,"role":"BUSINESS","name":"업체"},"accessToken":"b1","refreshToken":"br1"}
    """
    static let me = """
    {"userId":1,"role":"GUARDIAN","name":"이채린","phoneNumber":"01012345678"}
    """
    static func error(_ status: Int, _ code: String, fields: String = "{}") -> String {
        """
        {"timestamp":"2026-11-12T01:00:00Z","status":\(status),"code":"\(code)","message":"요청을 처리할 수 없습니다.","path":"/api/v1/x","requestId":"req-1","fieldErrors":\(fields)}
        """
    }
}

final class APIClientTests: XCTestCase {
    private let base = URL(string: "https://test.local/api/v1")!

    func test_로그인_성공하면_토큰을_저장하고_phoneNumber로_보낸다() async throws {
        let transport = StubTransport()
        transport.enqueue("/auth/login", status: 200, body: ServerSample.login)
        let store = InMemoryTokenStore()
        let service = LiveAuthService(api: APIClient(baseURL: base, transport: transport, tokenStore: store), tokenStore: store)

        let user = try await service.login(phone: "010-1234-5678", password: "pawfit!123")

        XCTAssertEqual(user, UserSummary(userId: 1, role: .guardian, name: "이채린"))
        XCTAssertEqual(store.load(), AuthTokens(accessToken: "a1", refreshToken: "r1"))
        let sent = try JSONSerialization.jsonObject(with: transport.requests[0].httpBody!) as! [String: Any]
        XCTAssertEqual(sent["phoneNumber"] as? String, "01012345678")
        XCTAssertNil(sent["deviceToken"])                       // 아직 알림 토큰은 보내지 않음
        XCTAssertNil(transport.requests[0].value(forHTTPHeaderField: "Authorization"))
    }

    func test_보호자가_아닌_계정은_토큰을_저장하지_않는다() async {
        let transport = StubTransport()
        transport.enqueue("/auth/login", status: 200, body: ServerSample.businessLogin)
        transport.enqueue("/auth/logout", status: 200, body: #"{"success":true}"#)
        let store = InMemoryTokenStore()
        let expired = expectation(description: "세션 만료 알림이 오면 안 됨")
        expired.isInverted = true
        let client = APIClient(baseURL: base, transport: transport, tokenStore: store) { expired.fulfill() }
        let service = LiveAuthService(api: client, tokenStore: store)

        do {
            _ = try await service.login(phone: "01055555555", password: "x")
            XCTFail("오류가 나야 함")
        } catch {
            XCTAssertEqual(error as? APIError, .notGuardian)
        }
        XCTAssertNil(store.load())
        // 서버 로그아웃은 로그인이 필요하므로, 받은 액세스 토큰으로 바로 폐기한다
        let logout = try? XCTUnwrap(transport.requests.last)
        XCTAssertEqual(logout?.url?.path, "/api/v1/auth/logout")
        XCTAssertEqual(logout?.value(forHTTPHeaderField: "Authorization"), "Bearer b1")
        await fulfillment(of: [expired], timeout: 0.2)
    }

    func test_오류_응답의_code와_fieldErrors를_읽는다() async {
        let transport = StubTransport()
        transport.enqueue("/auth/login", status: 400, body: ServerSample.error(400, "COMMON_001", fields: #"{"phoneNumber":"올바른 휴대전화 번호 형식이어야 합니다."}"#))
        let client = APIClient(baseURL: base, transport: transport, tokenStore: InMemoryTokenStore())
        do {
            _ = try await client.send(AuthEndpoints.login(phone: "0101", password: "x"))
            XCTFail("오류가 나야 함")
        } catch {
            XCTAssertEqual(error as? APIError, .server(code: .validationError, status: 400, field: "phoneNumber"))
        }
    }

    func test_로그인_실패_문구() async {
        let transport = StubTransport()
        transport.enqueue("/auth/login", status: 401, body: ServerSample.error(401, "INVALID_CREDENTIALS"))
        let client = APIClient(baseURL: base, transport: transport, tokenStore: InMemoryTokenStore())
        do {
            _ = try await client.send(AuthEndpoints.login(phone: "01011112222", password: "x"))
            XCTFail("오류가 나야 함")
        } catch let error as APIError {
            XCTAssertEqual(error.code, .invalidCredentials)
            XCTAssertEqual(error.userMessage, "휴대폰 번호 또는 비밀번호가 맞지 않아요")
        } catch {
            XCTFail("APIError가 아님: \(error)")
        }
    }

    func test_AUTH_001이면_토큰을_갱신하고_한번_다시_요청한다() async throws {
        let transport = StubTransport()
        transport.enqueue("/users/me", status: 401, body: ServerSample.error(401, "AUTH_001"))
        transport.enqueue("/auth/token/refresh", status: 200, body: #"{"accessToken":"a2","refreshToken":"r2"}"#)
        transport.enqueue("/users/me", status: 200, body: ServerSample.me)
        let store = InMemoryTokenStore(AuthTokens(accessToken: "a1", refreshToken: "r1"))
        let client = APIClient(baseURL: base, transport: transport, tokenStore: store)

        let me = try await client.send(AuthEndpoints.me)

        XCTAssertEqual(PhoneRule.format(me.phoneNumber), "010-1234-5678")
        XCTAssertEqual(store.load()?.refreshToken, "r2")
        XCTAssertEqual(transport.requests.last?.value(forHTTPHeaderField: "Authorization"), "Bearer a2")
    }

    func test_리프레시_토큰도_만료면_토큰을_지우고_세션_만료를_알린다() async {
        let transport = StubTransport()
        transport.enqueue("/users/me", status: 401, body: ServerSample.error(401, "AUTH_001"))
        transport.enqueue("/auth/token/refresh", status: 401, body: ServerSample.error(401, "INVALID_REFRESH_TOKEN"))
        let store = InMemoryTokenStore(AuthTokens(accessToken: "a1", refreshToken: "r1"))
        let expired = expectation(description: "세션 만료 알림")
        let client = APIClient(baseURL: base, transport: transport, tokenStore: store) { expired.fulfill() }

        do {
            _ = try await client.send(AuthEndpoints.me)
            XCTFail("오류가 나야 함")
        } catch {
            XCTAssertEqual(error as? APIError, .sessionExpired)
        }
        await fulfillment(of: [expired], timeout: 1)
        XCTAssertNil(store.load())
    }

    func test_토큰_갱신이_연결_오류로_실패하면_토큰을_지우지_않는다() async {
        let transport = StubTransport()
        transport.enqueue("/users/me", status: 401, body: ServerSample.error(401, "AUTH_001"))
        // /auth/token/refresh 응답 없음 → 연결 오류 (서버가 잠에서 깨는 중 등)
        let store = InMemoryTokenStore(AuthTokens(accessToken: "a1", refreshToken: "r1"))
        let expired = expectation(description: "세션 만료 알림이 오면 안 됨")
        expired.isInverted = true
        let client = APIClient(baseURL: base, transport: transport, tokenStore: store) { expired.fulfill() }

        do {
            _ = try await client.send(AuthEndpoints.me)
            XCTFail("오류가 나야 함")
        } catch {
            XCTAssertEqual(error as? APIError, .network)
        }
        await fulfillment(of: [expired], timeout: 0.2)
        XCTAssertEqual(store.load(), AuthTokens(accessToken: "a1", refreshToken: "r1"))
    }

    func test_동시에_401이_나도_갱신은_한번이고_모두_새_토큰으로_재요청한다() async throws {
        // 액세스 토큰 a1이면 401, a2면 200을 주는 서버
        let transport = TokenAwareTransport()
        let store = InMemoryTokenStore(AuthTokens(accessToken: "a1", refreshToken: "r1"))
        let client = APIClient(baseURL: base, transport: transport, tokenStore: store)

        async let m1 = client.send(AuthEndpoints.me)
        async let m2 = client.send(AuthEndpoints.me)
        async let m3 = client.send(AuthEndpoints.me)
        let all = try await [m1, m2, m3]

        XCTAssertEqual(all.count, 3)
        XCTAssertEqual(transport.refreshCount, 1)
        XCTAssertEqual(store.load(), AuthTokens(accessToken: "a2", refreshToken: "r2"))
    }

    func test_로그아웃은_리프레시_토큰을_보내고_기기_토큰을_지운다() async throws {
        let transport = StubTransport()
        transport.enqueue("/auth/logout", status: 200, body: #"{"success":true}"#)
        let store = InMemoryTokenStore(AuthTokens(accessToken: "a1", refreshToken: "r1"))
        let service = LiveAuthService(api: APIClient(baseURL: base, transport: transport, tokenStore: store), tokenStore: store)

        await service.logout()

        let sent = try JSONSerialization.jsonObject(with: transport.requests[0].httpBody!) as! [String: Any]
        XCTAssertEqual(sent["refreshToken"] as? String, "r1")
        XCTAssertEqual(transport.requests[0].value(forHTTPHeaderField: "Authorization"), "Bearer a1")
        XCTAssertNil(store.load())
    }

    func test_연결이_안되면_network_오류() async {
        let client = APIClient(baseURL: base, transport: StubTransport(), tokenStore: InMemoryTokenStore())
        do {
            _ = try await client.send(AuthEndpoints.login(phone: "01011112222", password: "x"))
            XCTFail("오류가 나야 함")
        } catch {
            XCTAssertEqual(error as? APIError, .network)
        }
    }
}
