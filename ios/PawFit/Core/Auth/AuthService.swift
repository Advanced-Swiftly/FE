import Foundation

/// 화면(뷰모델)은 이 프로토콜만 안다. 실서버/목업은 `AppEnvironment`에서 고른다.
protocol AuthService: Sendable {
    /// 로그인. 성공하면 토큰을 저장하고 사용자 요약을 돌려준다.
    func login(phone: String, password: String) async throws -> UserSummary
    /// 시작 화면(UI-S-000): 저장된 토큰이 있으면 GET /users/me로 확인. 토큰이 없거나 실패하면 nil.
    func restoreSession() async -> Me?
    /// 로그아웃. 서버 요청이 실패해도 기기의 토큰은 지운다.
    func logout() async
}

struct LiveAuthService: AuthService {
    let api: APIClient
    let tokenStore: TokenStore

    func login(phone: String, password: String) async throws -> UserSummary {
        let response = try await api.send(AuthEndpoints.login(phone: phone, password: password))
        // 같은 서버로 업체관리자 · 운영자도 로그인하므로, 보호자가 아니면 토큰을 저장하지 않는다
        guard response.user.role == .guardian else {
            _ = try? await api.send(AuthEndpoints.logout(
                refreshToken: response.refreshToken, accessToken: response.accessToken))
            throw APIError.notGuardian
        }
        tokenStore.save(response.tokens)
        return response.user
    }

    func restoreSession() async -> Me? {
        guard tokenStore.load() != nil else { return nil }
        guard let me = try? await api.send(AuthEndpoints.me), me.role == .guardian else { return nil }
        return me
    }

    func logout() async {
        if let refresh = tokenStore.load()?.refreshToken {
            _ = try? await api.send(AuthEndpoints.logout(refreshToken: refresh))
        }
        tokenStore.clear()
    }
}

/// 서버 없이 화면을 만들 때 쓰는 가짜 계정.
/// 로그인: 010-1234-5678 / pawfit!123  (그 밖의 값은 INVALID_CREDENTIALS)
/// 010-0000-0000은 요청 과다(TOO_MANY_REQUESTS), 010-9999-9999는 네트워크 오류,
/// 010-5555-5555는 업체관리자 계정을 흉내 낸다.
struct MockAuthService: AuthService {
    static let demoPhone = "01012345678"
    static let demoPassword = "pawfit!123"

    let tokenStore: TokenStore
    var latency: Duration = .milliseconds(600)

    func login(phone: String, password: String) async throws -> UserSummary {
        try? await Task.sleep(for: latency)
        switch PhoneRule.digits(phone) {
        case "01000000000":
            throw APIError.server(code: .rateLimited, status: 429, field: nil)
        case "01099999999":
            throw APIError.network
        case "01055555555":
            throw APIError.notGuardian
        case Self.demoPhone where password == Self.demoPassword:
            tokenStore.save(AuthTokens(accessToken: "mock-access", refreshToken: "mock-refresh"))
            return Self.demoUser
        default:
            throw APIError.server(code: .invalidCredentials, status: 401, field: nil)
        }
    }

    func restoreSession() async -> Me? {
        try? await Task.sleep(for: latency)
        guard tokenStore.load() != nil else { return nil }
        return Me(userId: Self.demoUser.userId, role: .guardian, name: Self.demoUser.name, phoneNumber: "01012345678")
    }

    func logout() async { tokenStore.clear() }

    static let demoUser = UserSummary(userId: 1, role: .guardian, name: "이채린")
}
