import SwiftUI
import PhotosUI
import UniformTypeIdentifiers

/// 예방접종 증빙: ① 서류 올리기 전 → ② A7 서류 올린 후 → ③ A8 AI 확인 결과 → ④ 내용 고치기
/// 서버는 서류를 받아 AI로 읽고(ANALYZING → ANALYZED / NEEDS_MANUAL_REVIEW / REJECTED),
/// 보호자가 값을 고치면 운영자 확인(OPERATOR_REVIEW)으로 넘어간다.
struct VaccinationFlowView: View {
    let dogId: Int64
    let dogName: String

    @Environment(AppStore.self) private var store
    @Environment(\.dismiss) private var dismiss
    @State private var stage: Stage = .loading
    @State private var files: [UploadFile] = []
    @State private var record: VaccinationRecord?
    @State private var photoItems: [PhotosPickerItem] = []
    @State private var showFileImporter = false
    @State private var showCamera = false
    @State private var showPhotos = false
    @State private var message: String?

    enum Stage: Equatable { case loading, pick, analyzing, result, edit }

    var body: some View {
        VStack(spacing: 0) {
            TopBar(title: stage == .result ? "AI 확인 결과" : stage == .edit ? "내용 고치기" : "예방접종 증빙", onLeading: {
                if stage == .edit { stage = .result } else { dismiss() }
            })
            switch stage {
            case .loading: LoadingView()
            case .pick: pickStage
            case .analyzing: LoadingView(text: "AI가 서류를 읽고 있어요")
            case .result: resultStage
            case .edit:
                if let record {
                    VaccinationEditView(dogName: dogName, record: record) { items in
                        Task { await submitCorrection(items) }
                    }
                }
            }
        }
        .screenBackground()
        .toolbar(.hidden, for: .navigationBar)
        .photosPicker(isPresented: $showPhotos, selection: $photoItems, maxSelectionCount: 2, matching: .images)
        .onChange(of: photoItems) { Task { await loadPhotos() } }
        .fileImporter(isPresented: $showFileImporter, allowedContentTypes: [.pdf, .jpeg, .png], allowsMultipleSelection: true) { result in
            if case let .success(urls) = result { addFiles(urls) }
        }
        .fullScreenCover(isPresented: $showCamera) {
            CameraPicker { image in
                if let data = image.jpegData(compressionQuality: 0.8) {
                    files.append(UploadFile(fileName: "camera-\(files.count + 1).jpg", mimeType: "image/jpeg", data: data))
                }
            }
            .ignoresSafeArea()
        }
        .toast($message)
        .task { await loadExisting() }
    }

    // MARK: ①② 서류 고르기 · 올린 서류

    private var pickStage: some View {
        VStack(spacing: 0) {
            ScrollView {
                VStack(alignment: .leading, spacing: 0) {
                    if files.isEmpty {
                        VStack(spacing: 0) {
                            Image(systemName: "doc.text.magnifyingglass").font(.system(size: 34)).foregroundStyle(PawFitColor.brand)
                                .frame(width: 84, height: 84).background(PawFitColor.brandTint, in: Circle())
                            Text("예방접종 서류를 올려주세요").font(.pawfit(22, .bold)).padding(.top, 28)
                            Text("AI가 접종 날짜와 항목을 읽어서\n자동으로 확인해드려요.")
                                .font(.pawfit(15)).multilineTextAlignment(.center).lineSpacing(3)
                                .foregroundStyle(PawFitColor.textSecondary).padding(.top, 10)
                        }
                        .frame(maxWidth: .infinity).padding(.top, 36)

                        VStack(alignment: .leading, spacing: 10) {
                            Text("이런 서류를 올릴 수 있어요").font(.pawfit(15, .semibold))
                            Label("예방접종 증명서", systemImage: "checkmark.circle").font(.pawfit(14.5))
                            Label("접종 내역이 있는 진료 영수증", systemImage: "checkmark.circle").font(.pawfit(14.5))
                        }
                        .foregroundStyle(PawFitColor.textPrimary)
                        .padding(20)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .background(PawFitColor.surfaceNeutral, in: RoundedRectangle(cornerRadius: 18))
                        .padding(.top, 32)
                    } else {
                        Text("예방접종 서류를 올려주세요").font(.pawfit(22, .bold)).padding(.top, 22)
                        Text("증명서와 진료 영수증을 함께 올리면 두 서류를 비교해 더 정확하게 확인해요. 하나만 있어도 돼요.")
                            .font(.pawfit(14)).lineSpacing(3).foregroundStyle(PawFitColor.textSecondary).padding(.top, 8)
                        VStack(spacing: 10) {
                            ForEach(Array(files.enumerated()), id: \.offset) { i, f in
                                HStack(spacing: 14) {
                                    Group {
                                        if f.mimeType.hasPrefix("image"), let img = UIImage(data: f.data) {
                                            Image(uiImage: img).resizable().scaledToFill()
                                        } else {
                                            Image(systemName: "doc.richtext").font(.system(size: 22)).foregroundStyle(PawFitColor.iconGray)
                                        }
                                    }
                                    .frame(width: 56, height: 56).background(PawFitColor.surfaceNeutral)
                                    .clipShape(RoundedRectangle(cornerRadius: 12))
                                    VStack(alignment: .leading, spacing: 4) {
                                        Text(i == 0 ? "예방접종 증명서" : "진료 영수증").font(.pawfit(16, .semibold))
                                        Label("올렸어요", systemImage: "checkmark").font(.pawfit(12.5, .semibold)).foregroundStyle(PawFitColor.brand)
                                    }
                                    Spacer()
                                    Button { files.remove(at: i) } label: {
                                        Image(systemName: "xmark").foregroundStyle(PawFitColor.iconGray).frame(width: 44, height: 44)
                                    }
                                    .accessibilityLabel("\(i == 0 ? "예방접종 증명서" : "진료 영수증") 빼기")
                                }
                                .padding(12)
                                .background(Color.white, in: RoundedRectangle(cornerRadius: 18))
                                .overlay(RoundedRectangle(cornerRadius: 18).strokeBorder(PawFitColor.separator, lineWidth: 0.5))
                            }
                        }
                        .padding(.top, 20)
                    }

                    if files.count < 2 {
                        HStack(spacing: 10) {
                            if UIImagePickerController.isSourceTypeAvailable(.camera) {
                                Button { showCamera = true } label: { Label("사진 찍기", systemImage: "camera") }
                                    .buttonStyle(files.isEmpty ? AnyButtonStyle(PrimaryButtonStyle(fontSize: 16)) : AnyButtonStyle(SecondaryButtonStyle()))
                            }
                            Menu {
                                Button { showPhotos = true } label: { Label("사진 앱에서 고르기", systemImage: "photo") }
                                Button { showFileImporter = true } label: { Label("파일에서 고르기", systemImage: "folder") }
                            } label: {
                                Label("파일 고르기", systemImage: "folder").font(.pawfit(16, .semibold)).foregroundStyle(PawFitColor.brand)
                                    .frame(maxWidth: .infinity, minHeight: 54)
                                    .background(Color.white, in: RoundedRectangle(cornerRadius: 16))
                                    .overlay(RoundedRectangle(cornerRadius: 16).strokeBorder(PawFitColor.brand, lineWidth: 1.5))
                            }
                        }
                        .padding(.top, 24)
                    }
                    if !files.isEmpty {
                        Text("AI가 반려견 이름·접종일·접종 항목을 읽고 두 서류가 맞는지 확인해요.")
                            .font(.pawfit(13)).foregroundStyle(PawFitColor.iconGray).padding(.top, 16)
                    }
                }
                .padding(.horizontal, 20).padding(.bottom, 24)
            }
            if !files.isEmpty {
                BottomBar {
                    Button("AI로 확인하기") { Task { await upload() } }.buttonStyle(PrimaryButtonStyle())
                }
            }
        }
    }

    // MARK: ③ 결과

    private var resultStage: some View {
        let badge = VaccinationBadge(record: record?.status ?? .notSubmitted)
        return VStack(spacing: 0) {
            ScrollView {
                VStack(alignment: .leading, spacing: 0) {
                    Text("AI가 읽은 내용이에요").font(.pawfit(22, .bold)).padding(.top, 22)

                    VStack(spacing: 0) {
                        HStack {
                            Text("항목").frame(width: 92, alignment: .leading)
                            Text("접종일").frame(maxWidth: .infinity, alignment: .leading)
                            Text("AI 확신").frame(width: 64, alignment: .trailing)
                        }
                        .font(.pawfit(13, .semibold)).foregroundStyle(PawFitColor.iconGray)
                        .padding(.horizontal, 16).frame(height: 40).background(PawFitColor.surfaceNeutral)

                        HStack {
                            Text("반려견").font(.pawfit(14)).foregroundStyle(PawFitColor.iconGray).frame(width: 92, alignment: .leading)
                            Text(dogName).font(.pawfit(15, .semibold)).frame(maxWidth: .infinity, alignment: .leading)
                            Text("–").foregroundStyle(PawFitColor.textSecondary).frame(width: 64, alignment: .trailing)
                        }
                        .padding(.horizontal, 16).frame(height: 54)

                        let items = record?.items ?? []
                        if items.isEmpty {
                            Text("읽은 접종 항목이 없어요").font(.pawfit(15)).foregroundStyle(PawFitColor.textSecondary)
                                .frame(maxWidth: .infinity, minHeight: 54)
                                .overlay(alignment: .top) { Rectangle().fill(PawFitColor.separator).frame(height: 0.5) }
                        }
                        ForEach(items) { item in
                            HStack {
                                Text(Vaccine.title(for: item.vaccineCode)).font(.pawfit(15, .semibold)).frame(width: 92, alignment: .leading)
                                Text(DateText.dotted(item.vaccinatedAt) ?? "없음")
                                    .font(.pawfit(15, item.vaccinatedAt == nil ? .regular : .semibold))
                                    .foregroundStyle(item.vaccinatedAt == nil ? PawFitColor.textSecondary : PawFitColor.textPrimary)
                                    .frame(maxWidth: .infinity, alignment: .leading)
                                confidence(item.confidence).frame(width: 64, alignment: .trailing)
                            }
                            .padding(.horizontal, 16).frame(height: 54)
                            .overlay(alignment: .top) { Rectangle().fill(PawFitColor.separator).frame(height: 0.5) }
                        }
                    }
                    .background(Color.white)
                    .clipShape(RoundedRectangle(cornerRadius: 18))
                    .overlay(RoundedRectangle(cornerRadius: 18).strokeBorder(PawFitColor.separator, lineWidth: 0.5))
                    .padding(.top, 20)

                    VaccinationResultBlock(badge: badge).padding(.top, 20)
                }
                .padding(.horizontal, 20).padding(.bottom, 24)
            }
            BottomBar {
                switch badge {
                case .reupload:
                    Button("다시 올리기") { files = []; stage = .pick }.buttonStyle(PrimaryButtonStyle())
                case .needsMore:
                    HStack(spacing: 10) {
                        Button("서류 더 올리기") { files = []; stage = .pick }.buttonStyle(NeutralButtonStyle())
                        Button("내용 고치기") { stage = .edit }.buttonStyle(PrimaryButtonStyle(fontSize: 16))
                    }
                case .operatorReview:
                    Button("확인") { finish() }.buttonStyle(PrimaryButtonStyle())
                default:
                    HStack(spacing: 10) {
                        Button("내용 고치기") { stage = .edit }.buttonStyle(NeutralButtonStyle())
                        Button("프로필에 반영") { finish() }.buttonStyle(PrimaryButtonStyle(fontSize: 16))
                    }
                }
            }
        }
    }

    private func confidence(_ c: Double?) -> some View {
        let style: (String, Color) = {
            guard let c else { return ("직접 입력", PawFitColor.brand) }
            if c >= 0.85 { return ("높음", Verdict.entryOK.text) }
            if c >= 0.6 { return ("보통", Verdict.prepare.text) }
            return ("낮음", PawFitColor.errorText)
        }()
        return Text(style.0).font(.pawfit(13, .semibold)).foregroundStyle(style.1)
    }

    // MARK: 동작

    private func loadExisting() async {
        guard stage == .loading else { return }
        let r = try? await store.api.vaccinationRecord(dogId: dogId)
        record = r
        if let r, r.recordId != nil, r.status != .notSubmitted {
            stage = r.status == .analyzing ? .analyzing : .result
            if r.status == .analyzing { await poll() }
        } else {
            stage = .pick
        }
    }

    private func loadPhotos() async {
        for item in photoItems {
            if let data = try? await item.loadTransferable(type: Data.self), files.count < 2 {
                let jpeg = UIImage(data: data)?.jpegData(compressionQuality: 0.8) ?? data
                files.append(UploadFile(fileName: "photo-\(files.count + 1).jpg", mimeType: "image/jpeg", data: jpeg))
            }
        }
        photoItems = []
    }

    private func addFiles(_ urls: [URL]) {
        for url in urls where files.count < 2 {
            let access = url.startAccessingSecurityScopedResource()
            defer { if access { url.stopAccessingSecurityScopedResource() } }
            guard let data = try? Data(contentsOf: url) else { continue }
            guard data.count <= 10 * 1024 * 1024 else { message = "10MB 이하 파일만 올릴 수 있어요"; continue }
            let ext = url.pathExtension.lowercased()
            let mime = ext == "pdf" ? "application/pdf" : ext == "png" ? "image/png" : "image/jpeg"
            files.append(UploadFile(fileName: url.lastPathComponent, mimeType: mime, data: data))
        }
    }

    private func upload() async {
        stage = .analyzing
        do {
            if let id = record?.recordId, let status = record?.status,
               [VaccinationRecordStatus.analyzed, .needsManualReview, .rejected].contains(status) {
                _ = try await store.api.resubmitVaccination(recordId: id, files: files)
            } else {
                _ = try await store.api.uploadVaccination(dogId: dogId, files: files)
            }
            await poll()
        } catch {
            message = APIError.message(error)
            stage = .pick
        }
    }

    /// AI 분석이 끝날 때까지 2초마다 확인 (최대 90초)
    private func poll() async {
        for _ in 0..<45 {
            try? await Task.sleep(for: .seconds(2))
            if let r = try? await store.api.vaccinationRecord(dogId: dogId), r.status != .analyzing {
                record = r
                stage = .result
                return
            }
        }
        message = "AI 확인이 오래 걸려요. 잠시 후 다시 열어 주세요"
        dismiss()
    }

    private func submitCorrection(_ items: [VaccinationCorrection.Item]) async {
        guard let id = record?.recordId else { return }
        do {
            _ = try await store.api.correctVaccination(recordId: id, VaccinationCorrection(items: items))
            record = try? await store.api.vaccinationRecord(dogId: dogId)
            stage = .result
        } catch {
            message = APIError.message(error)
        }
    }

    private func finish() {
        Task { await store.reloadDogs() }
        dismiss()
    }
}

/// A9 결과 블록 (확인 완료 · 추가 확인 필요 · 다시 올려주세요 · 운영자 확인 중)
struct VaccinationResultBlock: View {
    let badge: VaccinationBadge

    var body: some View {
        let (icon, color, text, title, detail): (String, Color, Color, String, String) = {
            switch badge {
            case .needsMore: ("exclamationmark", Color(hex: 0xA86F00), Color(hex: 0x6E4A00), "추가 확인 필요",
                              "AI가 서류 일부를 읽지 못했어요. 서류를 더 올리거나 읽은 내용을 고쳐주세요.")
            case .reupload: ("arrow.counterclockwise", PawFitColor.errorBorder, PawFitColor.errorText, "다시 올려주세요",
                             "글자를 읽을 수 없어요. 밝은 곳에서 서류 전체가 보이게 찍어주세요.")
            case .operatorReview: ("person.badge.clock", Color(hex: 0x2C5FA8), Color(hex: 0x1F4A87), "운영자가 확인하고 있어요",
                                   "1~2일 걸려요. 끝나면 알림을 보내드려요.")
            default: ("checkmark", PawFitColor.brand, PawFitColor.brand, "확인 완료", "AI가 접종일과 접종 항목을 읽었어요")
            }
        }()
        VStack(alignment: .leading, spacing: 8) {
            HStack(spacing: 10) {
                Image(systemName: icon).font(.system(size: 14, weight: .bold)).foregroundStyle(.white)
                    .frame(width: 32, height: 32).background(color, in: Circle())
                Text(title).font(.pawfit(16, .semibold)).foregroundStyle(text)
            }
            Text(detail).font(.pawfit(14)).lineSpacing(3).foregroundStyle(Color(hex: 0x4A4A50))
            Text("AI 확인은 보조 수단이에요. 최종 판단은 운영자 확인을 따라요.")
                .font(.pawfit(12.5)).foregroundStyle(PawFitColor.textSecondary).padding(.top, 4)
        }
        .padding(18)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(color.opacity(0.08), in: RoundedRectangle(cornerRadius: 18))
        .accessibilityElement(children: .combine)
    }
}

/// ④ 내용 고치기
struct VaccinationEditView: View {
    let dogName: String
    let record: VaccinationRecord
    let onSave: ([VaccinationCorrection.Item]) -> Void

    @State private var dateText = ""
    @State private var selected: Set<Vaccine> = []
    @State private var aiDate: String?

    var body: some View {
        VStack(spacing: 0) {
            ScrollView {
                VStack(alignment: .leading, spacing: 14) {
                    Text("서류와 다른 부분을 고쳐주세요").font(.pawfit(22, .bold)).padding(.top, 18)
                    Text("고친 내용은 운영자가 서류와 비교해서 확인해요.").font(.pawfit(14)).foregroundStyle(PawFitColor.textSecondary)

                    VStack(alignment: .leading, spacing: 6) {
                        FieldLabel(text: "반려견")
                        BoxPicker(text: dogName, systemImage: "lock") {}
                            .disabled(true)
                    }
                    VStack(alignment: .leading, spacing: 6) {
                        FieldLabel(text: "접종일")
                        BoxField(placeholder: "2026.09.10", text: $dateText, keyboard: .numbersAndPunctuation,
                                 isInvalid: !dateText.isEmpty && DateText.fromDotted(dateText) == nil)
                        if let aiDate, let shown = DateText.dotted(aiDate), DateText.fromDotted(dateText) != aiDate {
                            Label("AI가 읽은 값 \(shown) → 직접 고침", systemImage: "pencil")
                                .font(.pawfit(13)).foregroundStyle(PawFitColor.textSecondary)
                        }
                    }
                    VStack(alignment: .leading, spacing: 8) {
                        FieldLabel(text: "접종 항목")
                        FlowLayout(spacing: 8) {
                            ForEach(Vaccine.allCases) { v in
                                let on = selected.contains(v)
                                Button {
                                    if on { selected.remove(v) } else { selected.insert(v) }
                                } label: {
                                    HStack(spacing: 5) {
                                        if on { Image(systemName: "checkmark").font(.system(size: 12, weight: .bold)) }
                                        Text(v.title).font(.pawfit(14, .semibold))
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
                }
                .padding(.horizontal, 20).padding(.bottom, 24)
            }
            BottomBar {
                Button("고친 내용 저장") {
                    guard let day = DateText.fromDotted(dateText) else { return }
                    onSave(Vaccine.allCases.filter(selected.contains).map { .init(vaccineCode: $0.rawValue, vaccinatedAt: day) })
                }
                .buttonStyle(PrimaryButtonStyle())
                .disabled(DateText.fromDotted(dateText) == nil || selected.isEmpty)
            }
        }
        .onAppear {
            aiDate = record.latestDate
            dateText = DateText.dotted(record.latestDate) ?? ""
            selected = Set((record.items ?? []).compactMap { Vaccine(rawValue: $0.vaccineCode) })
        }
    }
}

/// 버튼 스타일을 조건에 따라 고를 때 쓰는 감싸개
struct AnyButtonStyle: ButtonStyle {
    private let make: (Configuration) -> AnyView
    init<S: ButtonStyle>(_ style: S) { make = { AnyView(style.makeBody(configuration: $0)) } }
    func makeBody(configuration: Configuration) -> some View { make(configuration) }
}

/// 카메라로 서류 찍기
struct CameraPicker: UIViewControllerRepresentable {
    let onImage: (UIImage) -> Void
    @Environment(\.dismiss) private var dismiss

    func makeUIViewController(context: Context) -> UIImagePickerController {
        let picker = UIImagePickerController()
        picker.sourceType = .camera
        picker.delegate = context.coordinator
        return picker
    }
    func updateUIViewController(_ uiViewController: UIImagePickerController, context: Context) {}
    func makeCoordinator() -> Coordinator { Coordinator(self) }

    final class Coordinator: NSObject, UIImagePickerControllerDelegate, UINavigationControllerDelegate {
        let parent: CameraPicker
        init(_ parent: CameraPicker) { self.parent = parent }
        func imagePickerController(_ picker: UIImagePickerController, didFinishPickingMediaWithInfo info: [UIImagePickerController.InfoKey: Any]) {
            if let image = info[.originalImage] as? UIImage { parent.onImage(image) }
            parent.dismiss()
        }
        func imagePickerControllerDidCancel(_ picker: UIImagePickerController) { parent.dismiss() }
    }
}
