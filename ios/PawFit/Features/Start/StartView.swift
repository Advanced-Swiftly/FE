import SwiftUI

/// UI-S-000 시작 화면 (캔버스 S0)
/// - 연한 회색 배경(#F8F8FB) 가운데에 로고 167pt
/// - 저장된 토큰이 있으면 F-MY-01로 확인 후 지도(UI-M-001), 없거나 실패하면 로그인(UI-S-001)
struct StartView: View {
    @Environment(AppSession.self) private var session
    @Environment(\.appEnvironment) private var env

    /// 로고가 깜빡 지나가지 않도록 최소로 보여 주는 시간
    private let minimumDisplay: Duration = .milliseconds(700)

    var body: some View {
        GeometryReader { proxy in
            Image("Logo")
                .resizable()
                .scaledToFit()
                .frame(width: 167, height: 167)
                // 캔버스 844pt 화면에서 로고 위쪽이 311pt → 화면 높이 비율로 맞춘다
                .position(x: proxy.size.width / 2, y: proxy.size.height * (311 + 83.5) / 844)
                .accessibilityLabel("PawFit")
        }
        .background(PawFitColor.loginBackground)
        .ignoresSafeArea()
        .task { await decideRoute() }
    }

    private func decideRoute() async {
        async let me = env.auth.restoreSession()
        try? await Task.sleep(for: minimumDisplay)
        if let me = await me {
            session.signedIn(name: me.name)
        } else {
            session.showLogin()
        }
    }
}

#Preview {
    StartView()
        .environment(AppSession())
        .environment(\.appEnvironment, .preview)
}
