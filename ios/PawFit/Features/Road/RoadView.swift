import SwiftUI

/// 댕댕로드: 진행 카드 · 스탬프 10칸 · 상품 · 방문 기록 · [QR로 방문 인증하기]
struct RoadView: View {
    @Environment(AppStore.self) private var store
    @State private var event: CurrentEvent?
    @State private var detail: EventDetail?
    @State private var stamps: StampStatus?
    @State private var storeNames: [Int64: String] = [:]
    @State private var visits: [Visit] = []
    @State private var entry: DrawEntry?
    @State private var loading = true
    @State private var showScan = false
    @State private var stampResult: StampResult?
    @State private var showDraw = false
    @State private var showDrawDone = false
    @State private var message: String?

    private var count: Int { stamps?.stampCount ?? 0 }
    private var max: Int { stamps?.maxStampCount ?? 10 }

    var body: some View {
        VStack(spacing: 0) {
            TopBar(title: "댕댕로드")
            if loading {
                LoadingView()
            } else if let event {
                ScrollView {
                    VStack(alignment: .leading, spacing: 0) {
                        hero(event)
                        stampGrid
                        prizes
                        visitList
                    }
                    .padding(.bottom, 24)
                }
                .refreshable { await load() }
            } else {
                VStack(spacing: 10) {
                    Image(systemName: "pawprint").font(.system(size: 30)).foregroundStyle(PawFitColor.textTertiary)
                    Text("지금 진행 중인 댕댕로드가 없어요").font(.pawfit(16, .semibold))
                    Text("새 댕댕로드가 열리면 알려드릴게요").font(.pawfit(14)).foregroundStyle(PawFitColor.textSecondary)
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
            }
        }
        .safeAreaInset(edge: .bottom, spacing: 0) {
            if event != nil {
                VStack(spacing: 0) {
                    if count >= max && entry == nil {
                        Button { showDraw = true } label: { Label("상품 추첨 응모하기", systemImage: "gift") }
                            .buttonStyle(PrimaryButtonStyle(fontSize: 16))
                    } else {
                        Button { showScan = true } label: { Label("QR로 방문 인증하기", systemImage: "qrcode.viewfinder") }
                            .buttonStyle(PrimaryButtonStyle(fontSize: 16))
                    }
                }
                .padding(.horizontal, 16).padding(.vertical, 12)
                .background(PawFitColor.background)
            }
        }
        .screenBackground()
        .toolbar(.hidden, for: .navigationBar)
        .fullScreenCover(isPresented: $showScan) {
            QrScanView { token in
                showScan = false
                Task { await verify(token) }
            }
        }
        .fullScreenCover(item: $stampResult) { result in
            StampView(result: result, regionTitle: event?.title ?? "댕댕로드") {
                stampResult = nil
                if result.count >= result.max && entry == nil {
                    Task { try? await Task.sleep(for: .milliseconds(450)); showDraw = true }
                }
            }
        }
        .fullScreenCover(isPresented: $showDraw) {
            if let event {
                DrawReadyView(event: event, detail: detail, count: count, max: max) { created in
                    showDraw = false
                    if created {
                        Task {
                            await load()
                            try? await Task.sleep(for: .milliseconds(450))
                            showDrawDone = true
                        }
                    }
                }
                .environment(store)
            }
        }
        .fullScreenCover(isPresented: $showDrawDone) {
            DrawDoneView(detail: detail, count: count, max: max) { showDrawDone = false }
        }
        .toast($message)
        .task { await load() }
    }

    // MARK: 진행 카드

    private func hero(_ event: CurrentEvent) -> some View {
        VStack(alignment: .leading, spacing: 0) {
            Text(event.title).font(.pawfit(21, .bold)).accessibilityAddTraits(.isHeader)
            if let detail {
                let left = DateText.daysLeft(until: detail.endsOn)
                Text("\(DateText.monthDay(detail.startsOn) ?? "") ~ \(DateText.monthDay(detail.endsOn) ?? "")"
                     + (left.map { $0 >= 0 ? " · \($0)일 남음" : " · 마감" } ?? ""))
                    .font(.pawfit(13.5)).foregroundStyle(Color(hex: 0xD6D2EA)).padding(.top, 6)
            }
            HStack(alignment: .lastTextBaseline, spacing: 6) {
                Text("\(count)").font(.pawfit(34, .bold))
                Text("/ \(max)곳 방문").font(.pawfit(15)).foregroundStyle(Color(hex: 0xD6D2EA))
            }
            .padding(.top, 14)
            ProgressBar(value: Double(count) / Double(Swift.max(max, 1)), height: 8,
                        track: .white.opacity(0.18), fill: .white)
                .padding(.top, 8)
            Label(statusText, systemImage: entry != nil ? "checkmark.seal" : "gift")
                .font(.pawfit(14)).padding(.top, 14)
        }
        .foregroundStyle(.white)
        .padding(.horizontal, 20).padding(.top, 22).padding(.bottom, 20)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(PawFitColor.brand, in: RoundedRectangle(cornerRadius: 24))
        .accessibilityElement(children: .combine)
        .accessibilityLabel("\(event.title), \(max)곳 중 \(count)곳 방문. \(statusText)")
        .padding(.horizontal, 16).padding(.top, 16)
    }

    private var statusText: String {
        if let entry {
            switch entry.status {
            case .won: return "당첨됐어요! \(entry.prize?.name ?? "")"
            case .notSelected: return "이번 추첨에는 당첨되지 않았어요"
            default: return "상품 추첨에 응모했어요"
            }
        }
        return count >= max ? "모두 모았어요! 상품 추첨에 응모하세요" : "\(max - count)곳 더 모으면 상품 추첨에 응모할 수 있어요"
    }

    // MARK: 스탬프

    private var stampGrid: some View {
        let awarded = (stamps?.stores ?? []).filter(\.awarded)
        let columns = Array(repeating: GridItem(.flexible(), spacing: 6), count: 5)
        return VStack(alignment: .leading, spacing: 14) {
            Text("스탬프").font(.pawfit(16, .semibold)).padding(.horizontal, 4).accessibilityAddTraits(.isHeader)
            LazyVGrid(columns: columns, spacing: 14) {
                ForEach(0..<max, id: \.self) { i in
                    VStack(spacing: 6) {
                        if i < awarded.count {
                            Image(systemName: "pawprint.fill").font(.system(size: 22)).foregroundStyle(.white)
                                .frame(width: 56, height: 56).background(PawFitColor.brand, in: Circle())
                            Text(storeNames[awarded[i].storeId] ?? "방문 \(i + 1)").font(.pawfit(12, .semibold)).lineLimit(1)
                        } else if i == max - 1 {
                            Image(systemName: "gift").font(.system(size: 20)).foregroundStyle(PawFitColor.brand)
                                .frame(width: 56, height: 56)
                                .background(PawFitColor.brandTint, in: Circle())
                                .overlay(Circle().strokeBorder(PawFitColor.brand, style: StrokeStyle(lineWidth: 1.5, dash: [4, 3])))
                            Text("응모").font(.pawfit(12, .semibold)).foregroundStyle(PawFitColor.brand)
                        } else {
                            Text("\(i + 1)").font(.pawfit(15, .semibold)).foregroundStyle(Color(hex: 0x8E8E93))
                                .frame(width: 56, height: 56)
                                .overlay(Circle().strokeBorder(Color(hex: 0xC7C7CC), style: StrokeStyle(lineWidth: 1.5, dash: [4, 3])))
                            Text(" ").font(.pawfit(12))
                        }
                    }
                    .accessibilityElement(children: .combine)
                    .accessibilityLabel(i < awarded.count ? "스탬프 \(i + 1), \(storeNames[awarded[i].storeId] ?? "방문 완료")" : "스탬프 \(i + 1), 아직 없음")
                }
            }
        }
        .padding(.horizontal, 16).padding(.top, 28)
    }

    // MARK: 상품

    private var prizes: some View {
        let list = (detail?.prizes ?? []).sorted { $0.rank < $1.rank }
        return Group {
            if !list.isEmpty {
                VStack(alignment: .leading, spacing: 0) {
                    Text("\(max)곳 모으면 · 상품 추첨 응모 1회").font(.pawfit(13, .semibold)).foregroundStyle(PawFitColor.brand)
                    Text(prizeHeadline(list)).font(.pawfit(19, .bold)).padding(.top, 6)
                    LazyVGrid(columns: [GridItem(.flexible(), spacing: 8), GridItem(.flexible(), spacing: 8)], spacing: 8) {
                        ForEach(Array(list.enumerated()), id: \.element) { i, prize in
                            let top = i == 0
                            HStack(spacing: 10) {
                                Image(systemName: prizeIcon(prize.name)).font(.system(size: 20))
                                    .foregroundStyle(top ? .white : PawFitColor.brand)
                                VStack(alignment: .leading, spacing: 2) {
                                    Text(prize.name).font(.pawfit(15, .semibold)).lineLimit(1).minimumScaleFactor(0.85)
                                    Text("\(prize.quantity)명").font(.pawfit(12))
                                        .foregroundStyle(top ? Color(hex: 0xD6D2EA) : PawFitColor.textSecondary)
                                }
                                Spacer(minLength: 0)
                            }
                            .foregroundStyle(top ? .white : PawFitColor.textPrimary)
                            .padding(.horizontal, 12).padding(.top, 14).padding(.bottom, 12)
                            .background(top ? PawFitColor.brand : PawFitColor.surfaceNeutral, in: RoundedRectangle(cornerRadius: 16))
                            .overlay(alignment: .topTrailing) {
                                if top {
                                    Text("최고 상품").font(.pawfit(11, .bold)).foregroundStyle(PawFitColor.brand)
                                        .padding(.horizontal, 7).frame(height: 20).background(.white, in: Capsule())
                                        .padding(8)
                                }
                            }
                        }
                    }
                    .padding(.top, 16)
                }
                .padding(.horizontal, 20).padding(.top, 28)
            }
        }
    }

    private func prizeHeadline(_ list: [EventDetail.Prize]) -> String {
        guard let top = list.first, let last = list.last, list.count > 1 else { return list.first?.name ?? "" }
        return "\(last.name)부터\n\(top.name)까지"
    }

    private func prizeIcon(_ name: String) -> String {
        if name.contains("유모차") { return "stroller" }
        if name.contains("커피") { return "cup.and.saucer" }
        if name.contains("쿠폰") { return "ticket" }
        return "gift"
    }

    // MARK: 방문 기록

    private var visitList: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("방문 기록").font(.pawfit(16, .semibold)).padding(.horizontal, 4).accessibilityAddTraits(.isHeader)
            if visits.isEmpty {
                Text("아직 방문 기록이 없어요. 참여 매장에서 QR을 찍어 보세요.")
                    .font(.pawfit(14)).foregroundStyle(PawFitColor.textSecondary)
                    .padding(16).frame(maxWidth: .infinity, alignment: .leading)
                    .background(Color.white, in: RoundedRectangle(cornerRadius: 18))
            } else {
                VStack(spacing: 0) {
                    ForEach(Array(visits.enumerated()), id: \.element.id) { i, visit in
                        HStack(spacing: 14) {
                            Text("\(visits.count - i)").font(.pawfit(17, .bold)).foregroundStyle(PawFitColor.brand).frame(width: 30)
                            VStack(alignment: .leading, spacing: 2) {
                                Text(visit.storeName).font(.pawfit(15, .semibold))
                                Text("\(RoadText.visitDay(visit.visitedAt)) 방문 · QR 인증").font(.pawfit(13)).foregroundStyle(PawFitColor.textSecondary)
                            }
                            Spacer()
                        }
                        .frame(height: 64)
                        .overlay(alignment: .bottom) {
                            if i < visits.count - 1 { Rectangle().fill(PawFitColor.separator).frame(height: 0.5) }
                        }
                    }
                }
                .padding(.leading, 14).padding(.trailing, 16)
                .background(Color.white, in: RoundedRectangle(cornerRadius: 18))
                .overlay(RoundedRectangle(cornerRadius: 18).strokeBorder(PawFitColor.separator, lineWidth: 0.5))
            }
        }
        .padding(.horizontal, 16).padding(.top, 28)
    }

    // MARK: 동작

    private func load() async {
        defer { loading = false }
        guard let current = try? await store.api.currentEvent() else { event = nil; return }
        event = current
        async let d = store.api.event(current.eventId)
        async let s = store.api.stamps(eventId: current.eventId)
        async let names = store.api.eventStores(eventId: current.eventId)
        async let v = store.api.visits()
        async let e = store.api.drawEntry(eventId: current.eventId)
        detail = try? await d
        stamps = try? await s
        storeNames = Dictionary(((try? await names) ?? []).map { ($0.storeId, $0.name) }, uniquingKeysWith: { a, _ in a })
        visits = (try? await v) ?? []
        entry = (try? await e) ?? nil
    }

    private func verify(_ token: String) async {
        do {
            let result = try await store.api.visitQR(token: token, dogIds: store.basisDogIds)
            await load()
            let name = storeNames[result.storeId] ?? visits.first?.storeName ?? "매장"
            stampResult = StampResult(storeName: name, awarded: result.stampAwarded, count: result.stampCount, max: max)
        } catch {
            message = APIError.message(error)
        }
    }
}

struct StampResult: Identifiable {
    let id = UUID()
    let storeName: String
    let awarded: Bool
    let count: Int
    let max: Int
}

extension RoadText {
    /// "2026-10-16T…" → "10월 16일(금)"
    static func visitDay(_ text: String) -> String {
        guard let date = DateText.instant(text) ?? DateText.day(String(text.prefix(10))) else { return text }
        let f = DateFormatter()
        f.locale = Locale(identifier: "ko_KR")
        f.timeZone = TimeZone(identifier: "Asia/Seoul")
        f.dateFormat = "M월 d일(E)"
        return f.string(from: date)
    }
}

// MARK: - 스탬프 찍힘

struct StampView: View {
    let result: StampResult
    let regionTitle: String
    let onClose: () -> Void

    @State private var appeared = false

    var body: some View {
        VStack(spacing: 0) {
            TopBar(title: "", leading: .close, onLeading: onClose)
            Spacer(minLength: 20)
            ZStack {
                Circle().fill(.white)
                Circle().strokeBorder(PawFitColor.brand, lineWidth: 4)
                Circle().strokeBorder(PawFitColor.brand, style: StrokeStyle(lineWidth: 1.5, dash: [5, 4])).padding(11)
                VStack(spacing: 4) {
                    Image(systemName: result.awarded ? "pawprint.fill" : "checkmark").font(.system(size: 30))
                    Text(result.storeName).font(.pawfit(17, .bold)).lineLimit(1).minimumScaleFactor(0.7)
                    Text(Date.now.formatted(.dateTime.year().month(.twoDigits).day(.twoDigits)).replacingOccurrences(of: "/", with: "."))
                        .font(.pawfit(12.5, .semibold))
                }
                .foregroundStyle(PawFitColor.brand)
                .padding(24)
            }
            .frame(width: 168, height: 168)
            .shadow(color: PawFitColor.brand.opacity(0.18), radius: 15, y: 10)
            .rotationEffect(.degrees(appeared ? -6 : -30))
            .scaleEffect(appeared ? 1 : 1.6)
            .opacity(appeared ? 1 : 0)
            .accessibilityElement(children: .ignore)
            .accessibilityLabel("\(result.storeName) 스탬프")

            Text(result.awarded ? "스탬프를 찍었어요" : "이미 스탬프를 받은 매장이에요")
                .font(.pawfit(26, .bold)).multilineTextAlignment(.center).padding(.top, 36)
            Text(result.awarded ? "\(result.storeName) 방문이 인증됐어요" : "방문 기록은 남겼어요. 다른 참여 매장에서 모아 보세요.")
                .font(.pawfit(15)).foregroundStyle(PawFitColor.iconGray).multilineTextAlignment(.center).padding(.top, 8)

            VStack(alignment: .leading, spacing: 0) {
                HStack(alignment: .lastTextBaseline) {
                    Text(regionTitle.components(separatedBy: " 방문").first ?? regionTitle).font(.pawfit(15, .semibold))
                    Spacer()
                    (Text("\(result.count)").font(.pawfit(18, .bold)).foregroundColor(PawFitColor.brand)
                     + Text(" / \(result.max)곳").font(.pawfit(14)).foregroundColor(PawFitColor.textSecondary))
                }
                ProgressBar(value: Double(result.count) / Double(max(result.max, 1)), height: 8).padding(.top, 10)
                if result.count < result.max {
                    (Text("\(result.max - result.count)곳 더 모으면 ").foregroundColor(PawFitColor.iconGray)
                     + Text("상품 추첨에 응모할 수 있어요").fontWeight(.semibold))
                        .font(.pawfit(14)).padding(.top, 14)
                } else {
                    Text("모두 모았어요! 이제 상품 추첨에 응모할 수 있어요").font(.pawfit(14, .semibold)).foregroundStyle(PawFitColor.brand).padding(.top, 14)
                }
            }
            .padding(.horizontal, 24).padding(.top, 32)
            Spacer()
            BottomBar {
                Button(result.count >= result.max ? "응모하러 가기" : "댕댕로드 보기", action: onClose).buttonStyle(PrimaryButtonStyle())
            }
        }
        .screenBackground()
        .sensoryFeedback(.success, trigger: appeared)
        .onAppear { withAnimation(.spring(response: 0.45, dampingFraction: 0.6).delay(0.15)) { appeared = true } }
    }
}

// MARK: - 추첨 응모

struct DrawReadyView: View {
    let event: CurrentEvent
    let detail: EventDetail?
    let count: Int
    let max: Int
    let onFinish: (_ entered: Bool) -> Void

    @Environment(AppStore.self) private var store
    @AppStorage("pawfit.shippingAddress") private var address = ""
    @State private var agreed = false
    @State private var editingAddress = false
    @State private var busy = false
    @State private var message: String?
    @State private var phone = ""

    var body: some View {
        VStack(spacing: 0) {
            TopBar(title: "", leading: .close, onLeading: { onFinish(false) })
            ScrollView {
                VStack(alignment: .leading, spacing: 0) {
                    LazyVGrid(columns: Array(repeating: GridItem(.fixed(40), spacing: 15), count: 5), spacing: 15) {
                        ForEach(0..<Swift.max(max, 1), id: \.self) { _ in
                            Image(systemName: "pawprint.fill").font(.system(size: 16)).foregroundStyle(.white)
                                .frame(width: 40, height: 40).background(PawFitColor.brand, in: Circle())
                        }
                    }
                    .frame(maxWidth: .infinity)
                    .padding(.top, 40)
                    .accessibilityElement().accessibilityLabel("스탬프 \(max)개 모두 모음")

                    Text("\(RoadText.region(event.title)) 댕댕로드 \(count) / \(max)").font(.pawfit(14, .semibold)).foregroundStyle(PawFitColor.brand)
                        .padding(.top, 36)
                    Text("\(max)곳을 모두 모았어요\n상품 추첨에 응모하세요").font(.pawfit(26, .bold)).lineSpacing(2).padding(.top, 8)

                    if let prizes = detail?.prizes, !prizes.isEmpty {
                        Text("당첨될 수 있는 상품").font(.pawfit(14, .semibold)).foregroundStyle(PawFitColor.textSecondary).padding(.top, 28)
                        FlowLayout(spacing: 6) {
                            ForEach(Array(prizes.sorted { $0.rank < $1.rank }.enumerated()), id: \.element) { i, p in
                                Text(p.name).font(.pawfit(13.5, .semibold))
                                    .foregroundStyle(i == 0 ? .white : PawFitColor.textPrimary)
                                    .padding(.horizontal, 12).frame(height: 30)
                                    .background(i == 0 ? PawFitColor.brand : PawFitColor.surfaceNeutral, in: Capsule())
                            }
                        }
                        .padding(.top, 12)
                    }

                    VStack(alignment: .leading, spacing: 0) {
                        infoRow("연락처", PhoneRule.format(phone)) {}
                        Rectangle().fill(PawFitColor.separator).frame(height: 0.5)
                        infoRow("배송지", address.isEmpty ? "등록해 주세요" : address) { editingAddress = true }
                    }
                    .padding(.horizontal, 16)
                    .background(Color.white, in: RoundedRectangle(cornerRadius: 18))
                    .overlay(RoundedRectangle(cornerRadius: 18).strokeBorder(PawFitColor.separator, lineWidth: 0.5))
                    .padding(.top, 28)

                    Toggle(isOn: $agreed) {
                        Text("당첨 시 상품 발송을 위한 연락처·배송지 수집에 동의해요 (필수)").font(.pawfit(14))
                    }
                    .toggleStyle(CheckToggleStyle())
                    .padding(.top, 14)
                }
                .padding(.horizontal, 24).padding(.bottom, 24)
            }
        }
        .safeAreaInset(edge: .bottom, spacing: 0) {
            BottomBar {
                if let end = DateText.monthDay(detail?.endsOn) {
                    Text("\(end)까지 응모할 수 있어요").font(.pawfit(13)).foregroundStyle(PawFitColor.textSecondary)
                }
                Button { Task { await enter() } } label: { if busy { ProgressView().tint(.white) } else { Text("응모하기") } }
                    .buttonStyle(PrimaryButtonStyle())
                    .disabled(!agreed || address.isEmpty || phone.isEmpty || busy)
                Button("나중에 할게요") { onFinish(false) }
                    .font(.pawfit(15, .semibold)).foregroundStyle(PawFitColor.iconGray).frame(minHeight: 44)
            }
        }
        .screenBackground()
        .sheet(isPresented: $editingAddress) { AddressSheet(address: $address) }
        .toast($message)
        .task { phone = (try? await store.api.me())?.phoneNumber ?? "" }
    }

    private func infoRow(_ label: String, _ value: String, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            HStack(spacing: 10) {
                Text(label).font(.pawfit(15)).foregroundStyle(PawFitColor.iconGray).frame(width: 56, alignment: .leading)
                Text(value).font(.pawfit(15)).foregroundStyle(PawFitColor.textPrimary).multilineTextAlignment(.leading)
                Spacer(minLength: 0)
                if label == "배송지" {
                    Image(systemName: "chevron.right").font(.system(size: 13, weight: .semibold)).foregroundStyle(PawFitColor.textTertiary)
                }
            }
            .frame(minHeight: 54)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .disabled(label != "배송지")
    }

    private func enter() async {
        busy = true; defer { busy = false }
        do {
            _ = try await store.api.enterDraw(eventId: event.eventId,
                                              DrawEntryRequest(phoneNumber: PhoneRule.digits(phone), address: address, privacyAgreed: agreed))
            onFinish(true)
        } catch {
            message = APIError.message(error)
        }
    }
}

/// 동그라미 체크 (약관 · 동의)
struct CheckToggleStyle: ToggleStyle {
    func makeBody(configuration: Configuration) -> some View {
        Button { configuration.isOn.toggle() } label: {
            HStack(alignment: .top, spacing: 10) {
                Image(systemName: configuration.isOn ? "checkmark.circle.fill" : "circle")
                    .font(.system(size: 22)).foregroundStyle(configuration.isOn ? PawFitColor.brand : PawFitColor.textTertiary)
                configuration.label.foregroundStyle(PawFitColor.textPrimary).multilineTextAlignment(.leading)
                Spacer(minLength: 0)
            }
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityAddTraits(configuration.isOn ? .isSelected : [])
    }
}

struct DrawDoneView: View {
    let detail: EventDetail?
    let count: Int
    let max: Int
    let onClose: () -> Void

    var body: some View {
        VStack(spacing: 0) {
            TopBar(title: "", leading: .close, onLeading: onClose)
            Spacer(minLength: 20)
            ZStack(alignment: .leading) {
                RoundedRectangle(cornerRadius: 16).fill(PawFitColor.brand)
                VStack(alignment: .leading, spacing: 4) {
                    Text("댕댕로드").font(.pawfit(12)).foregroundStyle(Color(hex: 0xD6D2EA))
                    Text("응모 완료").font(.pawfit(22, .bold)).foregroundStyle(.white)
                    Text("\(count) / \(max)곳").font(.pawfit(12)).foregroundStyle(Color(hex: 0xD6D2EA)).padding(.top, 2)
                }
                .padding(.leading, 22)
                Image(systemName: "checkmark").font(.system(size: 14, weight: .bold)).foregroundStyle(PawFitColor.brand)
                    .frame(width: 30, height: 30).background(.white, in: Circle())
                    .offset(x: 150)
            }
            .frame(width: 200, height: 112)
            .accessibilityElement().accessibilityLabel("응모권")

            Text("응모했어요").font(.pawfit(26, .bold)).padding(.top, 32)
            Text("기간이 끝나면 추첨해서 결과를 알려드릴게요").font(.pawfit(15)).foregroundStyle(PawFitColor.iconGray).padding(.top, 8)

            VStack(spacing: 0) {
                row("응모 마감", DateText.monthDay(detail?.endsOn) ?? "기간 마지막 날")
                row("당첨자 발표", "기간 종료 후 · 앱 알림")
                Text(detail?.notice ?? "당첨 시 등록한 연락처로 따로 연락드려요. 상품은 등록된 배송지로 보내드려요.")
                    .font(.pawfit(15)).lineSpacing(3)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(.vertical, 14)
            }
            .padding(.horizontal, 24).padding(.top, 32)
            Spacer()
            BottomBar { Button("댕댕로드 보기", action: onClose).buttonStyle(PrimaryButtonStyle()) }
        }
        .screenBackground()
    }

    private func row(_ label: String, _ value: String) -> some View {
        HStack(spacing: 12) {
            Text(label).font(.pawfit(14.5)).foregroundStyle(PawFitColor.iconGray)
            Spacer()
            Text(value).font(.pawfit(15, .semibold))
        }
        .frame(minHeight: 52)
        .overlay(alignment: .bottom) { Rectangle().fill(PawFitColor.separator).frame(height: 0.5) }
    }
}
