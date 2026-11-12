import Observation

/// 앱의 큰 흐름: 시작(S-000) → 로그인(S-001) 또는 지도(M-001)
@MainActor
@Observable
final class AppSession {
    enum Route: Equatable {
        case start
        case login
        case main
    }

    private(set) var route: Route = .start
    private(set) var userName: String?
    /// 리프레시 토큰까지 만료돼 로그인으로 돌아왔을 때 true (안내 문구를 띄울지는 [확인 필요])
    private(set) var didExpire = false

    func signedIn(name: String) {
        userName = name
        didExpire = false
        route = .main
    }

    func showLogin() {
        route = .login
    }

    func signedOut() {
        userName = nil
        route = .login
    }

    func sessionExpired() {
        userName = nil
        didExpire = true
        route = .login
    }
}
