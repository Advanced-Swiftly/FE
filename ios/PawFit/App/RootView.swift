import SwiftUI

/// 앱 흐름에 따라 화면을 바꾼다. 화면 사이 전환은 부드러운 페이드 하나만 쓴다.
struct RootView: View {
    @Environment(AppSession.self) private var session
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    var body: some View {
        ZStack {
            switch session.route {
            case .start:
                StartView()
            case .login:
                LoginView()
            case .main:
                MainTabView()
            }
        }
        .animation(reduceMotion ? nil : .easeInOut(duration: 0.25), value: session.route)
    }
}

#Preview {
    RootView()
        .environment(AppSession())
        .environment(\.appEnvironment, .preview)
}
