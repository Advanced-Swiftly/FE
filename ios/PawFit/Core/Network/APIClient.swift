import Foundation

/// 실제 네트워크 전송. 테스트에서는 가짜 전송으로 바꿔 끼운다.
protocol HTTPTransport: Sendable {
    func send(_ request: URLRequest) async throws -> (Data, HTTPURLResponse)
}

struct URLSessionTransport: HTTPTransport {
    let session: URLSession

    init(session: URLSession = .shared) { self.session = session }

    func send(_ request: URLRequest) async throws -> (Data, HTTPURLResponse) {
        let (data, response) = try await session.data(for: request)
        guard let http = response as? HTTPURLResponse else { throw APIError.network }
        return (data, http)
    }
}

/// 백엔드(Advanced-Swiftly/BE) 규칙을 따르는 클라이언트
/// - 주소: `{baseURL}{path}` (baseURL은 `/api/v1`까지 포함)
/// - 인증: `Authorization: Bearer <액세스 토큰>` (액세스 30분 · 리프레시 30일, 서버 기본값)
/// - 401 `AUTH_001`이면 `/auth/token/refresh`로 한 번만 갱신하고 다시 요청. 갱신도 실패하면 `.sessionExpired`.
/// - 여러 요청이 동시에 401을 받아도 갱신은 한 번만 한다.
actor APIClient {
    private let baseURL: URL
    private let transport: HTTPTransport
    private let tokenStore: TokenStore
    private var refreshTask: Task<AuthTokens, Error>?

    /// 리프레시까지 실패했을 때 앱 상태(로그인 화면 이동)에 알리는 곳
    private let onSessionExpired: @Sendable () async -> Void

    init(
        baseURL: URL,
        transport: HTTPTransport = URLSessionTransport(),
        tokenStore: TokenStore,
        onSessionExpired: @escaping @Sendable () async -> Void = {}
    ) {
        self.baseURL = baseURL
        self.transport = transport
        self.tokenStore = tokenStore
        self.onSessionExpired = onSessionExpired
    }

    func send<R>(_ endpoint: Endpoint<R>) async throws -> R {
        do {
            return try await perform(endpoint)
        } catch APIError.server(.unauthorized, _, _) where endpoint.requiresAuth {
            _ = try await refreshTokens()
            return try await perform(endpoint)
        }
    }

    // MARK: - 내부

    private func perform<R>(_ endpoint: Endpoint<R>) async throws -> R {
        let request = try makeRequest(endpoint)
        let data: Data
        let response: HTTPURLResponse
        do {
            (data, response) = try await transport.send(request)
        } catch let error as APIError {
            throw error
        } catch {
            throw APIError.network
        }
        return try Self.decode(R.self, data: data, response: response)
    }

    private func makeRequest<R>(_ endpoint: Endpoint<R>) throws -> URLRequest {
        var components = URLComponents(url: baseURL.appending(path: endpoint.path), resolvingAgainstBaseURL: false)
        if !endpoint.query.isEmpty { components?.queryItems = endpoint.query }
        guard let url = components?.url else { throw APIError.decoding("잘못된 주소: \(endpoint.path)") }

        var request = URLRequest(url: url)
        request.httpMethod = endpoint.method.rawValue
        // Render 무료 서버는 한동안 요청이 없으면 잠들고, 첫 요청에 깨어나는 데 30~60초 걸린다
        request.timeoutInterval = 60
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        request.setValue("ko-KR", forHTTPHeaderField: "Accept-Language")

        if let body = endpoint.body {
            request.httpBody = try JSONCoding.encoder.encode(body)
            request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        }
        if endpoint.requiresAuth, let token = tokenStore.load()?.accessToken {
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }
        return request
    }

    static func decode<R: Decodable>(_ type: R.Type, data: Data, response: HTTPURLResponse) throws -> R {
        guard (200..<300).contains(response.statusCode) else {
            if let body = try? JSONCoding.decoder.decode(APIErrorBody.self, from: data) {
                throw APIError.server(
                    code: APIErrorCode(rawValue: body.code),
                    status: response.statusCode,
                    field: body.fieldErrors?.keys.sorted().first
                )
            }
            // 오류 본문이 없을 때는 HTTP 상태로 짐작한다
            let code: APIErrorCode = switch response.statusCode {
            case 401: .unauthorized
            case 404: .notFound
            case 429: .rateLimited
            default: .serverError
            }
            throw APIError.server(code: code, status: response.statusCode, field: nil)
        }
        if R.self == EmptyResponse.self, data.isEmpty, let empty = EmptyResponse() as? R {
            return empty
        }
        do {
            return try JSONCoding.decoder.decode(R.self, from: data)
        } catch {
            throw APIError.decoding(String(describing: error))
        }
    }

    /// F-AUTH-07 토큰 갱신. 동시에 여러 번 불려도 서버 요청은 한 번.
    private func refreshTokens() async throws -> AuthTokens {
        if let refreshTask { return try await refreshTask.value }

        guard let refreshToken = tokenStore.load()?.refreshToken else {
            await expireSession()
            throw APIError.sessionExpired
        }
        let task = Task { () throws -> AuthTokens in
            try await self.perform(AuthEndpoints.refresh(refreshToken: refreshToken))
        }
        refreshTask = task
        defer { refreshTask = nil }

        do {
            let tokens = try await task.value
            tokenStore.save(tokens)
            return tokens
        } catch {
            await expireSession()
            throw APIError.sessionExpired
        }
    }

    private func expireSession() async {
        tokenStore.clear()
        await onSessionExpired()
    }
}
