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
    /// 가입 완료(S-005)에서 [반려견 등록하기]를 눌러 들어왔을 때 true → 메인에서 등록 화면을 바로 띄운다
    var pendingDogRegistration = false

    func signedIn(name: String, registerDog: Bool = false) {
        userName = name
        didExpire = false
        pendingDogRegistration = registerDog
        route = .main
    }

    func updateName(_ name: String) {
        userName = name
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
