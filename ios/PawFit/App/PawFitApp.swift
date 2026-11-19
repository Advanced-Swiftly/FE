import SwiftUI

@main
struct PawFitApp: App {
    @State private var session: AppSession
    private let environment: AppEnvironment

    init() {
        let session = AppSession()
        _session = State(initialValue: session)
        environment = AppEnvironment.live(session: session)
    }

    var body: some Scene {
        WindowGroup {
            RootView()
                .environment(session)
                .environment(\.appEnvironment, environment)
        }
    }
}

private struct AppEnvironmentKey: EnvironmentKey {
    static let defaultValue: AppEnvironment = .preview
}

extension EnvironmentValues {
    var appEnvironment: AppEnvironment {
        get { self[AppEnvironmentKey.self] }
        set { self[AppEnvironmentKey.self] = newValue }
    }
}
