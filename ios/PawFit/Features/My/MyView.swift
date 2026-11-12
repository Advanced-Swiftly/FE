import SwiftUI

enum MyRoute: Hashable { case account, notify, dogs, vaccinations, road }

/// 마이 탭: 보호자 · 내 반려견 · 댕댕로드 카드 · 예방접종 증빙 관리 · 알림 설정 · 로그아웃
struct MyView: View {
    let selectTab: (MainTabView.Tab) -> Void

    @Environment(AppStore.self) private var store
    @Environment(AppSession.self) private var session
    @Environment(\.appEnvironment) private var env
    @State private var me: Me?
    @State private var event: CurrentEvent?
    @State private var stamps: StampStatus?
    @State private var lastVisit: Visit?
    @State private var confirmLogout = false

    var body: some View {
        ZStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 0) {
                    account
                    dogsSection
                    if let event { roadCard(event) }
                    menu
                    Button { confirmLogout = true } label: {
                        Label("로그아웃", systemImage: "rectangle.portrait.and.arrow.right")
                            .font(.pawfit(15)).foregroundStyle(PawFitColor.iconGray)
                            .frame(maxWidth: .infinity, minHeight: 52, alignment: .leading)
                            .padding(.horizontal, 16)
                    }
                    .padding(.horizontal, 16).padding(.top, 16).padding(.bottom, 24)
                }
            }
            .safeAreaInset(edge: .top, spacing: 0) {
                Text("마이").font(.pawfit(17, .semibold)).frame(maxWidth: .infinity).frame(height: 44)
                    .background(PawFitColor.background)
                    .accessibilityAddTraits(.isHeader)
            }
            .refreshable { await load() }

            if confirmLogout {
                ConfirmDialog(title: "로그아웃할까요?",
                              message: "다시 로그인하면 반려견 정보와 댕댕로드 스탬프를 그대로 볼 수 있어요.",
                              confirmTitle: "로그아웃",
                              onCancel: { confirmLogout = false },
                              onConfirm: { Task { await logout() } })
            }
        }
        .animation(.easeOut(duration: 0.15), value: confirmLogout)
        .screenBackground()
        .toolbar(.hidden, for: .navigationBar)
        .navigationDestination(for: MyRoute.self) { route in
            switch route {
            case .account: AccountView().hidesTabBar()
            case .notify: NotifyView().hidesTabBar()
            case .dogs: MyDogsView().hidesTabBar()
            case .vaccinations: VaccinationListView().hidesTabBar()
            case .road: RoadView()
            }
        }
        .dogRoutes()
        .task(id: store.revision) { await load() }
    }

    private var displayName: String { me?.name ?? session.userName ?? "보호자" }

    private var account: some View {
        NavigationLink(value: MyRoute.account) {
            HStack(spacing: 14) {
                Text(String(displayName.prefix(1)))
                    .font(.pawfit(22, .semibold)).foregroundStyle(PawFitColor.brand)
                    .frame(width: 56, height: 56).background(PawFitColor.brandTint, in: Circle())
                VStack(alignment: .leading, spacing: 3) {
                    Text("\(displayName) 보호자님").font(.pawfit(20, .bold)).foregroundStyle(PawFitColor.textPrimary)
                    Text(me.map { PhoneRule.format($0.phoneNumber) } ?? " ")
                        .font(.pawfit(13.5)).foregroundStyle(PawFitColor.textSecondary)
                }
                Spacer(minLength: 0)
                HStack(spacing: 2) {
                    Text("계정 관리").font(.pawfit(14, .semibold))
                    Image(systemName: "chevron.right").font(.system(size: 12, weight: .semibold))
                }
                .foregroundStyle(PawFitColor.brand)
            }
            .padding(.horizontal, 4).frame(height: 76)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityLabel("\(displayName) 보호자님, 계정 관리")
        .padding(.horizontal, 16).padding(.top, 12)
    }

    private var dogsSection: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Text("내 반려견").font(.pawfit(16, .semibold)).accessibilityAddTraits(.isHeader)
                Spacer()
                NavigationLink(value: MyRoute.dogs) {
                    HStack(spacing: 2) {
                        Text("전체 보기").font(.pawfit(14))
                        Image(systemName: "chevron.right").font(.system(size: 12))
                    }
                    .foregroundStyle(PawFitColor.iconGray).frame(minHeight: 32)
                }
            }
            .padding(.horizontal, 4)

            if store.dogs.isEmpty && !store.isLoadingDogs {
                NavigationLink(value: MyRoute.dogs) {
                    Label("반려견 등록하기", systemImage: "plus").font(.pawfit(16, .semibold)).foregroundStyle(PawFitColor.brand)
                        .frame(maxWidth: .infinity, minHeight: 72)
                        .background(Color.white, in: RoundedRectangle(cornerRadius: 18))
                        .overlay(RoundedRectangle(cornerRadius: 18).strokeBorder(PawFitColor.separator,
                                                                                  style: StrokeStyle(lineWidth: 1, dash: [5, 4])))
                }
            }
            ForEach(store.dogs.prefix(3)) { dog in
                NavigationLink(value: DogRoute.edit(dog.dogId)) {
                    HStack(spacing: 10) {
                        DogAvatar(name: dog.name, size: 40, illustrated: dog.isDefault)
                        VStack(alignment: .leading, spacing: 2) {
                            HStack(spacing: 5) {
                                Text(dog.name).font(.pawfit(16, .semibold)).foregroundStyle(PawFitColor.textPrimary)
                                if dog.isDefault {
                                    Text("기본").font(.pawfit(11, .semibold)).foregroundStyle(.white)
                                        .padding(.horizontal, 6).frame(height: 18).background(PawFitColor.brand, in: Capsule())
                                }
                            }
                            Text(dog.subtitle).font(.pawfit(13)).foregroundStyle(PawFitColor.textSecondary)
                        }
                        Spacer()
                        Image(systemName: "chevron.right").font(.system(size: 13, weight: .semibold)).foregroundStyle(PawFitColor.textTertiary)
                    }
                    .padding(.horizontal, 12).frame(height: 72)
                    .background(Color.white, in: RoundedRectangle(cornerRadius: 18))
                    .overlay(RoundedRectangle(cornerRadius: 18).strokeBorder(dog.isDefault ? PawFitColor.brand : PawFitColor.separator,
                                                                             lineWidth: dog.isDefault ? 2 : 1))
                }
                .buttonStyle(.plain)
                .accessibilityLabel("\(dog.name)\(dog.isDefault ? ", 기본 반려견" : "")")
            }
        }
        .padding(.horizontal, 16).padding(.top, 20)
    }

    private func roadCard(_ event: CurrentEvent) -> some View {
        let count = stamps?.stampCount ?? 0
        let max = stamps?.maxStampCount ?? 10
        return NavigationLink(value: MyRoute.road) {
            VStack(alignment: .leading, spacing: 0) {
                HStack(spacing: 8) {
                    Image(systemName: "pawprint.fill").foregroundStyle(PawFitColor.brand)
                    Text("댕댕로드").font(.pawfit(16, .semibold))
                    Spacer()
                    Image(systemName: "chevron.right").font(.system(size: 13, weight: .semibold)).foregroundStyle(PawFitColor.textTertiary)
                }
                HStack(alignment: .lastTextBaseline) {
                    Text("\(RoadText.region(event.title)) · \(max)곳 모으면 상품 추첨").font(.pawfit(14)).foregroundStyle(PawFitColor.iconGray)
                    Spacer()
                    (Text("\(count)").font(.pawfit(18, .bold)).foregroundColor(PawFitColor.brand)
                     + Text(" / \(max)곳").font(.pawfit(14)).foregroundColor(PawFitColor.textSecondary))
                }
                .padding(.top, 10)
                ProgressBar(value: Double(count) / Double(Swift.max(max, 1)), height: 6).padding(.top, 8)
                if let lastVisit {
                    HStack(spacing: 6) {
                        Text("최근 방문").foregroundStyle(PawFitColor.textSecondary)
                        Text("\(lastVisit.storeName) · \(DateText.monthDay(lastVisit.visitedAt) ?? "")")
                    }
                    .font(.pawfit(13.5)).padding(.top, 12)
                }
            }
            .foregroundStyle(PawFitColor.textPrimary)
            .padding(.leading, 18).padding(.trailing, 16).padding(.top, 16).padding(.bottom, 14)
            .background(Color.white, in: RoundedRectangle(cornerRadius: 20))
            .overlay(RoundedRectangle(cornerRadius: 20).strokeBorder(PawFitColor.separator, lineWidth: 0.5))
            .shadow(color: Color(hex: 0x2D2D2D, opacity: 0.06), radius: 10, y: 4)
        }
        .buttonStyle(.plain)
        .accessibilityLabel("댕댕로드, \(max)곳 중 \(count)곳 방문, 방문 기록 보기")
        .padding(.horizontal, 16).padding(.top, 20)
    }

    private var menu: some View {
        VStack(spacing: 0) {
            menuRow("예방접종 증빙 관리", icon: "doc.text", route: .vaccinations)
            Rectangle().fill(PawFitColor.separator).frame(height: 0.5).padding(.leading, 34)
            menuRow("알림 설정", icon: "bell", route: .notify)
        }
        .padding(.leading, 16)
        .background(Color.white, in: RoundedRectangle(cornerRadius: 20))
        .overlay(RoundedRectangle(cornerRadius: 20).strokeBorder(PawFitColor.separator, lineWidth: 0.5))
        .padding(.horizontal, 16).padding(.top, 16)
    }

    private func menuRow(_ title: String, icon: String, route: MyRoute) -> some View {
        NavigationLink(value: route) {
            HStack(spacing: 12) {
                Image(systemName: icon).font(.system(size: 18)).foregroundStyle(PawFitColor.iconGray).frame(width: 22)
                Text(title).font(.pawfit(16)).foregroundStyle(PawFitColor.textPrimary)
                Spacer()
                Image(systemName: "chevron.right").font(.system(size: 13, weight: .semibold)).foregroundStyle(PawFitColor.textTertiary)
            }
            .padding(.trailing, 16).frame(height: 56)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
    }

    private func load() async {
        me = try? await store.api.me()
        if let me { session.updateName(me.name) }
        if store.dogs.isEmpty { await store.reloadDogs() }
        event = try? await store.api.currentEvent()
        if let event {
            stamps = try? await store.api.stamps(eventId: event.eventId)
            lastVisit = (try? await store.api.visits())?.first
        }
    }

    private func logout() async {
        confirmLogout = false
        await env.auth.logout()
        store.clear()
        session.signedOut()
    }
}

/// 진행 막대 (댕댕로드)
struct ProgressBar: View {
    let value: Double
    var height: CGFloat = 6
    var track: Color = PawFitColor.brandTint
    var fill: Color = PawFitColor.brand
    var body: some View {
        GeometryReader { geo in
            ZStack(alignment: .leading) {
                Capsule().fill(track)
                Capsule().fill(fill).frame(width: geo.size.width * min(max(value, 0), 1))
            }
        }
        .frame(height: height)
        .accessibilityHidden(true)
    }
}

enum RoadText {
    /// "성수 댕댕로드 10곳 방문하기" → "성수"
    static func region(_ title: String) -> String {
        title.components(separatedBy: " 댕댕로드").first.flatMap { $0.isEmpty ? nil : $0 } ?? "댕댕로드"
    }
}

// MARK: - 보호자 계정 관리

struct AccountView: View {
    @Environment(AppStore.self) private var store
    @Environment(AppSession.self) private var session
    @Environment(\.dismiss) private var dismiss
    @AppStorage("pawfit.shippingAddress") private var address = ""
    @State private var me: Me?
    @State private var name = ""
    @State private var editingAddress = false
    @State private var showWithdraw = false
    @State private var busy = false
    @State private var message: String?

    var body: some View {
        VStack(spacing: 0) {
            TopBar(title: "보호자 계정 관리")
            ScrollView {
                VStack(alignment: .leading, spacing: 0) {
                    Text(String((name.isEmpty ? (me?.name ?? "보") : name).prefix(1)))
                        .font(.pawfit(36, .semibold)).foregroundStyle(PawFitColor.brand)
                        .frame(width: 96, height: 96).background(PawFitColor.brandTint, in: Circle())
                        .frame(maxWidth: .infinity).padding(.top, 8)
                        .accessibilityHidden(true)

                    VStack(alignment: .leading, spacing: 8) {
                        FieldLabel(text: "보호자 이름")
                        BoxField(placeholder: "이름", text: $name)
                        Text("챗봇과 알림에서 이 이름으로 불러드려요").font(.pawfit(13)).foregroundStyle(PawFitColor.textSecondary)
                            .padding(.horizontal, 4)
                    }
                    .padding(.top, 20)

                    section("로그인 정보") {
                        row("휴대폰 번호", me.map { PhoneRule.format($0.phoneNumber) } ?? "") {
                            message = "번호 변경은 다음 업데이트에서 열려요"
                        }
                        Rectangle().fill(PawFitColor.separator).frame(height: 0.5)
                        row("비밀번호", "바꾸기") { message = "비밀번호 변경은 다음 업데이트에서 열려요" }
                    }

                    section("배송지") {
                        row("배송지", address.isEmpty ? "등록해 주세요" : address) { editingAddress = true }
                    }
                    Text("댕댕로드 상품에 당첨되면 휴대폰 번호로 연락드리고 이 주소로 보내드려요")
                        .font(.pawfit(13)).foregroundStyle(PawFitColor.textSecondary).padding(.horizontal, 4).padding(.top, 8)
                }
                .padding(.horizontal, 16).padding(.bottom, 24)
            }
            .scrollDismissesKeyboard(.interactively)
        }
        .safeAreaInset(edge: .bottom, spacing: 0) {
            BottomBar(showsDivider: false) {
                Button { Task { await save() } } label: { if busy { ProgressView().tint(.white) } else { Text("변경 내용 저장") } }
                    .buttonStyle(PrimaryButtonStyle())
                    .disabled(busy || name.trimmingCharacters(in: .whitespaces).isEmpty || name == me?.name)
                Button("회원 탈퇴") { showWithdraw = true }
                    .font(.pawfit(14)).foregroundStyle(PawFitColor.textSecondary).frame(minHeight: 44)
            }
        }
        .screenBackground()
        .toolbar(.hidden, for: .navigationBar)
        .sheet(isPresented: $editingAddress) { AddressSheet(address: $address) }
        .sheet(isPresented: $showWithdraw) { WithdrawSheet() }
        .toast($message)
        .task {
            me = try? await store.api.me()
            if name.isEmpty { name = me?.name ?? session.userName ?? "" }
        }
    }

    private func section<C: View>(_ title: String, @ViewBuilder _ content: () -> C) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(title).font(.pawfit(15, .semibold)).padding(.horizontal, 4).accessibilityAddTraits(.isHeader)
            VStack(spacing: 0, content: content)
                .padding(.horizontal, 16).padding(.vertical, 6)
                .background(Color.white, in: RoundedRectangle(cornerRadius: 18))
                .overlay(RoundedRectangle(cornerRadius: 18).strokeBorder(PawFitColor.separator, lineWidth: 0.5))
        }
        .padding(.top, 24)
    }

    private func row(_ label: String, _ value: String, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            HStack(spacing: 10) {
                Text(label).font(.pawfit(15)).foregroundStyle(PawFitColor.iconGray).frame(width: 76, alignment: .leading)
                Text(value).font(.pawfit(15)).foregroundStyle(PawFitColor.textPrimary).lineLimit(2).multilineTextAlignment(.leading)
                Spacer(minLength: 0)
                Image(systemName: "chevron.right").font(.system(size: 13, weight: .semibold)).foregroundStyle(PawFitColor.textTertiary)
            }
            .frame(minHeight: 54)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
    }

    private func save() async {
        busy = true; defer { busy = false }
        do {
            let updated = try await store.api.updateName(name.trimmingCharacters(in: .whitespaces))
            session.updateName(updated.name)
            me = try? await store.api.me()
            message = "저장했어요"
        } catch {
            message = APIError.message(error)
        }
    }
}

/// 배송지 입력 (서버에 배송지 API가 없어 이 기기에만 저장 — 추첨 응모 때 함께 보낸다)
struct AddressSheet: View {
    @Binding var address: String
    @Environment(\.dismiss) private var dismiss
    @State private var text = ""

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            SheetGrabber()
            Text("배송지").font(.pawfit(20, .bold))
            TextField("", text: $text, prompt: Text("예) 서울 성동구 성수이로 00, 101호").foregroundStyle(PawFitColor.textTertiary), axis: .vertical)
                .font(.pawfit(15)).lineLimit(2...4)
                .padding(14)
                .background(Color.white, in: RoundedRectangle(cornerRadius: 14))
                .overlay(RoundedRectangle(cornerRadius: 14).strokeBorder(PawFitColor.separator))
            Spacer()
            Button("저장") { address = text.trimmingCharacters(in: .whitespacesAndNewlines); dismiss() }
                .buttonStyle(PrimaryButtonStyle())
                .disabled(text.trimmingCharacters(in: .whitespaces).isEmpty)
        }
        .padding(.horizontal, 20).padding(.bottom, 16)
        .presentationDetents([.height(320)])
        .onAppear { text = address }
    }
}

/// 회원 탈퇴 (비밀번호 확인)
struct WithdrawSheet: View {
    @Environment(AppStore.self) private var store
    @Environment(AppSession.self) private var session
    @Environment(\.appEnvironment) private var env
    @Environment(\.dismiss) private var dismiss
    @State private var password = ""
    @State private var busy = false
    @State private var error: String?

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            SheetGrabber()
            Text("탈퇴할까요?").font(.pawfit(20, .bold))
            Text("반려견 정보, 예방접종 증빙, 댕댕로드 스탬프가 모두 지워지고 되돌릴 수 없어요. 계속하려면 비밀번호를 입력해 주세요.")
                .font(.pawfit(14.5)).lineSpacing(3).foregroundStyle(PawFitColor.iconGray)
            BoxField(placeholder: "비밀번호", text: $password, isSecure: true, isInvalid: error != nil)
                .padding(.top, 4)
            if let error { Text(error).font(.pawfit(13)).foregroundStyle(PawFitColor.errorText) }
            Spacer()
            HStack(spacing: 8) {
                Button("취소") { dismiss() }.buttonStyle(NeutralButtonStyle())
                Button { Task { await withdraw() } } label: { if busy { ProgressView().tint(.white) } else { Text("탈퇴") } }
                    .buttonStyle(PrimaryButtonStyle(fontSize: 16, background: PawFitColor.errorBorder))
                    .disabled(password.isEmpty || busy)
            }
        }
        .padding(.horizontal, 20).padding(.bottom, 16)
        .presentationDetents([.height(380)])
    }

    private func withdraw() async {
        busy = true; defer { busy = false }
        do {
            try await store.api.withdraw(password: password)
            await env.auth.logout()
            store.clear()
            dismiss()
            session.signedOut()
        } catch {
            self.error = APIError.message(error)
        }
    }
}

// MARK: - 알림 설정

struct NotifyView: View {
    @Environment(AppStore.self) private var store
    @AppStorage("pawfit.notify.visitedChanges") private var visitedChanges = true
    @AppStorage("pawfit.notify.night") private var night = false
    @State private var settings = NotificationSettings(event: true, inquiry: true, reviewResult: true, marketing: false)
    @State private var loaded = false
    @State private var message: String?

    var body: some View {
        VStack(spacing: 0) {
            TopBar(title: "알림 설정")
            ScrollView {
                VStack(alignment: .leading, spacing: 0) {
                    group("이용 알림") {
                        toggle("예방접종 증빙 결과", "AI 확인이 끝나거나 서류를 다시 올려야 할 때", bind(\.reviewResult))
                        divider
                        toggle("다녀온 매장 조건 변경", "방문한 매장의 입장 조건이 바뀌면 알려드려요", $visitedChanges)
                        divider
                        toggle("댕댕로드 스탬프·추첨", "스탬프가 쌓이거나 추첨 결과를 발표할 때", bind(\.event))
                    }
                    group("혜택·광고 알림") {
                        toggle("혜택·이벤트 소식 받기", "제휴사 쿠폰, 새 댕댕로드 소식", bind(\.marketing))
                        divider
                        toggle("밤에도 받기", "밤 9시~아침 8시 사이 혜택 알림", $night)
                            .disabled(settings.marketing != true)
                    }
                    .padding(.top, 8)
                }
                .padding(.horizontal, 16).padding(.top, 20).padding(.bottom, 24)
            }
        }
        .screenBackground()
        .toolbar(.hidden, for: .navigationBar)
        .toast($message)
        .task {
            if let s = try? await store.api.notificationSettings() { settings = s }
            loaded = true
        }
    }

    private var divider: some View { Rectangle().fill(PawFitColor.separator).frame(height: 0.5) }

    private func bind(_ key: WritableKeyPath<NotificationSettings, Bool?>) -> Binding<Bool> {
        Binding(
            get: { settings[keyPath: key] ?? false },
            set: { on in
                let before = settings
                settings[keyPath: key] = on
                Task {
                    var patch = NotificationSettings()
                    patch[keyPath: key] = on
                    do { settings = try await store.api.updateNotificationSettings(patch) }
                    catch { settings = before; message = APIError.message(error) }
                }
            })
    }

    private func group<C: View>(_ title: String, @ViewBuilder _ content: () -> C) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(title).font(.pawfit(15, .semibold)).padding(.horizontal, 4).accessibilityAddTraits(.isHeader)
            VStack(spacing: 0, content: content)
                .padding(.horizontal, 16)
                .background(Color.white, in: RoundedRectangle(cornerRadius: 18))
                .overlay(RoundedRectangle(cornerRadius: 18).strokeBorder(PawFitColor.separator, lineWidth: 0.5))
        }
        .padding(.bottom, 20)
    }

    private func toggle(_ title: String, _ detail: String, _ isOn: Binding<Bool>) -> some View {
        Toggle(isOn: isOn) {
            VStack(alignment: .leading, spacing: 3) {
                Text(title).font(.pawfit(16)).foregroundStyle(PawFitColor.textPrimary)
                Text(detail).font(.pawfit(13)).foregroundStyle(PawFitColor.textSecondary)
            }
        }
        .tint(PawFitColor.brand)
        .padding(.vertical, 14)
    }
}

// MARK: - 예방접종 증빙 관리 (반려견별)

struct VaccinationListView: View {
    @Environment(AppStore.self) private var store

    var body: some View {
        VStack(spacing: 0) {
            TopBar(title: "예방접종 증빙 관리")
            ScrollView {
                VStack(spacing: 10) {
                    if store.dogs.isEmpty {
                        Text("등록한 반려견이 없어요").font(.pawfit(15)).foregroundStyle(PawFitColor.textSecondary).padding(.top, 60)
                    }
                    ForEach(store.dogs) { dog in
                        let badge = VaccinationBadge(dog: dog.vaccinationStatus)
                        NavigationLink(value: DogRoute.vaccination(dog.dogId, dog.name)) {
                            HStack(spacing: 12) {
                                DogAvatar(name: dog.name, size: 44, illustrated: dog.isDefault)
                                VStack(alignment: .leading, spacing: 4) {
                                    Text(dog.name).font(.pawfit(16, .semibold)).foregroundStyle(PawFitColor.textPrimary)
                                    Text(badge == .none ? "아직 올린 서류가 없어요" : badge.chipTitle)
                                        .font(.pawfit(13.5))
                                        .foregroundStyle(badge == .verified ? PawFitColor.brand : PawFitColor.textSecondary)
                                }
                                Spacer()
                                Text(badge == .none ? "서류 올리기" : "보기")
                                    .font(.pawfit(14, .semibold)).foregroundStyle(PawFitColor.brand)
                                Image(systemName: "chevron.right").font(.system(size: 13, weight: .semibold)).foregroundStyle(PawFitColor.textTertiary)
                            }
                            .padding(16)
                            .background(Color.white, in: RoundedRectangle(cornerRadius: 18))
                            .overlay(RoundedRectangle(cornerRadius: 18).strokeBorder(PawFitColor.separator, lineWidth: 0.5))
                        }
                        .buttonStyle(.plain)
                    }
                    Text("AI 확인은 보조 수단이에요. 최종 판단은 운영자 확인을 따라요.")
                        .font(.pawfit(12.5)).foregroundStyle(PawFitColor.textSecondary).padding(.top, 8)
                }
                .padding(.horizontal, 16).padding(.top, 20)
            }
        }
        .screenBackground()
        .toolbar(.hidden, for: .navigationBar)
        .task { await store.reloadDogs() }
    }
}
