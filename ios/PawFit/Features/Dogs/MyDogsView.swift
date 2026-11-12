import SwiftUI

/// A10 내 반려견
struct MyDogsView: View {
    @Environment(AppStore.self) private var store
    @State private var showRegister = false

    var body: some View {
        VStack(spacing: 0) {
            TopBar(title: "내 반려견")
            ScrollView {
                VStack(spacing: 10) {
                    ForEach(store.dogs) { dog in
                        NavigationLink(value: DogRoute.edit(dog.dogId)) { DogCard(dog: dog) }
                            .buttonStyle(.plain)
                            .accessibilityLabel("\(dog.name)\(dog.isDefault ? ", 기본 반려견" : ""), 정보 수정")
                    }
                    if store.dogs.count < 5 {
                        Button { showRegister = true } label: {
                            Label("반려견 추가", systemImage: "plus").font(.pawfit(16, .semibold)).foregroundStyle(PawFitColor.brand)
                                .frame(maxWidth: .infinity, minHeight: 64)
                                .background(Color.white, in: RoundedRectangle(cornerRadius: 18))
                                .overlay(RoundedRectangle(cornerRadius: 18).strokeBorder(PawFitColor.separator,
                                                                                          style: StrokeStyle(lineWidth: 1, dash: [5, 4])))
                        }
                    }
                }
                .padding(.horizontal, 16).padding(.top, 24)

                if store.dogs.count > 1 {
                    VStack(alignment: .leading, spacing: 10) {
                        Text("지도에서 보는 두 가지 방법").font(.pawfit(15, .semibold))
                        explain("개별 보기", "고른 한 마리 기준으로 판정해요")
                        explain("함께 가요", "등록한 반려견 모두를 판정하고, 그중 가장 까다로운 결과를 보여줘요")
                    }
                    .padding(20)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .background(PawFitColor.surfaceNeutral, in: RoundedRectangle(cornerRadius: 18))
                    .padding(.horizontal, 16).padding(.top, 20)
                }
            }
        }
        .screenBackground()
        .toolbar(.hidden, for: .navigationBar)
        .navigationDestination(for: DogRoute.self) { route in
            switch route {
            case .edit(let id): DogEditView(dogId: id)
            case .vaccination(let id, let name): VaccinationFlowView(dogId: id, dogName: name)
            }
        }
        .fullScreenCover(isPresented: $showRegister) {
            DogRegistrationFlow(onFinish: { showRegister = false }).environment(store)
        }
        .task { if store.dogs.isEmpty { await store.reloadDogs() } }
    }

    private func explain(_ title: String, _ text: String) -> some View {
        HStack(alignment: .top, spacing: 8) {
            Text(title).font(.pawfit(14, .semibold)).foregroundStyle(PawFitColor.brand).frame(width: 64, alignment: .leading)
            Text(text).font(.pawfit(14)).lineSpacing(2).foregroundStyle(PawFitColor.iconGray)
        }
    }
}

enum DogRoute: Hashable {
    case edit(Int64)
    case vaccination(Int64, String)
}

struct DogCard: View {
    let dog: DogDetail
    var body: some View {
        HStack(alignment: .top, spacing: 14) {
            DogAvatar(name: dog.name, size: 56, illustrated: dog.isDefault)
            VStack(alignment: .leading, spacing: 4) {
                HStack(spacing: 6) {
                    Text(dog.name).font(.pawfit(17, dog.isDefault ? .bold : .semibold))
                    if dog.isDefault {
                        Text("기본").font(.pawfit(11.5, .semibold)).foregroundStyle(.white)
                            .padding(.horizontal, 8).frame(height: 20).background(PawFitColor.brand, in: Capsule())
                    }
                }
                Text(dog.subtitle).font(.pawfit(13.5)).foregroundStyle(PawFitColor.textSecondary)
                DogChips(dog: dog, showMissing: true).padding(.top, 6)
            }
            Spacer(minLength: 0)
            Image(systemName: "chevron.right").font(.system(size: 14, weight: .semibold)).foregroundStyle(PawFitColor.textTertiary)
                .padding(.top, 4)
        }
        .padding(16)
        .background(Color.white, in: RoundedRectangle(cornerRadius: 18))
        .overlay(RoundedRectangle(cornerRadius: 18).strokeBorder(dog.isDefault ? PawFitColor.brand : PawFitColor.separator,
                                                                 lineWidth: dog.isDefault ? 2 : 0.5))
        .contentShape(Rectangle())
    }
}

/// A11 반려견 정보 수정 · 삭제
struct DogEditView: View {
    let dogId: Int64

    @Environment(AppStore.self) private var store
    @Environment(\.dismiss) private var dismiss
    @State private var values = DogFormValues()
    @State private var original: DogDetail?
    @State private var breeds: [Breed] = []
    @State private var makeDefault = false
    @State private var vax: VaccinationRecord?
    @State private var busy = false
    @State private var confirmDelete = false
    @State private var message: String?

    var body: some View {
        ZStack {
            VStack(spacing: 0) {
                TopBar(title: "\(original?.name ?? "반려견") 정보 수정")
                if original == nil {
                    LoadingView()
                } else {
                    ScrollView {
                        VStack(alignment: .leading, spacing: 14) {
                            DogBasicFields(values: $values, breeds: breeds, showsNote: false)

                            VStack(alignment: .leading, spacing: 8) {
                                FieldLabel(text: "입장 준비물")
                                FlowLayout(spacing: 8) {
                                    ForEach(Equipment.allCases) { item in
                                        let on = values.equipment.contains(item)
                                        Button {
                                            if on { values.equipment.remove(item) } else { values.equipment.insert(item) }
                                        } label: {
                                            HStack(spacing: 5) {
                                                if on { Image(systemName: "checkmark").font(.system(size: 12, weight: .bold)) }
                                                Text(item.title).font(.pawfit(14, .semibold))
                                            }
                                            .foregroundStyle(on ? PawFitColor.brand : PawFitColor.iconGray)
                                            .padding(.horizontal, 14).frame(height: 38)
                                            .background(on ? PawFitColor.brandTint : Color.white, in: Capsule())
                                            .overlay(Capsule().strokeBorder(on ? PawFitColor.brand : PawFitColor.separator))
                                        }
                                        .accessibilityAddTraits(on ? .isSelected : [])
                                    }
                                }
                            }
                            .padding(.top, 6)

                            VStack(alignment: .leading, spacing: 6) {
                                FieldLabel(text: "예방접종 증빙")
                                HStack {
                                    Image(systemName: VaccinationBadge(record: vax?.status ?? .notSubmitted) == .verified ? "checkmark.seal.fill" : "doc")
                                        .foregroundStyle(PawFitColor.brand)
                                    Text(vaxSummary).font(.pawfit(14.5))
                                    Spacer()
                                    NavigationLink(value: DogRoute.vaccination(dogId, values.name)) {
                                        Text(vax?.recordId == nil ? "서류 올리기" : "서류 바꾸기")
                                            .font(.pawfit(14, .semibold)).foregroundStyle(PawFitColor.brand).frame(minHeight: 44)
                                    }
                                }
                                .padding(.horizontal, 16).frame(minHeight: 56)
                                .background(PawFitColor.surfaceNeutral, in: RoundedRectangle(cornerRadius: 14))
                            }

                            Toggle(isOn: $makeDefault) {
                                Text("기본 반려견으로 보기").font(.pawfit(15, .semibold))
                            }
                            .tint(PawFitColor.brand)
                            .disabled(original?.isDefault == true)
                            .frame(minHeight: 52)
                        }
                        .padding(.horizontal, 20).padding(.top, 8).padding(.bottom, 24)
                    }
                    .scrollDismissesKeyboard(.interactively)
                }
            }
            .safeAreaInset(edge: .bottom, spacing: 0) {
                BottomBar {
                    Button { Task { await save() } } label: { if busy { ProgressView().tint(.white) } else { Text("변경 내용 저장") } }
                        .buttonStyle(PrimaryButtonStyle()).disabled(!values.isBasicValid || busy)
                    Button("반려견 삭제") { confirmDelete = true }
                        .font(.pawfit(15, .semibold)).foregroundStyle(PawFitColor.errorText).frame(minHeight: 44)
                }
            }

            if confirmDelete, let dog = original {
                let next = store.dogs.first { $0.dogId != dog.dogId }
                ConfirmDialog(
                    title: "\(Josa.object(dog.name)) 삭제할까요?",
                    message: "\(dog.name)의 프로필, 준비물, 예방접종 증빙이 모두 지워지고 되돌릴 수 없어요."
                        + (dog.isDefault && next != nil ? " 기본 반려견은 \(next!.name)\(Josa.hasBatchim(next!.name) ? "으로" : "로") 바뀌어요." : ""),
                    confirmTitle: "삭제", destructive: true,
                    onCancel: { confirmDelete = false },
                    onConfirm: { Task { await delete() } })
            }
        }
        .animation(.easeOut(duration: 0.15), value: confirmDelete)
        .screenBackground()
        .toolbar(.hidden, for: .navigationBar)
        .toast($message)
        .task { await load() }
    }

    private var vaxSummary: String {
        guard let vax, vax.recordId != nil else { return "아직 올린 서류가 없어요" }
        let badge = VaccinationBadge(record: vax.status)
        if badge == .verified { return "확인 완료 · \(vax.itemTitles) \(DateText.dotted(vax.latestDate) ?? "")" }
        return badge.chipTitle
    }

    private func load() async {
        async let b = store.api.breeds()
        async let d = store.api.dog(dogId)
        async let v = store.api.vaccinationRecord(dogId: dogId)
        breeds = (try? await b) ?? []
        if let dog = try? await d {
            original = dog
            values = DogFormValues(dog: dog, breeds: breeds)
            makeDefault = dog.isDefault
        }
        vax = try? await v
    }

    private func save() async {
        guard let original else { return }
        busy = true; defer { busy = false }
        do {
            var r = DogUpdateRequest()
            if values.name != original.name { r.name = values.name }
            if values.breed?.breedId != original.breedId { r.breedId = values.breed?.breedId }
            if values.weight != original.weightKg { r.weightKg = values.weight }
            if values.equipment != original.equipment {
                r.equipmentCodes = Equipment.allCases.filter(values.equipment.contains).map(\.rawValue)
            }
            try await store.api.updateDog(dogId, r)
            if makeDefault && !original.isDefault { try await store.api.setDefaultDog(dogId) }
            await store.reloadDogs()
            dismiss()
        } catch {
            message = APIError.message(error)
        }
    }

    private func delete() async {
        confirmDelete = false
        do {
            try await store.api.deleteDog(dogId)
            await store.reloadDogs()
            dismiss()
        } catch {
            message = APIError.message(error)
        }
    }
}
