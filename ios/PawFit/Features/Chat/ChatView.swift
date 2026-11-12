import SwiftUI
import CoreLocation

/// 챗봇 탭 (댕댕 도우미): 예시 질문 → 대화 → 매장 카드 [지도에서 보기] · 이어서 물어볼 칩
/// 서버 POST /chat/sessions/{id}/messages 는 답변 글과 장소 목록(placeId · verdict)을 준다.
/// 카드에 이름 · 조건을 보여주려고 장소마다 상세(GET /places/{id})와 반려견별 판정을 한 번 더 부른다.
struct ChatView: View {
    let openMapPlace: (String) -> Void

    @Environment(AppStore.self) private var store
    @State private var messages: [ChatMessage] = []
    @State private var sessionId: Int64?
    @State private var input = ""
    @State private var sending = false
    @State private var location = LocationProvider()
    @State private var message: String?
    @State private var editDogId: Int64?
    @FocusState private var focused: Bool

    var body: some View {
        VStack(spacing: 0) {
            TopBar(title: "댕댕 도우미", leading: .none)
                .overlay(alignment: .bottom) { Rectangle().fill(PawFitColor.separator).frame(height: 0.5) }

            if messages.isEmpty {
                ScrollView { emptyState }.scrollDismissesKeyboard(.interactively)
            } else {
                conversation
            }
        }
        .safeAreaInset(edge: .bottom, spacing: 0) {
            VStack(spacing: 0) {
                if !sending, let chips = messages.last?.followUps, !chips.isEmpty {
                    ScrollView(.horizontal, showsIndicators: false) {
                        HStack(spacing: 8) {
                            ForEach(chips, id: \.self) { chip in
                                Button { tapChip(chip) } label: {
                                    Text(chip).font(.pawfit(14)).foregroundStyle(PawFitColor.textPrimary)
                                        .padding(.horizontal, 14).frame(height: 36)
                                        .background(Color.white, in: Capsule())
                                        .overlay(Capsule().strokeBorder(PawFitColor.separator))
                                }
                            }
                        }
                        .padding(.horizontal, 16)
                    }
                    .frame(height: 48)
                }
                inputBar
            }
            .background(PawFitColor.background)
        }
        .screenBackground()
        .toolbar(.hidden, for: .navigationBar)
        .dogRoutes()
        .navigationDestination(item: $editDogId) { DogEditView(dogId: $0).hidesTabBar() }
        .onChange(of: focused) { store.tabBarHiders = max(0, store.tabBarHiders + (focused ? 1 : -1)) }
        .toast($message)
        .onAppear { location.request() }
    }

    // MARK: 빈 화면 (예시 질문)

    private var emptyState: some View {
        let dogs = store.dogs.map(\.name)
        let first = dogs.first ?? "몽이"
        let second = dogs.count > 1 ? dogs[1] : first
        return VStack(alignment: .leading, spacing: 0) {
            VStack(alignment: .leading, spacing: 0) {
                Image(systemName: "bubble.left.and.text.bubble.right")
                    .font(.system(size: 22)).foregroundStyle(PawFitColor.brand)
                    .frame(width: 52, height: 52).background(PawFitColor.brandTint, in: Circle())
                Text("궁금한 것을 물어보세요").font(.pawfit(24, .bold)).padding(.top, 20)
            }
            .padding(.horizontal, 24).padding(.top, 40)

            exampleGroup("매장 입장 확인", badge: nil, [
                "FF카페에 \(second) 데려가도 돼?",
                dogs.count > 1 ? "AA카페에 \(Josa.with(first)) \(second) 같이 가도 돼?" : "AA카페에 \(first) 데려가도 돼?",
            ])
            exampleGroup("동반 가능한 곳 찾기", badge: "공공데이터", [
                "강릉에 반려견이랑 묵을 숙소 있어?",
                "성동구에 동반 출입 신고된 카페 알려줘",
                "제주 반려견 동반 관광지 추천해줘",
            ])
        }
        .padding(.bottom, 24)
    }

    private func exampleGroup(_ title: String, badge: String?, _ items: [String]) -> some View {
        VStack(alignment: .leading, spacing: 0) {
            HStack(spacing: 6) {
                Text(title).font(.pawfit(14, .semibold)).foregroundStyle(PawFitColor.textSecondary)
                if let badge {
                    Text(badge).font(.pawfit(12, .semibold)).foregroundStyle(PawFitColor.iconGray)
                        .padding(.horizontal, 7).frame(height: 20).background(PawFitColor.surfaceNeutral, in: Capsule())
                }
            }
            .padding(.horizontal, 6).padding(.bottom, 8)
            .accessibilityAddTraits(.isHeader)
            ForEach(items, id: \.self) { q in
                Button { send(q) } label: {
                    HStack(spacing: 10) {
                        Text(q).font(.pawfit(15)).foregroundStyle(PawFitColor.textPrimary).multilineTextAlignment(.leading)
                        Spacer(minLength: 0)
                        Image(systemName: "arrow.up.left").font(.system(size: 14)).foregroundStyle(PawFitColor.textTertiary)
                    }
                    .padding(.horizontal, 6).frame(minHeight: 52)
                    .overlay(alignment: .bottom) { Rectangle().fill(PawFitColor.separator).frame(height: 0.5) }
                    .contentShape(Rectangle())
                }
            }
        }
        .padding(.horizontal, 16).padding(.top, 28)
    }

    // MARK: 대화

    private var conversation: some View {
        ScrollViewReader { proxy in
            ScrollView {
                LazyVStack(spacing: 12) {
                    ForEach(messages) { m in
                        switch m.role {
                        case .user:
                            Text(m.text)
                                .font(.pawfit(15)).foregroundStyle(.white)
                                .padding(.horizontal, 16).padding(.vertical, 11)
                                .background(PawFitColor.brand, in: UnevenRoundedRectangle(
                                    topLeadingRadius: 20, bottomLeadingRadius: 20, bottomTrailingRadius: 6, topTrailingRadius: 20))
                                .frame(maxWidth: 300, alignment: .trailing)
                                .frame(maxWidth: .infinity, alignment: .trailing)
                        case .assistant:
                            AssistantBubble(message: m, openMapPlace: openMapPlace)
                                .frame(maxWidth: .infinity, alignment: .leading)
                        }
                    }
                    if sending {
                        HStack(spacing: 8) {
                            ProgressView().tint(PawFitColor.brand)
                            Text("확인하고 있어요").font(.pawfit(14)).foregroundStyle(PawFitColor.textSecondary)
                        }
                        .padding(.horizontal, 16).padding(.vertical, 12)
                        .background(Color.white, in: RoundedRectangle(cornerRadius: 20))
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .id("typing")
                    }
                    Color.clear.frame(height: 1).id("bottom")
                }
                .padding(.horizontal, 16).padding(.vertical, 14)
            }
            .scrollDismissesKeyboard(.interactively)
            .onChange(of: messages.count) { withAnimation { proxy.scrollTo("bottom", anchor: .bottom) } }
            .onChange(of: sending) { withAnimation { proxy.scrollTo("bottom", anchor: .bottom) } }
        }
    }

    private var inputBar: some View {
        let canSend = !input.trimmingCharacters(in: .whitespaces).isEmpty && !sending
        return HStack(spacing: 8) {
            TextField("", text: $input, prompt: Text("매장 이름이나 지역과 함께 물어보세요").foregroundStyle(PawFitColor.textTertiary))
                .font(.pawfit(15))
                .focused($focused)
                .submitLabel(.send)
                .onSubmit { if canSend { send(input) } }
                .padding(.horizontal, 18).frame(height: 44)
                .background(Color.white, in: Capsule())
                .overlay(Capsule().strokeBorder(focused ? PawFitColor.brand : PawFitColor.separator))
                .accessibilityLabel("메시지")
            Button { send(input) } label: {
                Image(systemName: "arrow.up").font(.system(size: 18, weight: .semibold))
                    .foregroundStyle(canSend ? .white : PawFitColor.textTertiary)
                    .frame(width: 44, height: 44)
                    .background(canSend ? PawFitColor.brand : PawFitColor.surfaceNeutral, in: Circle())
            }
            .disabled(!canSend)
            .accessibilityLabel("보내기")
        }
        .padding(.horizontal, 12).padding(.top, 8).padding(.bottom, 10)
        .tint(PawFitColor.brand)
    }

    // MARK: 보내기

    /// "콩이 프로필에 유모차 추가" 칩은 반려견 정보 수정 화면으로, 나머지는 질문으로 보낸다
    private func tapChip(_ chip: String) {
        if chip.contains("프로필에"), let dog = store.dogs.first(where: { chip.hasPrefix($0.name + " ") }) {
            focused = false
            editDogId = dog.dogId
        } else {
            send(chip)
        }
    }

    private func send(_ raw: String) {
        let text = raw.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !text.isEmpty, !sending else { return }
        input = ""
        messages.append(ChatMessage(role: .user, text: text))
        sending = true
        Task {
            defer { sending = false }
            do {
                if sessionId == nil { sessionId = try await store.api.createChatSession().sessionId }
                guard let sessionId else { return }
                let named = store.dogs.filter { text.contains($0.name) }
                let dogs = named.isEmpty ? store.basisDogs : named
                let here = location.current
                let sent = try await store.api.sendChat(sessionId: sessionId, ChatSendRequest(
                    content: text, selectedDogIds: dogs.map(\.dogId),
                    latitude: here.latitude, longitude: here.longitude))
                let cards = await loadCards(sent.assistantMessage.places ?? [], dogs: dogs)
                var reply = ChatMessage(role: .assistant, text: sent.assistantMessage.content, cards: cards)
                reply.followUps = followUps(question: text, cards: cards)
                messages.append(reply)
            } catch {
                messages.append(ChatMessage(role: .assistant, text: APIError.message(error), failed: true))
            }
        }
    }

    /// 답변에 나온 장소마다 상세 · 반려견별 판정을 불러 카드로 만든다
    private func loadCards(_ refs: [ChatPlaceRef], dogs: [DogDetail]) async -> [ChatPlaceCard] {
        let ids = dogs.map(\.dogId)
        let infos = store.basisInfo().filter { ids.contains($0.dogId) }
        let here = location.current
        var cards: [ChatPlaceCard] = []
        for ref in refs.prefix(5) {
            guard let detail = try? await store.api.placeDetail(ref.placeId, dogIds: ids) else { continue }
            var judgments: [Int64: [ReasonCode]] = [:]
            var perDog: [EntryJudgment.DogResult] = []
            if !ids.isEmpty, !detail.isPublicData, let j = try? await store.api.judge(ref.placeId, dogIds: ids) {
                perDog = j.dogs
                for d in j.dogs { judgments[d.dogId] = ReasonCode.parse(d.reasons) }
            }
            let rows = ConditionTable.rows(detail: detail, dogs: infos, judgments: judgments)
            let distance = PlaceCard(placeId: detail.placeId, name: detail.name, latitude: detail.latitude,
                                     longitude: detail.longitude, verdict: detail.verdict).distanceM(from: here)
            cards.append(ChatPlaceCard(detail: detail, verdict: ref.verdict ?? detail.verdict, dogs: dogs,
                                       perDog: perDog, rows: rows, distanceM: distance))
        }
        return cards
    }

    /// 이어서 물어볼 칩: 빠진 준비물 → 프로필에 추가 · 함께 불가 → 함께 갈 곳 찾기 · 공공데이터 → 다른 지역
    private func followUps(question: String, cards: [ChatPlaceCard]) -> [String] {
        var chips: [String] = []
        for card in cards where !card.detail.isPublicData {
            for row in card.rows where row.results.contains(where: { $0.isMissing }) {
                if let eq = Equipment.allCases.first(where: { row.label == $0.title }),
                   let dog = card.dogs.first(where: { !$0.equipment.contains(eq) }) {
                    chips.append("\(dog.name) 프로필에 \(eq.title) 추가")
                }
            }
            if card.dogs.count > 1, card.verdict == .noEntry { chips.append("함께 갈 수 있는 카페 찾기") }
        }
        if cards.contains(where: { $0.detail.isPublicData }) || question.contains("강릉") || question.contains("제주") {
            if !question.contains("강릉") { chips.append("강릉 동반 숙소도 찾아줘") }
            if let unknown = cards.first(where: { $0.verdict == .unknown }) { chips.append("\(unknown.detail.name) 조건 알려줘") }
        }
        var seen = Set<String>()
        return chips.filter { seen.insert($0).inserted }.prefix(3).map { $0 }
    }
}

// MARK: - 모델

struct ChatMessage: Identifiable {
    enum Role { case user, assistant }
    let id = UUID()
    let role: Role
    let text: String
    var cards: [ChatPlaceCard] = []
    var failed = false
    var followUps: [String] = []
}

struct ChatPlaceCard: Identifiable {
    let detail: PlaceDetail
    let verdict: Verdict
    let dogs: [DogDetail]
    let perDog: [EntryJudgment.DogResult]
    let rows: [ConditionRow]
    let distanceM: Int
    var id: String { detail.placeId }
}

// MARK: - 답변 말풍선

private struct AssistantBubble: View {
    let message: ChatMessage
    let openMapPlace: (String) -> Void

    @Environment(AppStore.self) private var store

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            Text(message.text).font(.pawfit(15)).lineSpacing(3)
                .foregroundStyle(message.failed ? PawFitColor.errorText : PawFitColor.textPrimary)
                .fixedSize(horizontal: false, vertical: true)

            let stores = message.cards.filter { !$0.detail.isPublicData }
            let publics = message.cards.filter { $0.detail.isPublicData }

            if stores.count == 1 && publics.isEmpty, let card = stores.first {
                storeCard(card)
            } else if !message.cards.isEmpty {
                listCard(message.cards, showsSource: !publics.isEmpty)
            }
        }
        .padding(.leading, 16).padding(.trailing, 14).padding(.top, 14).padding(.bottom, message.cards.isEmpty ? 14 : 10)
        .frame(maxWidth: 326, alignment: .leading)
        .background(Color.white, in: UnevenRoundedRectangle(
            topLeadingRadius: 6, bottomLeadingRadius: 20, bottomTrailingRadius: 20, topTrailingRadius: 20))
        .overlay(UnevenRoundedRectangle(topLeadingRadius: 6, bottomLeadingRadius: 20, bottomTrailingRadius: 20, topTrailingRadius: 20)
            .strokeBorder(PawFitColor.separator, lineWidth: 0.5))
        .shadow(color: Color(hex: 0x2D2D2D, opacity: 0.06), radius: 10, y: 4)
    }

    /// 매장 한 곳: 이름 · 판정 · 기준 · 조건 줄 · 확인일 · [지도에서 보기]
    private func storeCard(_ card: ChatPlaceCard) -> some View {
        VStack(alignment: .leading, spacing: 0) {
            HStack(spacing: 8) {
                Text(card.detail.name).font(.pawfit(16, .semibold))
                VerdictPill(verdict: card.verdict)
            }
            Text(basisText(card)).font(.pawfit(13)).foregroundStyle(PawFitColor.textSecondary).padding(.top, 2)

            if card.dogs.count > 1, card.verdict == .noEntry,
               let ok = card.perDog.first(where: { $0.verdict == .entryOK || $0.verdict == .prepare }),
               let dog = card.dogs.first(where: { $0.dogId == ok.dogId }) {
                HStack(spacing: 8) {
                    Text("\(dog.name) 혼자라면").font(.pawfit(13.5))
                    VerdictPill(verdict: ok.verdict)
                }
                .padding(.vertical, 10)
                .frame(maxWidth: .infinity, alignment: .leading)
                .overlay(alignment: .top) { Rectangle().fill(PawFitColor.separator).frame(height: 0.5) }
                .padding(.top, 10)
            } else {
                let lines = conditionLines(card)
                if !lines.isEmpty {
                    VStack(alignment: .leading, spacing: 7) {
                        ForEach(lines, id: \.text) { line in
                            HStack(alignment: .firstTextBaseline, spacing: 7) {
                                Image(systemName: line.ok ? "checkmark" : "exclamationmark.circle")
                                    .font(.system(size: 12, weight: .semibold))
                                    .foregroundStyle(line.ok ? Verdict.entryOK.text : Verdict.prepare.text)
                                (Text(line.text) + Text(line.detail.map { " · \($0)" } ?? "").foregroundColor(PawFitColor.textSecondary))
                                    .font(.pawfit(13.5))
                            }
                        }
                    }
                    .padding(.vertical, 10)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .overlay(alignment: .top) { Rectangle().fill(PawFitColor.separator).frame(height: 0.5) }
                    .padding(.top, 10)
                }
            }

            footer(left: DateText.monthDay(card.detail.confirmedOn).map { "매장 정보 \($0) 확인" } ?? "매장 정보",
                   button: "지도에서 보기") { openMapPlace(card.detail.placeId) }
        }
        .padding(.top, 12)
        .overlay(alignment: .top) { Rectangle().fill(PawFitColor.separator).frame(height: 0.5) }
        .padding(.top, 12)
    }

    /// 여러 곳 (공공데이터 포함): 이름 · 동네 · 거리 · 판정 목록
    private func listCard(_ cards: [ChatPlaceCard], showsSource: Bool) -> some View {
        VStack(alignment: .leading, spacing: 0) {
            if showsSource {
                Label("공공데이터 · 동반 출입 신고 업소", systemImage: "building.columns")
                    .font(.pawfit(12.5, .semibold)).foregroundStyle(PawFitColor.iconGray).padding(.top, 12)
            }
            ForEach(Array(cards.enumerated()), id: \.element.id) { i, card in
                Button { openMapPlace(card.detail.placeId) } label: {
                    HStack(spacing: 8) {
                        VStack(alignment: .leading, spacing: 2) {
                            Text(card.detail.name).font(.pawfit(15.5, .semibold)).foregroundStyle(PawFitColor.textPrimary)
                            Text([area(card.detail.address), DistanceText.make(card.distanceM)].compactMap { $0 }.joined(separator: " · "))
                                .font(.pawfit(13)).foregroundStyle(PawFitColor.textSecondary)
                        }
                        Spacer(minLength: 4)
                        VerdictPill(verdict: card.verdict)
                    }
                    .padding(.vertical, 10)
                    .overlay(alignment: .bottom) {
                        if i < cards.count - 1 { Rectangle().fill(PawFitColor.separator).frame(height: 0.5) }
                    }
                    .contentShape(Rectangle())
                }
                .accessibilityLabel("\(card.detail.name), \(card.verdict.title), 지도에서 보기")
            }
            .padding(.top, 4)
            footer(left: showsSource ? "공공데이터 기준" : "매장 정보 기준", button: "지도에서 보기") {
                if let first = cards.first { openMapPlace(first.detail.placeId) }
            }
        }
        .padding(.top, 8)
    }

    private func footer(left: String, button: String, action: @escaping () -> Void) -> some View {
        HStack {
            Text(left).font(.pawfit(12)).foregroundStyle(PawFitColor.textSecondary)
            Spacer()
            Button(action: action) {
                HStack(spacing: 2) {
                    Text(button).font(.pawfit(13, .semibold))
                    Image(systemName: "chevron.right").font(.system(size: 11, weight: .semibold))
                }
                .foregroundStyle(PawFitColor.brand).frame(minHeight: 32)
            }
        }
        .padding(.top, 4)
    }

    private func basisText(_ card: ChatPlaceCard) -> String {
        let names = card.dogs.map(\.name)
        if names.count > 1 { return "함께 가요 기준 · " + names.joined(separator: ", ") }
        return names.first.map { "\($0) 기준" } ?? "반려견 미등록"
    }

    private struct Line { let ok: Bool; let text: String; let detail: String? }

    /// 조건 표에서 판단에 쓰인 줄만 짧게 (최대 3줄)
    private func conditionLines(_ card: ChatPlaceCard) -> [Line] {
        let name = card.dogs.first?.name ?? ""
        let lines = card.rows.compactMap { row -> Line? in
            guard let r = row.results.first,
                  row.label != "동반 여부" || r.isMissing,
                  !["제한 없음", "필요 없음"].contains(row.placeRule) else { return nil }
            let text = row.placeRule.contains(row.label) ? row.placeRule : "\(row.label) \(row.placeRule)"
            let detail: String
            switch r {
            case .prepare("없음"): detail = "\(name) 프로필에 없음"
            case .unknown: detail = "확인 필요"
            default: detail = "\(name) \(r.text)"
            }
            return Line(ok: !r.isMissing, text: text, detail: detail)
        }
        return (lines.filter { !$0.ok } + lines.filter(\.ok)).prefix(3).map { $0 }
    }

    private func area(_ address: String?) -> String? {
        guard let address else { return nil }
        let parts = address.split(separator: " ")
        return parts.first(where: { $0.hasSuffix("동") || $0.hasSuffix("가") || $0.hasSuffix("읍") || $0.hasSuffix("면") }).map(String.init)
            ?? parts.dropFirst().first.map(String.init)
    }
}

/// 흰 바탕 판정 알약 (챗봇 카드)
struct VerdictPill: View {
    let verdict: Verdict
    var body: some View {
        HStack(spacing: 5) {
            VerdictDot(verdict: verdict, size: 16)
            Text(verdict.title).font(.pawfit(12.5, .semibold)).foregroundStyle(verdict.text)
        }
        .padding(.leading, 4).padding(.trailing, 9).frame(height: 24)
        .background(Color.white, in: Capsule())
        .overlay(Capsule().strokeBorder(PawFitColor.separator))
        .accessibilityElement(children: .combine)
    }
}

extension ConditionResult {
    /// 준비가 필요하거나 맞지 않는 줄
    var isMissing: Bool {
        switch self {
        case .ok: false
        default: true
        }
    }
    var text: String {
        switch self {
        case .ok(let t), .prepare(let t), .denied(let t): t
        case .unknown: "확인 필요"
        }
    }
}
