import SwiftUI

/// S1 로그인의 '눌려 들어간' 입력칸 (높이 53, 모서리 16, 안쪽 그림자 #DCDFE6 / #FFFFFF)
/// 로그인 화면 전용 스타일. 회원가입 S2~S4는 기본 흰 입력칸을 쓴다.
struct InsetTextField<FocusID: Hashable>: View {
    let placeholder: String
    @Binding var text: String
    var isSecure: Bool = false
    var isInvalid: Bool = false
    var contentType: UITextContentType? = nil
    var keyboard: UIKeyboardType = .default
    var submitLabel: SubmitLabel = .next
    var onSubmit: () -> Void = {}
    /// 화면의 FocusState와 이 칸의 ID. 비밀번호 보기를 눌러도 커서가 유지된다.
    let focus: FocusState<FocusID?>.Binding
    let focusID: FocusID

    @State private var isRevealed = false

    var body: some View {
        HStack(spacing: 0) {
            field
                .font(.pawfit(PawFitType.input))
                .foregroundStyle(PawFitColor.textPrimary)
                .tint(PawFitColor.brand)
                .textContentType(contentType)
                .keyboardType(keyboard)
                .textInputAutocapitalization(.never)
                .autocorrectionDisabled()
                .submitLabel(submitLabel)
                .onSubmit(onSubmit)
                .focused(focus, equals: focusID)
                .padding(.leading, 22)
                .padding(.trailing, isSecure ? 4 : 22)

            if isSecure {
                Button {
                    isRevealed.toggle()
                    // SecureField ↔ TextField가 바뀐 뒤 다시 커서를 둔다
                    Task { @MainActor in focus.wrappedValue = focusID }
                } label: {
                    Image(systemName: isRevealed ? "eye" : "eye.slash")
                        .font(.system(size: 18, weight: .regular))
                        .foregroundStyle(PawFitColor.iconGray)
                        .frame(width: PawFitSize.minTapTarget, height: PawFitSize.minTapTarget)
                }
                .padding(.trailing, 8)
                .accessibilityLabel(isRevealed ? "비밀번호 가리기" : "비밀번호 보기")
            }
        }
        .frame(height: PawFitSize.loginField)
        .background(insetBackground)
        .overlay {
            if isInvalid {
                RoundedRectangle(cornerRadius: PawFitRadius.loginField)
                    .strokeBorder(PawFitColor.errorBorder, lineWidth: 1.5)
            }
        }
        .contentShape(Rectangle())
        .onTapGesture { focus.wrappedValue = focusID }
    }

    @ViewBuilder
    private var field: some View {
        let prompt = Text(placeholder).foregroundStyle(PawFitColor.loginPlaceholder)
        if isSecure && !isRevealed {
            SecureField(placeholder, text: $text, prompt: prompt)
        } else {
            TextField(placeholder, text: $text, prompt: prompt)
        }
    }

    private var insetBackground: some View {
        RoundedRectangle(cornerRadius: PawFitRadius.loginField)
            .fill(
                PawFitColor.loginBackground
                    .shadow(.inner(color: PawFitColor.insetShadowDark, radius: 4.5, x: 4, y: 4))
                    .shadow(.inner(color: PawFitColor.insetShadowLight, radius: 4.5, x: -4, y: -4))
            )
    }
}

#Preview {
    @Previewable @State var email = ""
    @Previewable @State var pw = "pawfit1234"
    @Previewable @FocusState var focus: Int?
    VStack(spacing: 18) {
        InsetTextField(placeholder: "이메일", text: $email, focus: $focus, focusID: 0)
        InsetTextField(placeholder: "비밀번호", text: $pw, isSecure: true, isInvalid: true, focus: $focus, focusID: 1)
    }
    .padding(28)
    .background(PawFitColor.loginBackground)
}
