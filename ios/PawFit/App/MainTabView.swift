import SwiftUI

/// 로그인 후 메인: 아래 탭 3개 (챗봇 · 지도 · 마이). 처음엔 지도.
/// 탭을 바꿔도 각 화면 상태가 유지되도록 세 화면을 모두 만들어 두고 보이는 것만 바꾼다.
struct MainTabView: View {
    enum Tab: Hashable { case chat, map, my }

    @Environment(AppSession.self) private var session
    @Environment(\.appEnvironment) private var env
    @State private var store: AppStore?
    @State private var tab: Tab = .map
    @State private var showDogRegistration = false

    var body: some View {
        Group {
            if let store {
                ZStack(alignment: .bottom) {
                    ZStack {
                        NavigationStack { ChatView(openMapPlace: openPlaceFromChat) }
                            .opacity(tab == .chat ? 1 : 0).allowsHitTesting(tab == .chat)
                        MapHomeView(focusPlaceId: $focusPlaceId)   // 지도는 자체 NavigationStack(경로 제어)
                            .opacity(tab == .map ? 1 : 0).allowsHitTesting(tab == .map)
                        NavigationStack { MyView(selectTab: { tab = $0 }) }
                            .opacity(tab == .my ? 1 : 0).allowsHitTesting(tab == .my)
                    }
                    .safeAreaInset(edge: .bottom, spacing: 0) {
                        if store.tabBarHiders == 0 { Color.clear.frame(height: 49) }
                    }
                    if store.tabBarHiders == 0 {
                        PawFitTabBar(selection: $tab).transition(.move(edge: .bottom))
                    }
                }
                .environment(store)
                .fullScreenCover(isPresented: $showDogRegistration) {
                    DogRegistrationFlow(onFinish: { showDogRegistration = false })
                        .environment(store)
                }
                .task {
                    await store.reloadDogs()
                    if session.pendingDogRegistration {
                        session.pendingDogRegistration = false
                        showDogRegistration = true
                    }
                }
            } else {
                Color.clear.onAppear { store = AppStore(api: env.api) }
            }
        }
        .ignoresSafeArea(.keyboard, edges: .bottom)
    }

    @State private var focusPlaceId: String?

    private func openPlaceFromChat(_ placeId: String) {
        focusPlaceId = placeId
        tab = .map
    }
}

/// 캔버스 탭바: 높이 83(홈 표시줄 포함), 아이콘만, 선택 = 채운 브랜드색
struct PawFitTabBar: View {
    @Binding var selection: MainTabView.Tab

    var body: some View {
        HStack(spacing: 52) {
            item(.chat, on: "bubble.left.fill", off: "bubble.left", label: "챗봇")
            item(.map, on: "map.fill", off: "map", label: "지도")
            item(.my, on: "person.fill", off: "person", label: "마이")
        }
        .padding(.top, 10)
        .frame(maxWidth: .infinity, alignment: .top)
        .frame(height: 49, alignment: .top)
        .background(PawFitColor.background.ignoresSafeArea(edges: .bottom))
        .overlay(alignment: .top) { Rectangle().fill(PawFitColor.separator.opacity(0.6)).frame(height: 0.5) }
    }

    private func item(_ tab: MainTabView.Tab, on: String, off: String, label: String) -> some View {
        let selected = selection == tab
        return Button { selection = tab } label: {
            Image(systemName: selected ? on : off)
                .font(.system(size: 24, weight: .regular))
                .foregroundStyle(selected ? PawFitColor.brand : PawFitColor.textTertiary)
                .frame(width: 56, height: 44)
        }
        .accessibilityLabel(label)
        .accessibilityAddTraits(selected ? .isSelected : [])
    }
}

/// 이 화면이 보이는 동안 아래 탭바를 숨긴다 (업체 상세 · 반려견 화면 등)
struct HidesTabBarModifier: ViewModifier {
    @Environment(AppStore.self) private var store
    func body(content: Content) -> some View {
        content
            .onAppear { store.tabBarHiders += 1 }
            .onDisappear { store.tabBarHiders = max(0, store.tabBarHiders - 1) }
    }
}

extension View {
    func hidesTabBar() -> some View { modifier(HidesTabBarModifier()) }
}
