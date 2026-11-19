import Foundation

/// 앱 전체에서 쓰는 의존성 묶음. 설정은 Config/*.xcconfig → Info.plist 에서 읽는다.
///   PawFitAPIBaseURL : 서버 주소 (/api/v1 포함)
///   PawFitUseMockAPI : YES면 목업(캔버스 예시 데이터)
struct AppEnvironment: Sendable {
    let auth: AuthService
    let api: PawFitAPI
    let tokenStore: TokenStore
    let usesMock: Bool
    let baseURL: URL

    @MainActor
    static func live(session: AppSession) -> AppEnvironment {
        let info = Bundle.main.infoDictionary ?? [:]
        let useMock = (info["PawFitUseMockAPI"] as? String)?.uppercased() == "YES"
        let urlString = (info["PawFitAPIBaseURL"] as? String) ?? ""
        let baseURL = URL(string: urlString) ?? URL(string: "https://invalid.local/api/v1")!
        let tokenStore = KeychainTokenStore()

        if useMock {
            return AppEnvironment(auth: MockAuthService(tokenStore: tokenStore), api: MockPawFitAPI(),
                                  tokenStore: tokenStore, usesMock: true, baseURL: baseURL)
        }
        let client = APIClient(baseURL: baseURL, tokenStore: tokenStore) {
            // AppSession은 앱이 끝날 때까지 살아 있어서 그대로 잡아 둔다
            await session.sessionExpired()
        }
        return AppEnvironment(auth: LiveAuthService(api: client, tokenStore: tokenStore), api: LivePawFitAPI(api: client),
                              tokenStore: tokenStore, usesMock: false, baseURL: baseURL)
    }

    /// SwiftUI 미리보기 · 테스트용 (항상 목업, 대기 시간 없음)
    static let preview: AppEnvironment = {
        let store = InMemoryTokenStore(AuthTokens(accessToken: "preview", refreshToken: "preview"))
        return AppEnvironment(auth: MockAuthService(tokenStore: store, latency: .zero), api: MockPawFitAPI(latency: .zero),
                              tokenStore: store, usesMock: true, baseURL: URL(string: "https://preview.local/api/v1")!)
    }()
}
