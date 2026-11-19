import SwiftUI

/// 반려견 등록 3단계: A4 기본 정보 → A5 입장 준비물(+ 예방접종 증빙) → A6 프로필 완성
/// 증빙을 올리려면 반려견 ID가 필요해서 A4에서 [다음]을 누를 때 등록(POST)하고, A5에서 준비물을 저장(PATCH)한다.
struct DogRegistrationFlow: View {
    let onFinish: () -> Void

    @Environment(AppStore.self) private var store
    @State private var step = 1
    @State private var values = DogFormValues()
    @State private var breeds: [Breed] = []
    @State private var dogId: Int64?
    @State private var saved: DogDetail?
    @State private var busy = false
    @State private var message: String?
    @State private var showVax = false

    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                TopBar(title: "반려견 등록", leading: step == 1 ? .close : .back, onLeading: {
                    if step == 1 || step == 3 { onFinish() } else { step -= 1 }
                })
                progress
                ScrollView {
                    switch step {
                    case 1: basicStep
                    case 2: prepStep
                    default: doneStep
                    }
                }
                .scrollDismissesKeyboard(.interactively)
            }
            .screenBackground()
            .safeAreaInset(edge: .bottom, spacing: 0) { bottomButtons }
            .toolbar(.hidden, for: .navigationBar)
            .navigationDestination(isPresented: $showVax) {
                if let dogId { VaccinationFlowView(dogId: dogId, dogName: values.name) }
            }
            .toast($message)
            .task { breeds = (try? await store.api.breeds()) ?? [] }
            .onChange(of: showVax) { if !showVax { Task { await refreshSaved() } } }
        }
        .tint(PawFitColor.brand)
    }

    private var progress: some View {
        HStack(spacing: 6) {
            ForEach(1...3, id: \.self) { i in
                Capsule().fill(i <= step ? PawFitColor.brand : PawFitColor.separator).frame(height: 4)
            }
        }
        .padding(.horizontal, 20).padding(.top, 8)
        .accessibilityElement().accessibilityLabel("3단계 중 \(step)단계")
    }

    private func heading(_ title: String, _ sub: String? = nil) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(title).font(.pawfit(22, .bold)).tracking(-0.4)
            if let sub { Text(sub).font(.pawfit(14)).lineSpacing(3).foregroundStyle(PawFitColor.textSecondary) }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.horizontal, 20).padding(.top, 22)
    }

    // MARK: A4

    private var basicStep: some View {
        VStack(spacing: 0) {
            heading("기본 정보를 알려주세요")
            DogBasicFields(values: $values, breeds: breeds).padding(.horizontal, 20).padding(.top, 8).padding(.bottom, 24)
        }
    }

    // MARK: A5

    private var prepStep: some View {
        VStack(alignment: .leading, spacing: 0) {
            heading("입장 준비물을 체크해주세요", "업체 조건과 비교해 준비가 필요한지 알려드려요. 나중에 바꿀 수 있어요.")
            EquipmentToggles(equipment: $values.equipment).padding(.top, 12)

            VStack(alignment: .leading, spacing: 6) {
                let badge = VaccinationBadge(dog: saved?.vaccinationStatus)
                HStack(spacing: 8) {
                    Text("예방접종 증빙").font(.pawfit(16, .semibold))
                    if badge == .none {
                        Text("선택").font(.pawfit(12, .semibold)).foregroundStyle(PawFitColor.textSecondary)
                            .padding(.horizontal, 7).frame(height: 20).background(PawFitColor.surfaceNeutral, in: Capsule())
                    } else {
                        InfoChip(title: badge == .verified ? "확인 완료" : badge.chipTitle)
                    }
                }
                Text(badge == .none ? "접종 증명서나 진료 영수증을 올리면 AI가 접종 날짜와 항목을 읽어 확인해요. 하나만 있어도 돼요."
                                    : "올린 서류를 다시 보거나 바꿀 수 있어요.")
                    .font(.pawfit(13.5)).lineSpacing(3).foregroundStyle(PawFitColor.iconGray)
                TextLinkButton(title: badge == .none ? "서류 올리기" : "서류 보기·바꾸기",
                               systemImage: badge == .none ? "arrow.up.doc" : "doc.text") { showVax = true }
            }
            .padding(.vertical, 20).padding(.horizontal, 4)
            .overlay(alignment: .top) { Rectangle().fill(PawFitColor.separator).frame(height: 0.5) }
            .padding(.horizontal, 20).padding(.top, 24)
        }
    }

    // MARK: A6

    private var doneStep: some View {
        VStack(alignment: .leading, spacing: 0) {
            heading("프로필이 완성됐어요", "지도에서 \(values.name) 기준으로 갈 수 있는 곳을 보여드릴게요.")
            if let dog = saved {
                VStack(spacing: 0) {
                    DogAvatar(name: dog.name, size: 96, illustrated: true, ring: true)
                    Text(dog.name).font(.pawfit(24, .bold)).padding(.top, 16)
                    Text(dog.subtitle).font(.pawfit(14)).foregroundStyle(PawFitColor.textSecondary).padding(.top, 6)
                    DogChips(dog: dog).padding(.top, 16)
                }
                .frame(maxWidth: .infinity)
                .padding(24)
                .background(Color.white, in: RoundedRectangle(cornerRadius: 24))
                .overlay(RoundedRectangle(cornerRadius: 24).strokeBorder(PawFitColor.separator, lineWidth: 0.5))
                .padding(.horizontal, 16).padding(.top, 24)
            }
            Button {
                values = DogFormValues(); dogId = nil; saved = nil; step = 1
            } label: {
                Label("다른 반려견 추가하기", systemImage: "plus").font(.pawfit(15, .semibold)).foregroundStyle(PawFitColor.brand)
                    .frame(maxWidth: .infinity, minHeight: 48)
            }
            .padding(.top, 10)
        }
    }

    // MARK: 버튼 · 저장

    private var bottomButtons: some View {
        BottomBar {
            switch step {
            case 1:
                Button { Task { await createDog() } } label: { if busy { ProgressView().tint(.white) } else { Text("다음") } }
                    .buttonStyle(PrimaryButtonStyle())
                    .disabled(!values.isBasicValid || busy)
            case 2:
                Button { Task { await saveEquipment() } } label: { if busy { ProgressView().tint(.white) } else { Text("다음") } }
                    .buttonStyle(PrimaryButtonStyle())
                    .disabled(busy)
            default:
                Button("지도에서 갈 수 있는 곳 보기") {
                    if let dogId { store.basis = .dog(dogId) }
                    onFinish()
                }
                .buttonStyle(PrimaryButtonStyle())
            }
        }
    }

    private func createDog() async {
        busy = true; defer { busy = false }
        do {
            if let dogId {
                var r = DogUpdateRequest()
                r.name = values.name; r.breedId = values.breed?.breedId; r.weightKg = values.weight
                try await store.api.updateDog(dogId, r)
            } else if let req = values.createRequest {
                dogId = try await store.api.createDog(req).dogId
            }
            await refreshSaved()
            step = 2
        } catch {
            message = APIError.message(error)
        }
    }

    private func saveEquipment() async {
        guard let dogId else { return }
        busy = true; defer { busy = false }
        do {
            var r = DogUpdateRequest()
            r.equipmentCodes = Equipment.allCases.filter(values.equipment.contains).map(\.rawValue)
            try await store.api.updateDog(dogId, r)
            await refreshSaved()
            await store.reloadDogs()
            step = 3
        } catch {
            message = APIError.message(error)
        }
    }

    private func refreshSaved() async {
        guard let dogId else { return }
        saved = try? await store.api.dog(dogId)
    }
}
