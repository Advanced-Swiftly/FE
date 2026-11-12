import SwiftUI

/// UI-S-001 로그인 (캔버스 S1 · S1 오류 상태)
/// 아이디는 휴대폰 번호 (11-05 결정, 캔버스는 '이메일'로 그려져 있어 갱신 필요)
///
/// 캔버스 좌표(390×844, 상태 표시줄 없음)
///   로고 묶음 top 158 · 입력칸 묶음 top 410 · [로그인] top 570 · [회원가입] top 630
/// 오류 문구는 비밀번호 칸과 [로그인] 사이 고정 자리(36pt)에 떠서 버튼 위치가 바뀌지 않는다.
struct LoginView: View {
    @Environment(AppSession.self) private var session
    @Environment(\.appEnvironment) private var env

    var body: some View {
        LoginContent(viewModel: LoginViewModel(auth: env.auth), onSignedIn: session.signedIn(name:))
    }
}

private struct LoginContent: View {
    @State var viewModel: LoginViewModel
    let onSignedIn: @MainActor (String) -> Void

    @FocusState private var focus: LoginViewModel.Field?
    @State private var path: [AuthRoute] = []

    var body: some View {
        NavigationStack(path: $path) {
            ScrollView {
                VStack(spacing: 0) {
                    header
                        .padding(.top, 158)
                    form
                        .padding(.top, 37)
                    signUpLink
                        .padding(.top, 10)
                }
                .frame(maxWidth: .infinity)
                .padding(.bottom, 40)
            }
            .scrollBounceBehavior(.basedOnSize)
            .scrollDismissesKeyboard(.interactively)
            .background(PawFitColor.loginBackground)
            .ignoresSafeArea(.container, edges: .top)
            .toolbar(.hidden, for: .navigationBar)
            .toolbar {
                // 숫자 키패드에는 '다음' 키가 없어서 키보드 위에 둔다
                ToolbarItemGroup(placement: .keyboard) {
                    if focus == .phone {
                        Spacer()
                        Button("다음") { focus = .password }
                            .font(.pawfit(PawFitType.body, .semibold))
                            .foregroundStyle(PawFitColor.brand)
                    }
                }
            }
            .navigationDestination(for: AuthRoute.self) { route in
                switch route {
                case .signUpTerms: SignUpPlaceholderView()
                }
            }
        }
    }

    // MARK: 로고 · 이름 · 소개

    private var header: some View {
        VStack(spacing: 0) {
            Image("Logo")
                .resizable()
                .scaledToFit()
                .frame(width: 103, height: 95)
                .accessibilityHidden(true)
            Text("PawFit")
                .font(.pawfit(PawFitType.display, .bold, relativeTo: .largeTitle))
                .tracking(-1)
                .foregroundStyle(PawFitColor.textPrimary)
                .padding(.top, 16)
                .accessibilityAddTraits(.isHeader)
            Text("반려견과 갈 수 있는 곳,\n가기 전에 확인해요")
                .font(.pawfit(PawFitType.body))
                .lineSpacing(15 * 0.6)
                .multilineTextAlignment(.center)
                .foregroundStyle(PawFitColor.iconGray)
                .padding(.top, 12)
        }
        .padding(.horizontal, 32)
    }

    // MARK: 입력칸 · 오류 · [로그인]

    private var form: some View {
        VStack(spacing: 0) {
            VStack(spacing: 18) {
                InsetTextField(
                    placeholder: "휴대폰 번호",
                    text: $viewModel.phone,
                    contentType: .username,          // 비밀번호 자동 완성과 짝을 맞춤
                    keyboard: .numberPad,
                    submitLabel: .next,
                    onSubmit: { focus = .password },
                    focus: $focus,
                    focusID: .phone
                )

                InsetTextField(
                    placeholder: "비밀번호",
                    text: $viewModel.password,
                    isSecure: true,
                    isInvalid: viewModel.showsError,
                    contentType: .password,
                    submitLabel: .go,
                    onSubmit: submit,
                    focus: $focus,
                    focusID: .password
                )
            }
            .padding(.horizontal, 28)

            errorSlot

            PillButton(title: "로그인", isLoading: viewModel.isLoading, action: submit)
        }
    }

    private var errorSlot: some View {
        ZStack {
            if let message = viewModel.errorMessage {
                Label {
                    Text(message)
                } icon: {
                    Image(systemName: "exclamationmark.circle")
                        .foregroundStyle(PawFitColor.errorBorder)
                }
                .labelStyle(TightLabelStyle())
                .font(.pawfit(13.5, .semibold, relativeTo: .footnote))
                .foregroundStyle(PawFitColor.errorText)
                .transition(.opacity)
            }
        }
        .frame(height: 36)
        .frame(maxWidth: .infinity)
        .padding(.horizontal, 28)
        .animation(.easeOut(duration: 0.15), value: viewModel.errorMessage)
    }

    private var signUpLink: some View {
        Button {
            path.append(.signUpTerms)
        } label: {
            Text("회원가입")
                .font(.pawfit(PawFitType.button))
                .underline()
                .foregroundStyle(PawFitColor.textPrimary)
                .padding(.horizontal, 12)
                .frame(minHeight: PawFitSize.minTapTarget)
        }
    }

    private func submit() {
        if let empty = viewModel.firstEmptyField {
            focus = empty
            return
        }
        Task {
            if let name = await viewModel.login() {
                focus = nil
                onSignedIn(name)
            } else if let message = viewModel.errorMessage {
                AccessibilityNotification.Announcement(message).post()
            }
        }
    }
}

enum AuthRoute: Hashable {
    case signUpTerms
}

private struct TightLabelStyle: LabelStyle {
    func makeBody(configuration: Configuration) -> some View {
        HStack(spacing: 6) {
            configuration.icon
            configuration.title
        }
    }
}

#Preview("S1 로그인") {
    LoginView()
        .environment(AppSession())
        .environment(\.appEnvironment, .preview)
}
