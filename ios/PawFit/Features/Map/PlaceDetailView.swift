import SwiftUI
import CoreLocation

/// UI-M-005~010 업체 상세 (입장 가능 · 준비 필요 · 입장 불가 · 조건 확인 필요 · 함께 가요)
/// 기준 반려견은 지도에서 고른 것을 그대로 따른다(상세에서는 바꾸지 않음).
struct PlaceDetailView: View {
    let placeId: String
    let onFindAgain: () -> Void

    @Environment(AppStore.self) private var store
    @Environment(\.dismiss) private var dismiss
    @Environment(\.openURL) private var openURL
    @State private var detail: PlaceDetail?
    @State private var judgments: [Int64: [ReasonCode]] = [:]
    @State private var dogVerdicts: [Int64: Verdict] = [:]
    @State private var error: String?
    @State private var showGoSheet = false
    @State private var showInfo = false
    @State private var location = LocationProvider()

    private var dogs: [DogBasisInfo] { store.basisInfo() }

    var body: some View {
        Group {
            if let detail {
                content(detail)
            } else if let error {
                VStack(spacing: 0) {
                    TopBar(title: "")
                    ErrorRetryView(message: error) { Task { await load() } }
                }
            } else {
                LoadingView()
            }
        }
        .screenBackground()
        .toolbar(.hidden, for: .navigationBar)
        .task { await load() }
        .sheet(isPresented: $showGoSheet) {
            if let detail {
                GoCheckSheet(detail: detail, dogs: dogs, judgments: judgments,
                             distance: distance(detail)) { openDirections(detail) }
            }
        }
        .sheet(isPresented: $showInfo) { InfoGuideSheet() }
    }

    private func content(_ d: PlaceDetail) -> some View {
        let verdict = d.verdict
        let sentence = VerdictSentence.make(verdict: verdict, dogs: dogs, judgments: judgments, dogVerdicts: dogVerdicts)
        let rows = ConditionTable.rows(detail: d, dogs: dogs, judgments: judgments)

        return ZStack(alignment: .top) {
            ScrollView {
                ZStack(alignment: .top) {
                    photoPlaceholder
                    VStack(alignment: .leading, spacing: 0) {
                        Text(d.name).font(.pawfit(24, .bold)).tracking(-0.5)
                        Text(subtitle(d)).font(.pawfit(14)).foregroundStyle(PawFitColor.textSecondary).padding(.top, 6)

                        verdictBand(verdict, sentence)

                        conditionTable(rows)

                        sectionTitle("운영 정보").padding(.top, 32)
                        if let address = d.address {
                            infoRow("mappin.and.ellipse", Text(address))
                        }
                        if d.isPublicData {
                            infoRow("building.columns", Text("공공데이터에 등록된 장소예요"))
                        }

                        HStack {
                            sectionTitle("정보 확인")
                            Spacer()
                            Button { showInfo = true } label: {
                                Image(systemName: "info.circle").font(.system(size: 18)).foregroundStyle(PawFitColor.iconGray)
                                    .frame(width: 44, height: 44)
                            }
                            .accessibilityLabel("정보 확인 안내")
                            .padding(.trailing, -12)
                        }
                        .padding(.top, 32)
                        Grid(alignment: .leading, horizontalSpacing: 16, verticalSpacing: 8) {
                            GridRow {
                                Text("업체 조건 확인").foregroundStyle(PawFitColor.textSecondary)
                                Text(DateText.monthDay(d.confirmedOn) ?? "아직 안 됨")
                                    .foregroundStyle(d.confirmedOn == nil ? PawFitColor.textSecondary : PawFitColor.textPrimary)
                                    .frame(maxWidth: .infinity, alignment: .trailing)
                            }
                            GridRow {
                                Text("정보 출처").foregroundStyle(PawFitColor.textSecondary)
                                Text(d.policySource ?? "확인 안 됨").multilineTextAlignment(.trailing)
                                    .frame(maxWidth: .infinity, alignment: .trailing)
                            }
                        }
                        .font(.pawfit(14))
                        .padding(.top, 4)
                    }
                    .padding(.horizontal, 20)
                    .padding(.top, 26)
                    .padding(.bottom, 40)
                    .background(PawFitColor.background, in: UnevenRoundedRectangle(topLeadingRadius: 28, topTrailingRadius: 28))
                    .padding(.top, 196)
                }
            }
            .ignoresSafeArea(edges: .top)

            Button { dismiss() } label: {
                Image(systemName: "chevron.left").font(.system(size: 19)).foregroundStyle(PawFitColor.textPrimary)
                    .frame(width: 44, height: 44)
                    .background(PawFitColor.background, in: Circle())
                    .shadow(color: PawFitColor.textPrimary.opacity(0.12), radius: 8, y: 4)
            }
            .accessibilityLabel("뒤로")
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(.leading, 12)
        }
        .safeAreaInset(edge: .bottom, spacing: 0) { bottomButtons(d) }
    }

    // MARK: 부분

    private var photoPlaceholder: some View {
        VStack(spacing: 6) {
            Image(systemName: "photo").font(.system(size: 26)).foregroundStyle(PawFitColor.textTertiary)
            Text("업체 사진").font(.pawfit(13)).foregroundStyle(PawFitColor.textSecondary)
        }
        .padding(.bottom, 20)
        .frame(maxWidth: .infinity)
        .frame(height: 220)
        .background(Color(hex: 0xE9EAEE))
    }

    private func subtitle(_ d: PlaceDetail) -> String {
        let dist = DistanceText.make(distance(d))
        if let c = MockPawFitAPI.category(of: d.placeId) { return "\(c) · \(dist)" }
        return dist
    }

    private func distance(_ d: PlaceDetail) -> Int {
        let here = location.current
        return Int(CLLocation(latitude: d.latitude, longitude: d.longitude)
            .distance(from: CLLocation(latitude: here.latitude, longitude: here.longitude)))
    }

    private func verdictBand(_ v: Verdict, _ s: (title: String, detail: String)) -> some View {
        HStack(alignment: .top, spacing: 14) {
            VerdictDot(verdict: v, size: 30).padding(.top, 1)
            VStack(alignment: .leading, spacing: 4) {
                Text(s.title).font(.pawfit(18, .semibold)).lineSpacing(2)
                Text(s.detail).font(.pawfit(14)).lineSpacing(2).foregroundStyle(Color(hex: 0x4A4A4F))
            }
            Spacer(minLength: 0)
        }
        .padding(.vertical, 18).padding(.horizontal, 20)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(v.background)
        .padding(.horizontal, -20)
        .padding(.top, 20)
        .accessibilityElement(children: .combine)
        .accessibilityLabel("\(v.title). \(s.title). \(s.detail)")
    }

    @ViewBuilder
    private func conditionTable(_ rows: [ConditionRow]) -> some View {
        let together = dogs.count > 1
        sectionTitle(dogs.isEmpty ? "업체 입장 조건" : together ? "함께 맞춰 본 조건" : "\(Josa.with(dogs[0].name)) 맞춰 본 조건")
            .padding(.top, 28).padding(.bottom, 12)
        HStack(spacing: 12) {
            Spacer().frame(width: together ? 72 : 92)
            Text("업체 기준").frame(maxWidth: .infinity, alignment: .leading)
            ForEach(dogs, id: \.dogId) { dog in
                HStack(spacing: 4) {
                    if together { DogAvatar(name: dog.name, size: 18, illustrated: store.dog(dog.dogId)?.isDefault ?? false) }
                    Text(dog.name)
                }
                .frame(width: together ? 70 : nil, alignment: .leading)
            }
        }
        .font(.pawfit(12)).foregroundStyle(PawFitColor.textSecondary)
        .frame(height: 30)
        .overlay(alignment: .bottom) { Rectangle().fill(PawFitColor.separator).frame(height: 0.5) }

        ForEach(rows) { row in
            HStack(spacing: 12) {
                Text(row.label).font(.pawfit(14)).foregroundStyle(PawFitColor.textSecondary)
                    .frame(width: together ? 72 : 92, alignment: .leading)
                Text(row.placeRule).font(.pawfit(15))
                    .foregroundStyle(row.placeRule == "알 수 없음" ? PawFitColor.textSecondary : PawFitColor.textPrimary)
                    .frame(maxWidth: .infinity, alignment: .leading)
                ForEach(Array(row.results.enumerated()), id: \.offset) { _, r in
                    ConditionResultView(result: r).frame(width: together ? 70 : nil, alignment: .leading)
                }
            }
            .frame(minHeight: 52)
            .overlay(alignment: .bottom) { Rectangle().fill(PawFitColor.separator).frame(height: 0.5) }
            .accessibilityElement(children: .combine)
        }
    }

    private func sectionTitle(_ t: String) -> some View {
        Text(t).font(.pawfit(16, .semibold)).accessibilityAddTraits(.isHeader)
    }

    private func infoRow(_ icon: String, _ text: Text) -> some View {
        HStack(spacing: 12) {
            Image(systemName: icon).font(.system(size: 17)).foregroundStyle(PawFitColor.iconGray).frame(width: 20)
            text.font(.pawfit(15))
        }
        .frame(maxWidth: .infinity, minHeight: 48, alignment: .leading)
        .overlay(alignment: .bottom) { Rectangle().fill(PawFitColor.separator).frame(height: 0.5) }
    }

    @ViewBuilder
    private func bottomButtons(_ d: PlaceDetail) -> some View {
        BottomBar(showsDivider: true) {
            switch d.verdict {
            case .entryOK, .prepare:
                HStack(spacing: 10) {
                    if let url = d.googleMapsUrl.flatMap({ URL(string: $0) }) {
                        Button { openURL(url) } label: {
                            Label("지도앱", systemImage: "map").font(.pawfit(16, .semibold))
                        }
                        .buttonStyle(SecondaryButtonStyle())
                        .frame(width: 112)
                    }
                    Button("길찾기") { showGoSheet = true }.buttonStyle(PrimaryButtonStyle())
                }
            case .noEntry:
                Button("지도에서 다시 찾기", action: onFindAgain).buttonStyle(PrimaryButtonStyle())
            case .unknown:
                Button {
                    if let url = d.googleMapsUrl.flatMap({ URL(string: $0) }) { openURL(url) }
                } label: {
                    Label("지도앱에서 업체 연락처 보기", systemImage: "phone").font(.pawfit(16, .semibold))
                }
                .buttonStyle(SecondaryButtonStyle())
            }
        }
    }

    // MARK: 동작

    private func load() async {
        error = nil
        do {
            let ids = store.basisDogIds
            async let detailCall = store.api.placeDetail(placeId, dogIds: ids)
            if !ids.isEmpty {
                let j = try await store.api.judge(placeId, dogIds: ids)
                judgments = Dictionary(uniqueKeysWithValues: j.dogs.map { ($0.dogId, ReasonCode.parse($0.reasons)) })
                dogVerdicts = Dictionary(uniqueKeysWithValues: j.dogs.map { ($0.dogId, $0.verdict) })
            }
            detail = try await detailCall
        } catch {
            self.error = APIError.message(error)
        }
    }

    /// 네이버 지도 앱 → 없으면 Google 지도 링크 → Apple 지도
    private func openDirections(_ d: PlaceDetail) {
        let name = d.name.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? ""
        if let naver = URL(string: "nmap://route/walk?dlat=\(d.latitude)&dlng=\(d.longitude)&dname=\(name)&appname=com.advancedswiftly.pawfit"),
           UIApplication.shared.canOpenURL(naver) {
            openURL(naver)
        } else if let g = d.googleMapsUrl.flatMap({ URL(string: $0) }) {
            openURL(g)
        } else if let apple = URL(string: "http://maps.apple.com/?daddr=\(d.latitude),\(d.longitude)&dirflg=w") {
            openURL(apple)
        }
    }
}

struct ConditionResultView: View {
    let result: ConditionResult
    var body: some View {
        switch result {
        case .ok(let t):
            Text(t).font(.pawfit(15, .semibold)).foregroundStyle(Verdict.entryOK.text)
        case .prepare(let t):
            HStack(spacing: 5) {
                Text(t)
                Image(systemName: "exclamationmark").font(.system(size: 12, weight: .heavy)).accessibilityLabel("준비 필요")
            }
            .font(.pawfit(15, .semibold)).foregroundStyle(Verdict.prepare.text)
        case .denied(let t):
            HStack(spacing: 5) {
                Text(t)
                Image(systemName: "xmark").font(.system(size: 12, weight: .heavy)).accessibilityLabel("입장 불가")
            }
            .font(.pawfit(15, .semibold)).foregroundStyle(Verdict.noEntry.text)
        case .unknown:
            HStack(spacing: 5) {
                Text("확인 필요").foregroundStyle(PawFitColor.textSecondary)
                Image(systemName: "questionmark").font(.system(size: 12, weight: .heavy)).foregroundStyle(PawFitColor.textTertiary)
            }
            .font(.pawfit(15, .semibold))
        }
    }
}

/// 길찾기 전 확인 팝업 (가기 전에 확인해요)
struct GoCheckSheet: View {
    let detail: PlaceDetail
    let dogs: [DogBasisInfo]
    let judgments: [Int64: [ReasonCode]]
    let distance: Int
    let onGo: () -> Void
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        let bring = ConditionTable.thingsToBring(dogs: dogs, judgments: judgments)
        VStack(alignment: .leading, spacing: 0) {
            HStack(alignment: .top) {
                VStack(alignment: .leading, spacing: 6) {
                    Text("가기 전에 확인해요").font(.pawfit(22, .bold))
                    Text(dogs.isEmpty ? detail.name : "\(detail.name) · \(Josa.with(Josa.and(dogs.map(\.name)))) 함께")
                        .font(.pawfit(14)).foregroundStyle(PawFitColor.textSecondary)
                }
                Spacer()
                Button { dismiss() } label: {
                    Image(systemName: "xmark").font(.system(size: 18)).foregroundStyle(PawFitColor.iconGray).frame(width: 44, height: 44)
                }
                .accessibilityLabel("닫기")
                .padding(.trailing, -12)
            }
            .padding(.top, 24)

            Text("챙겨 갈 것").font(.pawfit(14, .semibold)).foregroundStyle(PawFitColor.textSecondary).padding(.top, 24)
            if bring.isEmpty {
                HStack(spacing: 10) {
                    Image(systemName: "checkmark").font(.system(size: 14, weight: .bold))
                    Text("따로 챙길 것 없어요")
                }
                .font(.pawfit(16, .semibold)).foregroundStyle(Verdict.entryOK.text)
                .frame(maxWidth: .infinity, minHeight: 52, alignment: .leading)
                .overlay(alignment: .bottom) { Rectangle().fill(PawFitColor.separator).frame(height: 0.5) }
            } else {
                ForEach(bring, id: \.0) { item, owners in
                    HStack(spacing: 14) {
                        Image(systemName: item.symbol).font(.system(size: 18)).foregroundStyle(Verdict.prepare.text)
                            .frame(width: 40, height: 40).background(Verdict.prepare.background, in: RoundedRectangle(cornerRadius: 12))
                        VStack(alignment: .leading, spacing: 2) {
                            HStack(spacing: 6) {
                                Text(item.title).font(.pawfit(16, .semibold))
                                if dogs.count > 1 {
                                    Text(owners.count == dogs.count ? owners.joined(separator: "·") : "\(owners.joined(separator: "·"))만")
                                        .font(.pawfit(12, .semibold)).foregroundStyle(PawFitColor.brand)
                                        .padding(.horizontal, 7).frame(height: 20).background(PawFitColor.brandTint, in: Capsule())
                                }
                            }
                            Text(item.bringNote).font(.pawfit(13.5)).foregroundStyle(PawFitColor.iconGray)
                        }
                    }
                    .frame(maxWidth: .infinity, minHeight: 68, alignment: .leading)
                    .overlay(alignment: .bottom) { Rectangle().fill(PawFitColor.separator).frame(height: 0.5) }
                }
            }

            HStack(spacing: 10) {
                Image(systemName: "figure.walk").foregroundStyle(PawFitColor.iconGray)
                Text("여기서 \(DistanceText.make(distance))")
            }
            .font(.pawfit(15)).padding(.top, 18)

            Spacer(minLength: 20)
            Button("네이버 지도로 길찾기") { dismiss(); onGo() }.buttonStyle(PrimaryButtonStyle())
        }
        .padding(.horizontal, 20)
        .padding(.bottom, 8)
        .screenBackground()
        .presentationDetents([.medium, .large])
        .presentationCornerRadius(28)
    }
}
