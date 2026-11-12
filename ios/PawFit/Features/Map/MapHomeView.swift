import SwiftUI
import MapKit

/// UI-M-001 메인 지도 (캔버스 '메인 지도 · 시트 접힘/펼침')
/// - 지도 가운데 기준으로 업체를 불러오고, 핀은 판정과 관계없이 모두 보여 준다.
/// - 아래 시트의 토글(입장 가능 / 준비 필요)은 목록만 거른다(10-27 결정).
struct MapHomeView: View {
    @Binding var focusPlaceId: String?

    @Environment(AppStore.self) private var store
    @State private var location = LocationProvider()
    @State private var camera: MapCameraPosition = .region(MKCoordinateRegion(
        center: LocationProvider.fallback, latitudinalMeters: 1400, longitudinalMeters: 1400))
    @State private var center = LocationProvider.fallback
    @State private var radius: Double = 1500
    @State private var places: [PlaceCard] = []
    @State private var category: String?
    @State private var listFilter: Verdict = .entryOK
    @State private var sheetExpanded = false
    @State private var showDogMenu = false
    @State private var showCriteria = false
    @State private var searchText = ""
    @State private var searchResults: [PlaceCard]?
    @State private var errorMessage: String?
    @State private var path: [String] = []
    @State private var loadTask: Task<Void, Never>?
    @FocusState private var searchFocused: Bool

    private let categories: [(String?, String, String?)] = [(nil, "전체", nil), ("카페", "카페", "cup.and.saucer"), ("식당", "식당", "fork.knife")]

    var body: some View {
        NavigationStack(path: $path) {
            GeometryReader { geo in
                ZStack(alignment: .top) {
                    PlaceMapLayer(places: places, myLocation: location.coordinate ?? LocationProvider.fallback,
                                  basisDog: store.basisDogs.first, isTogether: store.basis == .together,
                                  camera: $camera,
                                  onSelect: { path.append($0.placeId) },
                                  onCenterChange: { c, r in center = c; radius = r; scheduleLoad() })
                        .ignoresSafeArea(edges: .top)

                    topControls

                    myLocationButton
                        .frame(maxWidth: .infinity, alignment: .trailing)
                        .padding(.trailing, 16)
                        .offset(y: sheetTop(in: geo) - 60)

                    bottomSheet(in: geo)

                    if showDogMenu {
                        Color.black.opacity(0.14).ignoresSafeArea().onTapGesture { showDogMenu = false }
                        DogBasisMenu(onClose: { showDogMenu = false }, onManage: { showDogMenu = false; path.append("dogs") })
                            .padding(.top, 62)
                            .padding(.trailing, 16)
                            .frame(maxWidth: .infinity, alignment: .trailing)
                            .transition(.opacity.combined(with: .scale(scale: 0.96, anchor: .topTrailing)))
                    }
                }
            }
            .background(Color(hex: 0xF2F3F5))
            .toolbar(.hidden, for: .navigationBar)
            .navigationDestination(for: String.self) { id in
                if id == "dogs" {
                    MyDogsView().hidesTabBar()
                } else {
                    PlaceDetailView(placeId: id, onFindAgain: { path.removeAll() }).hidesTabBar()
                }
            }
            .sheet(isPresented: $showCriteria) { CriteriaSheet() }
            .animation(.snappy(duration: 0.25), value: showDogMenu)
            .task(id: store.revision) { await load() }
            .onChange(of: store.basis) { scheduleLoad() }
            .onChange(of: category) { scheduleLoad() }
            .onChange(of: focusPlaceId) {
                if let id = focusPlaceId { path = [id]; focusPlaceId = nil }
            }
            .toast($errorMessage)
            .onAppear { location.request() }
        }
    }

    // MARK: 위쪽: 검색 · 반려견 · 업종 칩

    private var topControls: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(spacing: 8) {
                HStack(spacing: 12) {
                    Image(systemName: "magnifyingglass").foregroundStyle(PawFitColor.iconGray)
                    TextField("", text: $searchText, prompt: Text("성수동에서 장소 찾기").foregroundStyle(PawFitColor.textTertiary))
                        .font(.pawfit(16))
                        .submitLabel(.search)
                        .focused($searchFocused)
                        .onSubmit { Task { await search() } }
                    if !searchText.isEmpty {
                        Button { searchText = ""; searchResults = nil } label: {
                            Image(systemName: "xmark.circle.fill").foregroundStyle(PawFitColor.textTertiary)
                        }
                        .accessibilityLabel("검색어 지우기")
                    }
                }
                .padding(.leading, 18).padding(.trailing, 16)
                .frame(height: 52)
                .background(PawFitColor.background, in: RoundedRectangle(cornerRadius: 16))
                .pawfitFloatingShadow()

                Button { showDogMenu.toggle() } label: {
                    HStack(spacing: 3) {
                        if store.basis == .together {
                            Image(systemName: "pawprint.fill").foregroundStyle(PawFitColor.brand)
                                .frame(width: 34, height: 34).background(PawFitColor.brandTint, in: Circle())
                                .overlay(Circle().strokeBorder(PawFitColor.brand, lineWidth: 2))
                        } else if let dog = store.basisDogs.first {
                            DogAvatar(name: dog.name, size: 34, illustrated: dog.isDefault, ring: true)
                        } else {
                            Image(systemName: "pawprint").frame(width: 34, height: 34)
                        }
                        Image(systemName: showDogMenu ? "chevron.up" : "chevron.down")
                            .font(.system(size: 11, weight: .bold)).foregroundStyle(PawFitColor.iconGray)
                    }
                    .frame(width: 64, height: 52)
                    .background(PawFitColor.background, in: RoundedRectangle(cornerRadius: 16))
                    .pawfitFloatingShadow()
                }
                .accessibilityLabel("기준 반려견 바꾸기, 지금은 \(store.basisTitle)")
            }

            HStack(spacing: 8) {
                ForEach(categories, id: \.1) { value, title, icon in
                    let on = category == value
                    Button { category = value } label: {
                        HStack(spacing: 6) {
                            if let icon { Image(systemName: icon).font(.system(size: 14)) }
                            Text(title).font(.pawfit(14, .semibold))
                        }
                        .foregroundStyle(on ? .white : PawFitColor.textPrimary)
                        .padding(.horizontal, icon == nil ? 16 : 14)
                        .frame(height: 34)
                        .background(on ? PawFitColor.brand : PawFitColor.background, in: Capsule())
                        .shadow(color: (on ? PawFitColor.brand : PawFitColor.textPrimary).opacity(on ? 0.22 : 0.08), radius: 5, y: 2)
                    }
                    .accessibilityAddTraits(on ? .isSelected : [])
                }
            }
        }
        .padding(.horizontal, 16)
        .padding(.top, 8)
    }

    private var myLocationButton: some View {
        Button {
            location.request()
            withAnimation { camera = .region(MKCoordinateRegion(center: location.current, latitudinalMeters: 1400, longitudinalMeters: 1400)) }
        } label: {
            Image(systemName: "location").font(.system(size: 19)).foregroundStyle(PawFitColor.brand)
                .frame(width: 46, height: 46)
                .background(PawFitColor.background, in: RoundedRectangle(cornerRadius: 15))
                .pawfitFloatingShadow()
        }
        .accessibilityLabel("내 위치로 이동")
    }

    // MARK: 아래 시트

    private func sheetTop(in geo: GeometryProxy) -> CGFloat {
        sheetExpanded ? 112 : geo.size.height * 0.56
    }

    private var listed: [PlaceCard] {
        let base = searchResults ?? places.filter { $0.verdict == listFilter }
        return base.sorted { $0.distanceM(from: center) < $1.distanceM(from: center) }
    }

    private func bottomSheet(in geo: GeometryProxy) -> some View {
        VStack(spacing: 0) {
            SheetGrabber()
            HStack {
                Text(searchResults == nil ? "\(Josa.with(store.basisTitle.isEmpty ? "반려견" : store.basisTitle)) 갈 수 있는 곳"
                                          : "'\(searchText)' 검색 결과")
                    .font(.pawfit(20, .bold)).tracking(-0.3).lineLimit(1)
                Spacer()
                Button { showCriteria = true } label: {
                    HStack(spacing: 4) {
                        Image(systemName: "info.circle").font(.system(size: 15))
                        Text("판정 기준").font(.pawfit(13, .semibold))
                    }
                    .foregroundStyle(PawFitColor.iconGray)
                    .frame(minHeight: 44)
                }
            }
            .padding(.horizontal, 20)
            .padding(.top, 14)

            if searchResults == nil {
                HStack(spacing: 4) {
                    filterButton(.entryOK)
                    filterButton(.prepare)
                }
                .padding(4)
                .frame(height: 40)
                .background(PawFitColor.surfaceNeutral, in: RoundedRectangle(cornerRadius: 20))
                .padding(.horizontal, 16)
                .padding(.top, 6)
            }

            Text(searchResults == nil ? "지도 가운데에서 가까운 순" : "가까운 순")
                .font(.pawfit(13, .semibold)).foregroundStyle(PawFitColor.textSecondary)
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(.horizontal, 20).padding(.top, 18).padding(.bottom, 2)

            ScrollView {
                LazyVStack(spacing: 0) {
                    ForEach(listed) { place in
                        Button { path.append(place.placeId) } label: { PlaceRow(place: place, distance: place.distanceM(from: center)) }
                            .buttonStyle(.plain)
                        if place.id != listed.last?.id { Divider().overlay(PawFitColor.separator) }
                    }
                    if listed.isEmpty {
                        Text(searchResults == nil ? "지도를 옮기면 다른 곳도 찾아볼게요" : "찾는 장소가 없어요")
                            .font(.pawfit(14)).foregroundStyle(PawFitColor.textSecondary)
                            .padding(.vertical, 28)
                    }
                }
                .padding(.horizontal, 20)
                .padding(.bottom, 24)
            }
            .scrollDisabled(!sheetExpanded)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
        .background(PawFitColor.background, in: UnevenRoundedRectangle(topLeadingRadius: 28, topTrailingRadius: 28))
        .shadow(color: PawFitColor.textPrimary.opacity(0.08), radius: 16, y: -8)
        .offset(y: sheetTop(in: geo))
        .gesture(DragGesture(minimumDistance: 12).onEnded { v in
            withAnimation(.snappy(duration: 0.3)) {
                if v.translation.height < -40 { sheetExpanded = true } else if v.translation.height > 40 { sheetExpanded = false }
            }
        })
        .onTapGesture { if !sheetExpanded { withAnimation(.snappy(duration: 0.3)) { sheetExpanded = true } } }
        .ignoresSafeArea(edges: .bottom)
    }

    private func filterButton(_ v: Verdict) -> some View {
        let on = listFilter == v
        let count = places.filter { $0.verdict == v }.count
        return Button { listFilter = v } label: {
            HStack(spacing: 6) {
                VerdictDot(verdict: v, size: 16)
                Text("\(v.title) \(count)").font(.pawfit(14, .semibold)).foregroundStyle(on ? v.text : PawFitColor.iconGray)
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .background(on ? Color.white : .clear, in: RoundedRectangle(cornerRadius: 16))
            .shadow(color: on ? PawFitColor.textPrimary.opacity(0.12) : .clear, radius: 2, y: 1)
        }
        .accessibilityAddTraits(on ? .isSelected : [])
    }

    // MARK: 불러오기

    private func scheduleLoad() {
        loadTask?.cancel()
        loadTask = Task {
            try? await Task.sleep(for: .milliseconds(350))
            guard !Task.isCancelled else { return }
            await load()
        }
    }

    private func load() async {
        do {
            places = try await store.api.mapPlaces(latitude: center.latitude, longitude: center.longitude,
                                                   radiusM: Int(radius), category: category, dogIds: store.basisDogIds)
        } catch {
            errorMessage = APIError.message(error)
        }
    }

    private func search() async {
        let k = searchText.trimmingCharacters(in: .whitespaces)
        guard !k.isEmpty else { searchResults = nil; return }
        do {
            searchResults = try await store.api.searchPlaces(keyword: k, dogIds: store.basisDogIds)
            withAnimation(.snappy) { sheetExpanded = true }
        } catch {
            errorMessage = APIError.message(error)
        }
    }
}

/// 목록 한 줄: 업종 아이콘 · 이름 · 거리 · 판정
struct PlaceRow: View {
    let place: PlaceCard
    let distance: Int

    var body: some View {
        HStack(spacing: 14) {
            Image(systemName: PlaceIcon.symbol(for: place))
                .font(.system(size: 22)).foregroundStyle(PawFitColor.brand)
                .frame(width: 56, height: 56)
                .background(PawFitColor.surfaceNeutral, in: RoundedRectangle(cornerRadius: 16))
            VStack(alignment: .leading, spacing: 5) {
                HStack(alignment: .firstTextBaseline) {
                    Text(place.name).font(.pawfit(16, .semibold)).foregroundStyle(PawFitColor.textPrimary)
                    Spacer()
                    Text(DistanceText.make(distance)).font(.pawfit(13)).foregroundStyle(PawFitColor.textSecondary)
                }
                VerdictLabel(verdict: place.verdict)
            }
        }
        .frame(height: 80)
        .contentShape(Rectangle())
        .accessibilityElement(children: .combine)
    }
}

enum PlaceIcon {
    /// 서버 카드에는 업종이 없어서 이름으로 짐작 (목업은 업종을 안다)
    static func symbol(for place: PlaceCard) -> String {
        let c = MockPawFitAPI.category(of: place.placeId) ?? place.name
        if c.contains("카페") || c.contains("커피") { return "cup.and.saucer" }
        if c.contains("베이커리") || c.contains("빵") { return "birthday.cake" }
        if c.contains("식당") || c.contains("레스토랑") || c.contains("브런치") || c.contains("가든") { return "fork.knife" }
        if c.contains("숙") || c.contains("호텔") { return "bed.double" }
        return "mappin.and.ellipse"
    }
}

enum DistanceText {
    static func make(_ m: Int) -> String {
        m < 1000 ? "\(m)m" : String(format: "%.1fkm", Double(m) / 1000)
    }
}
