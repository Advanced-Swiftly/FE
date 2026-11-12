import SwiftUI

/// 회원가입 3단계: S-002 약관 → S-003 비밀번호 · 이름 · 배송지 → S-004 휴대폰 인증(→ 가입) → S-005 가입 완료(출입증)
/// 서버 순서: GET /terms?role=GUARDIAN → POST /auth/phone-verifications → …/confirm → POST /auth/signup/guardian
struct SignUpFlow: View {
    @Environment(AppSession.self) private var session
    @Environment(\.appEnvironment) private var env
    @Environment(\.dismiss) private var dismiss
    @AppStorage("pawfit.shippingAddress") private var savedAddress = ""

    @State private var step = 1
    @State private var terms: [Term] = []
    @State private var agreed: Set<Int64> = []
    @State private var loadError: String?

    @State private var password = ""
    @State private var password2 = ""
    @State private var showPassword = false
    @State private var name = ""
    @State private var address = ""

    @State private var phone = ""
    @State private var verificationId: Int64?
    @State private var code = ""
    @State private var expiresAt: Date?
    @State private var now = Date.now

    @State private var busy = false
    @State private var message: String?
    @State private var signedUpName: String?
    @FocusState private var focus: Field?

    enum Field { case password, password2, name, address, phone, code }

    var body: some View {
        Group {
            if let signedUpName {
                SignUpDoneView(name: signedUpName,
                               onRegisterDog: { session.signedIn(name: signedUpName, registerDog: true) },
                               onLater: { session.signedIn(name: signedUpName) })
            } else {
                form
            }
        }
        .toolbar(.hidden, for: .navigationBar)
        .toast($message)
    }

    private var form: some View {
        VStack(spacing: 0) {
            TopBar(title: "회원가입", onLeading: {
                if step == 1 { dismiss() } else { step -= 1 }
            })
            HStack(spacing: 6) {
                ForEach(1...3, id: \.self) { i in
                    Capsule().fill(i <= step ? PawFitColor.brand : PawFitColor.separator).frame(height: 4)
                }
            }
            .padding(.horizontal, 20).padding(.top, 8)
            .accessibilityElement().accessibilityLabel("3단계 중 \(step)단계")

            ScrollView {
                switch step {
                case 1: termsStep
                case 2: accountStep
                default: phoneStep
                }
            }
            .scrollDismissesKeyboard(.interactively)
        }
        .safeAreaInset(edge: .bottom, spacing: 0) {
            BottomBar {
                Button { Task { await next() } } label: {
                    if busy { ProgressView().tint(.white) } else { Text(step == 3 ? "인증하기" : "다음") }
                }
                .buttonStyle(PrimaryButtonStyle())
                .disabled(!canGoNext || busy)
            }
        }
        .screenBackground()
        .task { await loadTerms() }
        .onReceive(Timer.publish(every: 1, on: .main, in: .common).autoconnect()) { now = $0 }
    }

    // MARK: S-002 약관

    private var required: [Term] { terms.filter(\.required) }
    private var optional: [Term] { terms.filter { !$0.required } }

    private var termsStep: some View {
        VStack(alignment: .leading, spacing: 0) {
            heading("PawFit 이용 약관에\n동의해 주세요")
            if let loadError {
                ErrorRetryView(message: loadError) { Task { await loadTerms() } }.frame(height: 240)
            } else if terms.isEmpty {
                LoadingView().frame(height: 240)
            } else {
                let all = agreed.count == terms.count
                Button {
                    agreed = all ? [] : Set(terms.map(\.termId))
                } label: {
                    HStack(spacing: 12) {
                        check(all, size: 26)
                        VStack(alignment: .leading, spacing: 2) {
                            Text("모두 동의하기").font(.pawfit(17, .semibold)).foregroundStyle(PawFitColor.textPrimary)
                            if !optional.isEmpty {
                                Text("선택 항목인 \(optional.map(\.title).joined(separator: ", "))까지 포함해요")
                                    .font(.pawfit(13.5)).foregroundStyle(PawFitColor.textSecondary)
                            }
                        }
                        Spacer(minLength: 0)
                    }
                    .padding(.horizontal, 16).padding(.vertical, 12)
                    .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
                .accessibilityAddTraits(all ? .isSelected : [])
                .padding(.horizontal, 16).padding(.top, 20)

                Rectangle().fill(PawFitColor.separator).frame(height: 0.5).padding(.horizontal, 32).padding(.top, 6)

                VStack(spacing: 0) {
                    ForEach(required) { termRow($0) }
                    if !optional.isEmpty {
                        Rectangle().fill(PawFitColor.separator).frame(height: 0.5).padding(.vertical, 6)
                        ForEach(optional) { termRow($0) }
                        Text("댕댕로드 이벤트와 제휴 매장 쿠폰 소식을 보내드려요. 마이 › 알림 설정에서 언제든 바꿀 수 있어요.")
                            .font(.pawfit(13)).foregroundStyle(PawFitColor.textSecondary)
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .padding(.leading, 38).padding(.top, 2)
                    }
                }
                .padding(.horizontal, 16).padding(.top, 10)
            }
        }
        .padding(.bottom, 24)
    }

    private func termRow(_ term: Term) -> some View {
        let on = agreed.contains(term.termId)
        return Button {
            if on { agreed.remove(term.termId) } else { agreed.insert(term.termId) }
        } label: {
            HStack(spacing: 12) {
                check(on, size: 22)
                (Text(term.required ? "(필수) " : "(선택) ") + Text(term.title))
                    .font(.pawfit(15, on ? .semibold : .regular))
                    .foregroundStyle(on ? PawFitColor.brand : PawFitColor.textSecondary)
                    .multilineTextAlignment(.leading)
                Spacer(minLength: 0)
            }
            .frame(minHeight: 48)
            .padding(.leading, 16)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityAddTraits(on ? .isSelected : [])
    }

    private func check(_ on: Bool, size: CGFloat) -> some View {
        Image(systemName: "checkmark")
            .font(.system(size: size * 0.5, weight: .bold)).foregroundStyle(.white)
            .opacity(on ? 1 : 0)
            .frame(width: size, height: size)
            .background(on ? PawFitColor.brand : Color.clear, in: Circle())
            .overlay(Circle().strokeBorder(on ? Color.clear : Color(hex: 0xC7C7CC), lineWidth: 1.5))
    }

    // MARK: S-003 비밀번호 · 이름 · 배송지

    private var accountStep: some View {
        let rule = PasswordRule.check(password)
        return VStack(alignment: .leading, spacing: 16) {
            heading("비밀번호와 이름을 정해 주세요").padding(.horizontal, -20)

            VStack(alignment: .leading, spacing: 6) {
                FieldLabel(text: "비밀번호")
                HStack {
                    BoxField(placeholder: "", text: $password, isSecure: !showPassword)
                        .overlay(alignment: .trailing) {
                            Button { showPassword.toggle() } label: {
                                Image(systemName: showPassword ? "eye.slash" : "eye").foregroundStyle(PawFitColor.iconGray)
                                    .frame(width: 44, height: 44)
                            }
                            .accessibilityLabel(showPassword ? "비밀번호 숨기기" : "비밀번호 보기")
                            .padding(.trailing, 4)
                        }
                }
                HStack(spacing: 6) {
                    ruleChip("영문", rule.letter)
                    ruleChip("특수기호", rule.symbol)
                    ruleChip("8자 이상", rule.length)
                }
                .padding(.top, 2)
                .accessibilityElement(children: .combine)
                .accessibilityLabel("비밀번호 조건")
            }
            VStack(alignment: .leading, spacing: 6) {
                FieldLabel(text: "비밀번호 확인")
                BoxField(placeholder: "", text: $password2, isSecure: true,
                         isInvalid: !password2.isEmpty && password2 != password)
                if !password2.isEmpty {
                    Label(password2 == password ? "비밀번호가 같아요" : "비밀번호가 달라요",
                          systemImage: password2 == password ? "checkmark" : "exclamationmark.circle")
                        .font(.pawfit(13.5))
                        .foregroundStyle(password2 == password ? PawFitColor.brand : PawFitColor.errorText)
                        .padding(.horizontal, 4)
                }
            }
            VStack(alignment: .leading, spacing: 6) {
                FieldLabel(text: "보호자 이름")
                BoxField(placeholder: "", text: $name).textContentType(.name)
                Text("챗봇과 알림에서 이 이름으로 불러드려요").font(.pawfit(13)).foregroundStyle(PawFitColor.textSecondary).padding(.horizontal, 4)
            }
            VStack(alignment: .leading, spacing: 6) {
                FieldLabel(text: "배송지", optional: true)
                BoxField(placeholder: "도로명, 건물명, 지번 + 상세 주소", text: $address)
                Text("댕댕로드 상품에 당첨되면 이 주소로 보내드려요. 나중에 마이에서 입력해도 돼요.")
                    .font(.pawfit(13)).foregroundStyle(PawFitColor.textSecondary).padding(.horizontal, 4)
            }
        }
        .padding(.horizontal, 20).padding(.bottom, 24)
    }

    private func ruleChip(_ title: String, _ ok: Bool) -> some View {
        HStack(spacing: 4) {
            Image(systemName: ok ? "checkmark" : "minus").font(.system(size: 11, weight: .bold))
            Text(title).font(.pawfit(13, .semibold))
        }
        .foregroundStyle(ok ? PawFitColor.brand : PawFitColor.textSecondary)
        .padding(.leading, 8).padding(.trailing, 10).frame(height: 28)
        .background(ok ? PawFitColor.brandTint : PawFitColor.surfaceNeutral, in: Capsule())
    }

    // MARK: S-004 휴대폰 인증

    private var remaining: Int? {
        guard let expiresAt else { return nil }
        return max(0, Int(expiresAt.timeIntervalSince(now)))
    }

    private var phoneStep: some View {
        VStack(alignment: .leading, spacing: 22) {
            VStack(alignment: .leading, spacing: 8) {
                heading("휴대폰 번호를 인증해 주세요").padding(.horizontal, -20)
                Text("로그인할 때 이 번호를 써요. 댕댕로드 당첨 연락도 이 번호로 드려요.")
                    .font(.pawfit(14)).foregroundStyle(PawFitColor.textSecondary)
            }
            VStack(alignment: .leading, spacing: 6) {
                FieldLabel(text: "휴대폰 번호")
                HStack(spacing: 8) {
                    BoxField(placeholder: "010-0000-0000", text: Binding(
                        get: { phone }, set: { phone = PhoneRule.format($0) }), keyboard: .numberPad)
                    Button(verificationId == nil ? "인증번호 받기" : "다시 받기") { Task { await sendCode() } }
                        .font(.pawfit(15, .semibold)).foregroundStyle(PawFitColor.brand)
                        .padding(.horizontal, 16).frame(height: 52)
                        .background(Color.white, in: RoundedRectangle(cornerRadius: 14))
                        .overlay(RoundedRectangle(cornerRadius: 14).strokeBorder(PawFitColor.separator))
                        .disabled(!PhoneRule.isValid(phone) || busy)
                        .fixedSize()
                }
                if verificationId != nil {
                    Label("인증번호를 문자로 보냈어요", systemImage: "checkmark").font(.pawfit(13.5)).foregroundStyle(PawFitColor.brand)
                        .padding(.horizontal, 4)
                }
            }
            if verificationId != nil {
                VStack(alignment: .leading, spacing: 8) {
                    HStack {
                        FieldLabel(text: "인증번호 6자리")
                        Spacer()
                        if let remaining {
                            Text(String(format: "%02d:%02d", remaining / 60, remaining % 60))
                                .font(.pawfit(15, .semibold).monospacedDigit())
                                .foregroundStyle(remaining == 0 ? PawFitColor.errorText : PawFitColor.brand)
                                .accessibilityLabel("남은 시간 \(remaining / 60)분 \(remaining % 60)초")
                        }
                    }
                    ZStack {
                        HStack(spacing: 8) {
                            ForEach(0..<6, id: \.self) { i in
                                let chars = Array(code)
                                let active = focus == .code && i == min(chars.count, 5)
                                Text(i < chars.count ? String(chars[i]) : "")
                                    .font(.pawfit(24, .semibold))
                                    .frame(maxWidth: .infinity).frame(height: 58)
                                    .background(Color.white, in: RoundedRectangle(cornerRadius: 14))
                                    .overlay(RoundedRectangle(cornerRadius: 14)
                                        .strokeBorder(active ? PawFitColor.brand : PawFitColor.separator, lineWidth: active ? 1.5 : 1))
                            }
                        }
                        TextField("", text: Binding(get: { code }, set: { code = String($0.filter(\.isNumber).prefix(6)) }))
                            .keyboardType(.numberPad)
                            .textContentType(.oneTimeCode)
                            .focused($focus, equals: .code)
                            .foregroundStyle(.clear).tint(.clear)
                            .accessibilityLabel("인증번호 6자리")
                    }
                    Text("문자가 오면 키보드 위에 번호가 떠요. 눌러서 바로 채울 수 있어요.")
                        .font(.pawfit(13)).foregroundStyle(PawFitColor.textSecondary).padding(.horizontal, 4)
                    if env.usesMock {
                        Text("시연용 인증번호: 123456").font(.pawfit(13, .semibold)).foregroundStyle(PawFitColor.iconGray).padding(.horizontal, 4)
                    }
                }
            }
        }
        .padding(.horizontal, 20).padding(.bottom, 24)
    }

    // MARK: 공통

    private func heading(_ text: String) -> some View {
        Text(text).font(.pawfit(22, .bold)).tracking(-0.4).lineSpacing(2)
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(.horizontal, 20).padding(.top, 22)
            .accessibilityAddTraits(.isHeader)
    }

    private var canGoNext: Bool {
        switch step {
        case 1: !terms.isEmpty && required.allSatisfy { agreed.contains($0.termId) }
        case 2: PasswordRule.isValid(password) && password == password2 && !name.trimmingCharacters(in: .whitespaces).isEmpty
        default: verificationId != nil && code.count == 6 && (remaining ?? 1) > 0
        }
    }

    private func loadTerms() async {
        guard terms.isEmpty else { return }
        loadError = nil
        do { terms = try await env.api.terms() }
        catch { loadError = APIError.message(error) }
    }

    private func next() async {
        switch step {
        case 1: step = 2
        case 2:
            focus = nil
            step = 3
        default:
            await verifyAndSignUp()
        }
    }

    private func sendCode() async {
        busy = true; defer { busy = false }
        do {
            let sent = try await env.api.sendPhoneCode(phone)
            verificationId = sent.verificationId
            expiresAt = Date.now.addingTimeInterval(TimeInterval(sent.expiresInSeconds))
            code = ""
            focus = .code
        } catch {
            message = APIError.message(error)
        }
    }

    private func verifyAndSignUp() async {
        guard let verificationId else { return }
        busy = true; defer { busy = false }
        do {
            let token = try await env.api.confirmPhoneCode(id: verificationId, code: code)
            let trimmed = name.trimmingCharacters(in: .whitespaces)
            let response = try await env.api.signup(SignupRequest(
                phoneVerificationToken: token, name: trimmed, password: password,
                termAgreements: terms.map { .init(termId: $0.termId, agreed: agreed.contains($0.termId)) }))
            env.tokenStore.save(AuthTokens(accessToken: response.accessToken, refreshToken: response.refreshToken))
            let addr = address.trimmingCharacters(in: .whitespacesAndNewlines)
            if !addr.isEmpty { savedAddress = addr }
            focus = nil
            withAnimation { signedUpName = trimmed }
        } catch {
            message = APIError.message(error)
            if case APIError.server(.duplicatePhoneNumber, _, _) = error { self.verificationId = nil }
        }
    }
}

/// S-005 가입 완료 — PawFit 출입증
struct SignUpDoneView: View {
    let name: String
    let onRegisterDog: () -> Void
    let onLater: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            Text("가입을 마쳤어요").font(.pawfit(26, .bold)).padding(.top, 68)
            Text("반려견을 등록하면 갈 수 있는 곳을\n바로 판정해 드려요.")
                .font(.pawfit(15)).lineSpacing(3).foregroundStyle(PawFitColor.textSecondary).padding(.top, 10)

            VStack(alignment: .leading, spacing: 0) {
                VStack(alignment: .leading, spacing: 18) {
                    HStack {
                        HStack(spacing: 8) {
                            Image("Logo").resizable().scaledToFit().padding(4)
                                .frame(width: 28, height: 28).background(.white, in: RoundedRectangle(cornerRadius: 9))
                            Text("PawFit").font(.pawfit(16, .bold))
                        }
                        Spacer()
                        Text("출입증").font(.pawfit(13, .semibold)).foregroundStyle(Color(hex: 0xCFC9EA))
                    }
                    HStack(spacing: 14) {
                        Text(String(name.prefix(1))).font(.pawfit(30, .semibold)).foregroundStyle(PawFitColor.brand)
                            .frame(width: 80, height: 80).background(PawFitColor.brandTint, in: Circle())
                        VStack(alignment: .leading, spacing: 4) {
                            Text("\(name) 보호자님").font(.pawfit(20, .bold))
                            Text("반려견을 등록하면\n출입증이 완성돼요").font(.pawfit(13.5)).foregroundStyle(Color(hex: 0xCFC9EA))
                        }
                    }
                }
                .padding(.horizontal, 22).padding(.top, 22).padding(.bottom, 24)

                // 절취선
                ZStack {
                    Line().stroke(Color.white.opacity(0.3), style: StrokeStyle(lineWidth: 1, dash: [4, 4])).frame(height: 1)
                    HStack {
                        Circle().fill(PawFitColor.background).frame(width: 22, height: 22).offset(x: -11)
                        Spacer()
                        Circle().fill(PawFitColor.background).frame(width: 22, height: 22).offset(x: 11)
                    }
                }
                .frame(height: 22)

                HStack(spacing: 40) {
                    VStack(alignment: .leading, spacing: 3) {
                        Text("가입일").font(.pawfit(12)).foregroundStyle(Color(hex: 0xCFC9EA))
                        Text(DateText.dotted(DateText.dayString(.now)) ?? "").font(.pawfit(15, .semibold))
                    }
                    VStack(alignment: .leading, spacing: 3) {
                        Text("등록한 반려견").font(.pawfit(12)).foregroundStyle(Color(hex: 0xCFC9EA))
                        Text("0마리").font(.pawfit(15, .semibold))
                    }
                }
                .padding(.horizontal, 22).padding(.top, 8).padding(.bottom, 20)
            }
            .foregroundStyle(.white)
            .background(PawFitColor.brand, in: RoundedRectangle(cornerRadius: 24))
            .shadow(color: PawFitColor.brand.opacity(0.3), radius: 18, y: 14)
            .padding(.top, 40)
            .accessibilityElement(children: .combine)
            .accessibilityLabel("PawFit 출입증, \(name) 보호자님, 등록한 반려견 0마리")

            Spacer()
        }
        .padding(.horizontal, 24)
        .safeAreaInset(edge: .bottom, spacing: 0) {
            BottomBar {
                Button("반려견 등록하기", action: onRegisterDog).buttonStyle(PrimaryButtonStyle())
                Button("나중에 할게요", action: onLater)
                    .font(.pawfit(15, .semibold)).foregroundStyle(PawFitColor.iconGray).frame(minHeight: 44)
            }
        }
        .screenBackground()
    }

    private struct Line: Shape {
        func path(in rect: CGRect) -> Path {
            Path { p in p.move(to: CGPoint(x: 0, y: rect.midY)); p.addLine(to: CGPoint(x: rect.maxX, y: rect.midY)) }
        }
    }
}
