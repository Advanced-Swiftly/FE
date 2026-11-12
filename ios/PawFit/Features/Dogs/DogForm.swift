import SwiftUI

/// A4 기본 정보 · A11 수정에서 같이 쓰는 입력값
struct DogFormValues: Equatable {
    enum Sex: Hashable { case male, female }

    var name = ""
    var age: Int?
    var sex: Sex?            // 서버에 없음 — 화면 표시용
    var breed: Breed?
    var weightText = ""
    var note = ""            // 서버에 없음
    var equipment: Set<Equipment> = []

    var weight: Double? { Double(weightText.replacingOccurrences(of: ",", with: ".")) }
    var size: DogSize? { DogSize(weightKg: weight) }

    var isBasicValid: Bool {
        !name.trimmingCharacters(in: .whitespaces).isEmpty && breed != nil && (weight ?? 0) > 0
    }

    init() {}

    init(dog: DogDetail, breeds: [Breed]) {
        name = dog.name
        age = DogAge.years(fromBirthDate: dog.birthDate)
        breed = breeds.first { $0.breedId == dog.breedId } ?? dog.breedId.map { Breed(breedId: $0, name: dog.breedName ?? "") }
        weightText = dog.weightKg.map { $0 == $0.rounded() ? String(format: "%.1f", $0) : String($0) } ?? ""
        equipment = dog.equipment
    }

    var createRequest: DogCreateRequest? {
        guard let breed else { return nil }
        return DogCreateRequest(name: name.trimmingCharacters(in: .whitespaces), breedId: breed.breedId,
                                birthDate: age.map(DogAge.birthDate(forAge:)), weightKg: weight,
                                equipmentCodes: Equipment.allCases.filter(equipment.contains).map(\.rawValue), isDefault: nil)
    }
}

/// A4 기본 정보 입력 칸들 (사진 · 이름 · 나이 · 성별 · 품종 · 체중 · 크기 · 특이사항)
struct DogBasicFields: View {
    @Binding var values: DogFormValues
    let breeds: [Breed]
    var showsNote = true

    @State private var showBreeds = false
    @State private var showAge = false

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Spacer()
                ZStack(alignment: .bottomTrailing) {
                    DogAvatar(name: values.name.isEmpty ? "?" : values.name, size: 88, illustrated: true)
                    Image(systemName: "camera").font(.system(size: 15)).foregroundStyle(PawFitColor.brand)
                        .frame(width: 32, height: 32).background(Color.white, in: Circle())
                        .shadow(color: .black.opacity(0.12), radius: 6, y: 3)
                }
                .accessibilityLabel("사진 추가 (준비 중)")
                Spacer()
            }
            .padding(.top, 4)

            VStack(alignment: .leading, spacing: 6) {
                FieldLabel(text: "이름")
                BoxField(placeholder: "", text: $values.name)
            }
            HStack(spacing: 12) {
                VStack(alignment: .leading, spacing: 6) {
                    FieldLabel(text: "나이")
                    BoxPicker(text: values.age.map { "\($0)살" } ?? "선택", placeholder: values.age == nil) { showAge = true }
                }
                VStack(alignment: .leading, spacing: 6) {
                    FieldLabel(text: "성별")
                    SegmentPicker(options: [(DogFormValues.Sex.male, "남아"), (.female, "여아")], selection: $values.sex)
                }
            }
            VStack(alignment: .leading, spacing: 6) {
                FieldLabel(text: "품종")
                BoxPicker(text: values.breed?.name ?? "품종 검색", placeholder: values.breed == nil,
                          systemImage: "chevron.right", leadingImage: values.breed == nil ? "magnifyingglass" : nil) { showBreeds = true }
            }
            HStack(spacing: 12) {
                VStack(alignment: .leading, spacing: 6) {
                    FieldLabel(text: "체중")
                    BoxField(placeholder: "0.0", text: $values.weightText, keyboard: .decimalPad, unit: "kg")
                }
                VStack(alignment: .leading, spacing: 6) {
                    FieldLabel(text: "크기")
                    Text(values.size?.title ?? "체중으로 정해요")
                        .font(.pawfit(15))
                        .foregroundStyle(values.size == nil ? PawFitColor.textTertiary : PawFitColor.textPrimary)
                        .padding(.horizontal, 16)
                        .frame(maxWidth: .infinity, minHeight: 52, alignment: .leading)
                        .background(PawFitColor.surfaceNeutral, in: RoundedRectangle(cornerRadius: 14))
                }
            }
            if showsNote {
                VStack(alignment: .leading, spacing: 6) {
                    FieldLabel(text: "특이사항", optional: true)
                    TextField("", text: $values.note, axis: .vertical)
                        .font(.pawfit(15)).lineLimit(3...5)
                        .padding(14)
                        .background(Color.white, in: RoundedRectangle(cornerRadius: 14))
                        .overlay(RoundedRectangle(cornerRadius: 14).strokeBorder(PawFitColor.separator))
                }
            }
        }
        .sheet(isPresented: $showBreeds) { BreedPickerSheet(breeds: breeds, selection: $values.breed) }
        .sheet(isPresented: $showAge) {
            AgePickerSheet(age: $values.age).presentationDetents([.height(320)])
        }
    }
}

struct BreedPickerSheet: View {
    let breeds: [Breed]
    @Binding var selection: Breed?
    @Environment(\.dismiss) private var dismiss
    @State private var query = ""

    var body: some View {
        NavigationStack {
            List(breeds.filter { query.isEmpty || $0.name.contains(query) }) { breed in
                Button {
                    selection = breed
                    dismiss()
                } label: {
                    HStack {
                        Text(breed.name).font(.pawfit(16)).foregroundStyle(PawFitColor.textPrimary)
                        Spacer()
                        if selection == breed { Image(systemName: "checkmark").foregroundStyle(PawFitColor.brand) }
                    }
                }
            }
            .listStyle(.plain)
            .searchable(text: $query, prompt: "품종 이름")
            .navigationTitle("품종 선택")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar { ToolbarItem(placement: .cancellationAction) { Button("닫기") { dismiss() } } }
        }
        .tint(PawFitColor.brand)
    }
}

struct AgePickerSheet: View {
    @Binding var age: Int?
    @Environment(\.dismiss) private var dismiss
    @State private var value = 3

    var body: some View {
        VStack(spacing: 0) {
            HStack {
                Text("나이").font(.pawfit(17, .semibold))
                Spacer()
                Button("완료") { age = value; dismiss() }.font(.pawfit(16, .semibold)).foregroundStyle(PawFitColor.brand)
            }
            .padding(.horizontal, 20).padding(.top, 20)
            Picker("나이", selection: $value) {
                ForEach(0...25, id: \.self) { Text($0 == 0 ? "1살 미만" : "\($0)살").tag($0) }
            }
            .pickerStyle(.wheel)
        }
        .onAppear { value = age ?? 3 }
    }
}

/// A5 준비물 토글 목록
struct EquipmentToggles: View {
    @Binding var equipment: Set<Equipment>

    var body: some View {
        VStack(spacing: 0) {
            ForEach(Equipment.allCases) { item in
                Toggle(isOn: Binding(get: { equipment.contains(item) },
                                     set: { on in if on { equipment.insert(item) } else { equipment.remove(item) } })) {
                    Text(item.toggleTitle).font(.pawfit(16)).foregroundStyle(PawFitColor.textPrimary)
                }
                .tint(PawFitColor.brand)
                .frame(minHeight: 58)
                .overlay(alignment: .bottom) {
                    if item != Equipment.allCases.last { Rectangle().fill(PawFitColor.separator).frame(height: 0.5) }
                }
            }
        }
        .padding(.horizontal, 20)
    }
}

/// 준비물 · 접종 칩 줄 (A6 · A10)
struct DogChips: View {
    let dog: DogDetail
    var showMissing = false

    var body: some View {
        FlowLayout(spacing: 8) {
            ForEach(Equipment.allCases.filter(dog.equipment.contains)) { item in
                InfoChip(title: item.title, systemImage: "checkmark", tint: PawFitColor.textPrimary, background: PawFitColor.surfaceNeutral)
            }
            if showMissing && !dog.equipment.contains(.stroller) {
                InfoChip(title: "유모차 없음", systemImage: "minus", tint: PawFitColor.iconGray, background: PawFitColor.surfaceNeutral)
            }
            let badge = VaccinationBadge(dog: dog.vaccinationStatus)
            if badge != .none {
                InfoChip(title: badge == .verified ? "접종 확인 완료" : badge.chipTitle,
                         systemImage: badge == .verified ? "checkmark.seal" : "exclamationmark.circle")
            }
        }
    }
}

/// 줄바꿈되는 가로 배치 (칩 목록)
struct FlowLayout: Layout {
    var spacing: CGFloat = 8

    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize {
        let width = proposal.width ?? .infinity
        var x: CGFloat = 0, y: CGFloat = 0, rowH: CGFloat = 0, maxX: CGFloat = 0
        for v in subviews {
            let s = v.sizeThatFits(.unspecified)
            if x > 0 && x + s.width > width { x = 0; y += rowH + spacing; rowH = 0 }
            x += s.width + spacing; rowH = max(rowH, s.height); maxX = max(maxX, x - spacing)
        }
        return CGSize(width: maxX, height: y + rowH)
    }

    func placeSubviews(in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) {
        var x = bounds.minX, y = bounds.minY, rowH: CGFloat = 0
        for v in subviews {
            let s = v.sizeThatFits(.unspecified)
            if x > bounds.minX && x + s.width > bounds.maxX { x = bounds.minX; y += rowH + spacing; rowH = 0 }
            v.place(at: CGPoint(x: x, y: y), proposal: ProposedViewSize(s))
            x += s.width + spacing; rowH = max(rowH, s.height)
        }
    }
}
