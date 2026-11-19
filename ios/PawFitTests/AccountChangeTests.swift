import XCTest
@testable import PawFit

/// 보호자 계정 관리: 휴대폰 번호 변경 · 비밀번호 변경
/// 서버 기준: BE member/MemberController (PATCH /users/me, PATCH /users/me/password — BE PR #56)
final class AccountChangeTests: XCTestCase {
    private let base = URL(string: "https://test.local/api/v1")!

    private func live(_ transport: StubTransport, tokens: AuthTokens = AuthTokens(accessToken: "a1", refreshToken: "r1"))
        -> (LivePawFitAPI, InMemoryTokenStore) {
        let store = InMemoryTokenStore(tokens)
        return (LivePawFitAPI(api: APIClient(baseURL: base, transport: transport, tokenStore: store)), store)
    }

    // MARK: 실서버 요청 모양

    func test_번호_변경_인증번호는_CHANGE_PHONE으로_숫자만_보낸다() async throws {
        let transport = StubTransport()
        transport.enqueue("/auth/phone-verifications", status: 201, body: #"{"verificationId":7,"expiresInSeconds":180}"#)
        let (api, _) = live(transport)

        let sent = try await api.sendPhoneCode("010-2222-3333", purpose: .changePhone)

        XCTAssertEqual(sent.verificationId, 7)
        let body = try JSONSerialization.jsonObject(with: transport.requests[0].httpBody!) as! [String: Any]
        XCTAssertEqual(body["phoneNumber"] as? String, "01022223333")
        XCTAssertEqual(body["purpose"] as? String, "CHANGE_PHONE")
    }

    func test_번호_변경은_PATCH_users_me에_인증토큰만_보낸다() async throws {
        let transport = StubTransport()
        transport.enqueue("/users/me", status: 200, body: #"{"userId":1,"name":"이채린","phoneNumber":"01022223333"}"#)
        let (api, _) = live(transport)

        let updated = try await api.changePhone(verificationToken: "vt-1")

        XCTAssertEqual(updated.phoneNumber, "01022223333")
        let request = transport.requests[0]
        XCTAssertEqual(request.httpMethod, "PATCH")
        XCTAssertEqual(request.value(forHTTPHeaderField: "Authorization"), "Bearer a1")
        let body = try JSONSerialization.jsonObject(with: request.httpBody!) as! [String: Any]
        XCTAssertEqual(body["phoneVerificationToken"] as? String, "vt-1")
        XCTAssertNil(body["name"])                  // 이름은 보내지 않아야 서버가 그대로 둔다
    }

    func test_이미_쓰는_번호면_DUPLICATE_PHONE_NUMBER() async {
        let transport = StubTransport()
        transport.enqueue("/users/me", status: 400, body: ServerSample.error(400, "DUPLICATE_PHONE_NUMBER"))
        let (api, _) = live(transport)

        do {
            _ = try await api.changePhone(verificationToken: "vt-1")
            XCTFail("오류가 나야 함")
        } catch {
            XCTAssertEqual((error as? APIError)?.code, .duplicatePhoneNumber)
            XCTAssertEqual(APIError.message(error), "이미 가입한 휴대폰 번호예요")
        }
    }

    func test_비밀번호_변경은_PATCH로_보내고_204를_받는다() async throws {
        let transport = StubTransport()
        transport.enqueue("/users/me/password", status: 204, body: "")
        let (api, _) = live(transport)

        try await api.changePassword(current: "pawfit!123", new: "newpass!45")

        let request = transport.requests[0]
        XCTAssertEqual(request.httpMethod, "PATCH")
        XCTAssertEqual(request.url?.path, "/api/v1/users/me/password")
        let body = try JSONSerialization.jsonObject(with: request.httpBody!) as! [String: Any]
        XCTAssertEqual(body["currentPassword"] as? String, "pawfit!123")
        XCTAssertEqual(body["newPassword"] as? String, "newpass!45")
    }

    func test_지금_비밀번호가_틀리면_토큰을_갱신하지_않고_INVALID_PASSWORD() async {
        let transport = StubTransport()
        transport.enqueue("/users/me/password", status: 401, body: ServerSample.error(401, "INVALID_PASSWORD"))
        let (api, store) = live(transport)

        do {
            try await api.changePassword(current: "wrong!123", new: "newpass!45")
            XCTFail("오류가 나야 함")
        } catch {
            XCTAssertEqual((error as? APIError)?.code, .invalidPassword)
        }
        XCTAssertEqual(transport.requests.count, 1)          // /auth/token/refresh를 부르지 않음
        XCTAssertEqual(store.load(), AuthTokens(accessToken: "a1", refreshToken: "r1"))
    }

    // MARK: 비밀번호 규칙

    func test_비밀번호_규칙은_UTF8_72byte를_넘으면_안된다() {
        XCTAssertTrue(PasswordRule.isValid("abcdefg!"))
        XCTAssertFalse(PasswordRule.isValid("abcdefg1"))                     // 특수기호 없음
        XCTAssertFalse(PasswordRule.isValid("a!" + String(repeating: "가", count: 30)))  // 32자지만 92 byte
    }

    // MARK: 목업

    func test_목업_번호_변경_흐름() async throws {
        let api = MockPawFitAPI(latency: .zero)
        _ = try await api.sendPhoneCode("010-2222-3333", purpose: .changePhone)
        let token = try await api.confirmPhoneCode(id: 1, code: "123456")
        let updated = try await api.changePhone(verificationToken: token)

        XCTAssertEqual(updated.phoneNumber, "01022223333")
        let me = try await api.me()
        XCTAssertEqual(me.phoneNumber, "01022223333")
    }

    func test_목업_비밀번호_변경() async throws {
        let api = MockPawFitAPI(latency: .zero)
        do {
            try await api.changePassword(current: "wrong!123", new: "newpass!45")
            XCTFail("오류가 나야 함")
        } catch {
            XCTAssertEqual((error as? APIError)?.code, .invalidPassword)
        }
        try await api.changePassword(current: MockAuthService.demoPassword, new: "newpass!45")
        // 바뀐 비밀번호로 탈퇴 확인이 통과해야 함
        try await api.withdraw(password: "newpass!45")
    }
}
