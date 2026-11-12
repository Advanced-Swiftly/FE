import SwiftUI

// 캔버스 화면에 반복해서 나오는 공용 부품
// 상단 바 44 · 주요 버튼 54/16 · 입력칸 52/14 · 카드 18 · 시트 28

// MARK: - 상단 바 (뒤로 + 제목)

struct TopBar<Trailing: View>: View {
    let title: String
    var titleColor: Color = PawFitColor.textPrimary
    var leading: TopBarLeading = .back
    var onLeading: (() -> Void)?
    @ViewBuilder var trailing: () -> Trailing

    @Environment(\.dismiss) private var dismiss

    enum TopBarLeading { case back, close, none }

    var body: some View {
        ZStack {
            Text(title)
                .font(.pawfit(17, .semibold))
                .foregroundStyle(titleColor)
                .accessibilityAddTraits(.isHeader)
            HStack {
                if leading != .none {
                    Button {
                        if let onLeading { onLeading() } else { dismiss() }
                    } label: {
                        Image(systemName: leading == .back ? "chevron.left" : "xmark")
                            .font(.system(size: 20, weight: .regular))
                            .foregroundStyle(leading == .close ? PawFitColor.brand : PawFitColor.textPrimary)
                            .frame(width: 44, height: 44)
                    }
                    .accessibilityLabel(leading == .back ? "뒤로" : "닫기")
                }
                Spacer()
                trailing()
            }
            .padding(.horizontal, 4)
        }
        .frame(height: 44)
    }
}

extension TopBar where Trailing == EmptyView {
    init(title: String, titleColor: Color = PawFitColor.textPrimary, leading: TopBarLeading = .back, onLeading: (() -> Void)? = nil) {
        self.init(title: title, titleColor: titleColor, leading: leading, onLeading: onLeading) { EmptyView() }
    }
}

// MARK: - 버튼

struct PrimaryButtonStyle: ButtonStyle {
    var fontSize: CGFloat = 17
    @Environment(\.isEnabled) private var isEnabled

    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(.pawfit(fontSize, .semibold))
            .foregroundStyle(.white)
            .frame(maxWidth: .infinity, minHeight: 54)
            .background(PawFitColor.brand.opacity(isEnabled ? 1 : 0.35), in: RoundedRectangle(cornerRadius: 16))
            .scaleEffect(configuration.isPressed ? 0.98 : 1)
            .animation(.easeOut(duration: 0.12), value: configuration.isPressed)
    }
}

struct SecondaryButtonStyle: ButtonStyle {
    var fontSize: CGFloat = 16
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(.pawfit(fontSize, .semibold))
            .foregroundStyle(PawFitColor.brand)
            .frame(maxWidth: .infinity, minHeight: 54)
            .background(Color.white, in: RoundedRectangle(cornerRadius: 16))
            .overlay(RoundedRectangle(cornerRadius: 16).strokeBorder(PawFitColor.brand, lineWidth: 1.5))
            .opacity(configuration.isPressed ? 0.7 : 1)
    }
}

/// 회색 테두리 보조 버튼 (A8 [내용 고치기] 등)
struct NeutralButtonStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(.pawfit(16, .semibold))
            .foregroundStyle(PawFitColor.textPrimary)
            .frame(maxWidth: .infinity, minHeight: 54)
            .background(Color.white, in: RoundedRectangle(cornerRadius: 16))
            .overlay(RoundedRectangle(cornerRadius: 16).strokeBorder(PawFitColor.separator, lineWidth: 1))
            .opacity(configuration.isPressed ? 0.7 : 1)
    }
}

/// 화면 아래 고정 버튼 자리 (padding 12 16 + 안전 영역)
struct BottomBar<Content: View>: View {
    var showsDivider = false
    @ViewBuilder var content: () -> Content

    var body: some View {
        VStack(spacing: 6) { content() }
            .padding(.horizontal, 16)
            .padding(.top, 12)
            .padding(.bottom, 8)
            .frame(maxWidth: .infinity)
            .background(PawFitColor.background)
            .overlay(alignment: .top) {
                if showsDivider { Rectangle().fill(PawFitColor.separator).frame(height: 0.5) }
            }
    }
}

/// 밑줄 없는 글자 버튼 (#3A2E78 15 semibold)
struct TextLinkButton: View {
    let title: String
    var systemImage: String?
    var color: Color = PawFitColor.brand
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: 6) {
                if let systemImage { Image(systemName: systemImage).font(.system(size: 15, weight: .semibold)) }
                Text(title).font(.pawfit(15, .semibold))
            }
            .foregroundStyle(color)
            .frame(minHeight: 44)
        }
    }
}

// MARK: - 입력칸

struct FieldLabel: View {
    let text: String
    var optional = false
    var body: some View {
        HStack(spacing: 4) {
            Text(text).font(.pawfit(15, .semibold)).foregroundStyle(PawFitColor.textPrimary)
            if optional { Text("(선택)").font(.pawfit(15)).foregroundStyle(PawFitColor.textSecondary) }
        }
        .padding(.horizontal, 4)
    }
}

/// 흰 입력칸 (52 · 모서리 14 · 테두리 #E5E5EA, 포커스 시 브랜드 1.5)
struct BoxField: View {
    let placeholder: String
    @Binding var text: String
    var keyboard: UIKeyboardType = .default
    var isSecure = false
    var unit: String?
    var isInvalid = false
    @FocusState private var focused: Bool

    var body: some View {
        HStack {
            Group {
                if isSecure {
                    SecureField(placeholder, text: $text, prompt: prompt)
                } else {
                    TextField(placeholder, text: $text, prompt: prompt)
                }
            }
            .font(.pawfit(15))
            .keyboardType(keyboard)
            .textInputAutocapitalization(.never)
            .autocorrectionDisabled()
            .focused($focused)
            if let unit { Text(unit).font(.pawfit(14)).foregroundStyle(PawFitColor.textSecondary) }
        }
        .padding(.horizontal, 16)
        .frame(height: 52)
        .background(Color.white, in: RoundedRectangle(cornerRadius: 14))
        .overlay(RoundedRectangle(cornerRadius: 14).strokeBorder(borderColor, lineWidth: focused || isInvalid ? 1.5 : 1))
        .tint(PawFitColor.brand)
    }

    private var prompt: Text { Text(placeholder).foregroundStyle(PawFitColor.textTertiary) }
    private var borderColor: Color {
        isInvalid ? PawFitColor.errorBorder : (focused ? PawFitColor.brand : PawFitColor.separator)
    }
}

/// 입력칸 모양의 선택 버튼 (품종 검색 · 나이 선택 등)
struct BoxPicker: View {
    let text: String
    var placeholder = false
    var systemImage = "chevron.down"
    var leadingImage: String?
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: 10) {
                if let leadingImage {
                    Image(systemName: leadingImage).foregroundStyle(PawFitColor.iconGray)
                }
                Text(text)
                    .font(.pawfit(15))
                    .foregroundStyle(placeholder ? PawFitColor.textTertiary : PawFitColor.textPrimary)
                Spacer()
                Image(systemName: systemImage).font(.system(size: 13, weight: .semibold)).foregroundStyle(PawFitColor.iconGray)
            }
            .padding(.horizontal, 16)
            .frame(height: 52)
            .background(Color.white, in: RoundedRectangle(cornerRadius: 14))
            .overlay(RoundedRectangle(cornerRadius: 14).strokeBorder(PawFitColor.separator, lineWidth: 1))
        }
    }
}

/// 둘 중 하나 고르기 (남아/여아)
struct SegmentPicker<T: Hashable>: View {
    let options: [(T, String)]
    @Binding var selection: T?

    var body: some View {
        HStack(spacing: 4) {
            ForEach(options, id: \.0) { value, title in
                let on = selection == value
                Button { selection = value } label: {
                    Text(title)
                        .font(.pawfit(15, on ? .semibold : .regular))
                        .foregroundStyle(on ? PawFitColor.brand : PawFitColor.iconGray)
                        .frame(maxWidth: .infinity, minHeight: 44)
                        .background(on ? Color.white : .clear, in: RoundedRectangle(cornerRadius: 10))
                        .shadow(color: on ? .black.opacity(0.08) : .clear, radius: 2, y: 1)
                }
                .accessibilityAddTraits(on ? .isSelected : [])
            }
        }
        .padding(4)
        .background(PawFitColor.surfaceNeutral, in: RoundedRectangle(cornerRadius: 14))
    }
}

// MARK: - 반려견 아바타

/// 사진이 없으면 강아지 그림(기본 반려견) 또는 이름 첫 글자 원(#8A7FB8)
struct DogAvatar: View {
    let name: String
    var size: CGFloat = 40
    var illustrated = true
    var ring = false

    var body: some View {
        Group {
            if illustrated {
                DogFace().frame(width: size, height: size)
                    .background(PawFitColor.brandTint)
            } else {
                Text(String(name.prefix(1)))
                    .font(.pawfit(size * 0.4, .semibold))
                    .foregroundStyle(.white)
                    .frame(width: size, height: size)
                    .background(PawFitColor.dogNoPhoto)
            }
        }
        .clipShape(Circle())
        .overlay { if ring { Circle().strokeBorder(PawFitColor.brand, lineWidth: 2) } }
        .accessibilityHidden(true)
    }
}

/// 캔버스의 강아지 얼굴 그림 (귀 · 얼굴 · 눈 · 코)
struct DogFace: View {
    var body: some View {
        Canvas { ctx, size in
            let s = size.width / 24
            func ellipse(_ cx: CGFloat, _ cy: CGFloat, _ rx: CGFloat, _ ry: CGFloat) -> Path {
                Path(ellipseIn: CGRect(x: (cx - rx) * s, y: (cy - ry) * s, width: rx * 2 * s, height: ry * 2 * s))
            }
            ctx.fill(ellipse(6.2, 13.5, 3.6, 5.6), with: .color(Color(hex: 0xE3DDD3)))
            ctx.fill(ellipse(17.8, 13.5, 3.6, 5.6), with: .color(Color(hex: 0xE3DDD3)))
            ctx.fill(ellipse(12, 12.6, 6.6, 6.6), with: .color(.white))
            ctx.fill(ellipse(9.7, 11.8, 1, 1), with: .color(PawFitColor.textPrimary))
            ctx.fill(ellipse(14.3, 11.8, 1, 1), with: .color(PawFitColor.textPrimary))
            ctx.fill(ellipse(12, 14.7, 1.3, 1), with: .color(PawFitColor.textPrimary))
        }
    }
}

// MARK: - 판정 표시

/// 판정 색 원 + 흰 모양
struct VerdictDot: View {
    let verdict: Verdict
    var size: CGFloat = 16

    var body: some View {
        Image(systemName: verdict.symbol)
            .font(.system(size: size * 0.55, weight: .heavy))
            .foregroundStyle(.white)
            .frame(width: size, height: size)
            .background(verdict.fill, in: Circle())
            .accessibilityHidden(true)
    }
}

/// 원 + 판정 이름 (목록 줄)
struct VerdictLabel: View {
    let verdict: Verdict
    var fontSize: CGFloat = 13
    var body: some View {
        HStack(spacing: 5) {
            VerdictDot(verdict: verdict, size: 15)
            Text(verdict.title).font(.pawfit(fontSize, .semibold)).foregroundStyle(verdict.text)
        }
        .accessibilityElement(children: .combine)
    }
}

// MARK: - 칩 · 카드

/// 브랜드 틴트 칩 (준비물 · 접종 확인)
struct InfoChip: View {
    let title: String
    var systemImage: String? = "checkmark"
    var tint: Color = PawFitColor.brand
    var background: Color = PawFitColor.brandTint
    var body: some View {
        HStack(spacing: 5) {
            if let systemImage { Image(systemName: systemImage).font(.system(size: 11, weight: .bold)) }
            Text(title).font(.pawfit(13.5, .semibold))
        }
        .foregroundStyle(tint)
        .padding(.leading, 10).padding(.trailing, 12)
        .frame(height: 32)
        .background(background, in: Capsule())
    }
}

/// 흰 카드 (모서리 18 · 0.5 테두리)
struct CardBox<Content: View>: View {
    var padding: CGFloat = 16
    @ViewBuilder var content: () -> Content
    var body: some View {
        VStack(alignment: .leading, spacing: 0) { content() }
            .padding(padding)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(Color.white, in: RoundedRectangle(cornerRadius: 18))
            .overlay(RoundedRectangle(cornerRadius: 18).strokeBorder(PawFitColor.separator, lineWidth: 0.5))
    }
}

struct SheetGrabber: View {
    var body: some View {
        Capsule().fill(Color(hex: 0xD1D1D6)).frame(width: 36, height: 5).padding(.top, 8)
    }
}

// MARK: - 확인 팝업 (로그아웃 · 반려견 삭제)

struct ConfirmDialog: View {
    let title: String
    let message: String
    let confirmTitle: String
    var destructive = false
    let onCancel: () -> Void
    let onConfirm: () -> Void

    var body: some View {
        ZStack {
            Color.black.opacity(0.32).ignoresSafeArea().onTapGesture(perform: onCancel)
            VStack(alignment: .leading, spacing: 0) {
                Text(title).font(.pawfit(18, .semibold)).foregroundStyle(PawFitColor.textPrimary)
                Text(message).font(.pawfit(14.5)).lineSpacing(3).foregroundStyle(PawFitColor.iconGray).padding(.top, 10)
                HStack(spacing: 8) {
                    Button(action: onCancel) {
                        Text("취소").font(.pawfit(16, .semibold)).foregroundStyle(PawFitColor.textPrimary)
                            .frame(maxWidth: .infinity, minHeight: 50)
                            .background(PawFitColor.surfaceNeutral, in: RoundedRectangle(cornerRadius: 14))
                    }
                    Button(action: onConfirm) {
                        Text(confirmTitle).font(.pawfit(16, .semibold)).foregroundStyle(.white)
                            .frame(maxWidth: .infinity, minHeight: 50)
                            .background(destructive ? PawFitColor.errorBorder : PawFitColor.brand, in: RoundedRectangle(cornerRadius: 14))
                    }
                }
                .padding(.top, 22)
            }
            .padding(22)
            .background(PawFitColor.background, in: RoundedRectangle(cornerRadius: 24))
            .padding(.horizontal, 28)
            .accessibilityAddTraits(.isModal)
        }
        .transition(.opacity)
    }
}

// MARK: - 불러오는 중 · 오류

struct LoadingView: View {
    var text = "불러오는 중이에요"
    var body: some View {
        VStack(spacing: 12) {
            ProgressView().tint(PawFitColor.brand)
            Text(text).font(.pawfit(14)).foregroundStyle(PawFitColor.textSecondary)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }
}

struct ErrorRetryView: View {
    let message: String
    let retry: () -> Void
    var body: some View {
        VStack(spacing: 14) {
            Image(systemName: "exclamationmark.circle").font(.system(size: 28)).foregroundStyle(PawFitColor.errorBorder)
            Text(message).font(.pawfit(15)).foregroundStyle(PawFitColor.textPrimary).multilineTextAlignment(.center)
            Button("다시 시도", action: retry).font(.pawfit(15, .semibold)).foregroundStyle(PawFitColor.brand).frame(minHeight: 44)
        }
        .padding(24)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }
}

/// 화면 아래에 잠깐 뜨는 안내 (저장했어요 · 오류)
struct ToastModifier: ViewModifier {
    @Binding var message: String?
    func body(content: Content) -> some View {
        content.overlay(alignment: .bottom) {
            if let message {
                Text(message)
                    .font(.pawfit(14, .semibold))
                    .foregroundStyle(.white)
                    .padding(.horizontal, 18).padding(.vertical, 12)
                    .background(PawFitColor.textPrimary.opacity(0.92), in: Capsule())
                    .padding(.bottom, 110)
                    .transition(.move(edge: .bottom).combined(with: .opacity))
                    .task(id: message) {
                        try? await Task.sleep(for: .seconds(2.2))
                        withAnimation { self.message = nil }
                    }
                    .accessibilityAddTraits(.updatesFrequently)
            }
        }
        .animation(.easeOut(duration: 0.2), value: message)
    }
}

extension View {
    func toast(_ message: Binding<String?>) -> some View { modifier(ToastModifier(message: message)) }

    /// 시트 · 전체 화면 기본 배경
    func screenBackground(_ color: Color = PawFitColor.background) -> some View {
        background(color.ignoresSafeArea())
    }
}

extension APIError {
    /// 화면에 띄울 문구 (`APIError`가 아니면 연결 오류로 본다)
    static func message(_ error: Error) -> String {
        (error as? APIError)?.userMessage ?? APIError.network.userMessage
    }
}
