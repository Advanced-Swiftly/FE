import SwiftUI

// MARK: - 휴대폰 번호 변경

/// 보호자 계정 관리 > 휴대폰 번호
/// 새 번호로 인증번호 받기(purpose CHANGE_PHONE) → 확인 → PATCH /users/me { phoneVerificationToken }
/// 서버는 인증된 번호로 바꾸고, 다른 계정이 쓰는 번호면 DUPLICATE_PHONE_NUMBER를 준다.
struct PhoneChangeSheet: View {
    let currentPhone: String
    let onChanged: (ProfileUpdated) -> Void

    @Environment(AppStore.self) private var store
    @Environment(\.appEnvironment) private var env
    @Environment(\.dismiss) private var dismiss
    @State private var phone = ""
    @State private var code = ""
    @State private var verificationId: Int64?
    @State private var expiresAt: Date?
    @State private var now = Date.now
    @State private var busy = false
    @State private var error: String?

    private var remaining: Int? {
        guard let expiresAt else { return nil }
        return max(0, Int(expiresAt.timeIntervalSince(now)))
    }
    private var isSameAsCurrent: Bool { PhoneRule.digits(phone) == PhoneRule.digits(currentPhone) }
    private var canSend: Bool { PhoneRule.isValid(phone) && !isSameAsCurrent && !busy }
    private var canSave: Bool { verificationId != nil && code.count == 6 && (remaining ?? 1) > 0 && !busy }

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            SheetGrabber().frame(maxWidth: .infinity)
            Text("휴대폰 번호 바꾸기").font(.pawfit(20, .bold)).accessibilityAddTraits(.isHeader)
            Text("새 번호로 인증하면 바로 바뀌어요. 다음 로그인부터 새 번호를 써 주세요.")
                .font(.pawfit(14.5)).lineSpacing(3).foregroundStyle(PawFitColor.iconGray)

            VStack(alignment: .leading, spacing: 6) {
                FieldLabel(text: "새 휴대폰 번호")
                HStack(spacing: 8) {
                    BoxField(placeholder: "010-0000-0000", text: Binding(
                        get: { phone },
                        set: { value in
                            let formatted = PhoneRule.format(value)
                            if formatted != phone { verificationId = nil; code = ""; error = nil }
                            phone = formatted
                        }), keyboard: .numberPad)
                    Button(verificationId == nil ? "인증번호 받기" : "다시 받기") { Task { await sendCode() } }
                        .font(.pawfit(15, .semibold)).foregroundStyle(PawFitColor.brand)
                        .padding(.horizontal, 16).frame(height: 52)
                        .background(Color.white, in: RoundedRectangle(cornerRadius: 14))
                        .overlay(RoundedRectangle(cornerRadius: 14).strokeBorder(PawFitColor.separator))
                        .disabled(!canSend)
                        .fixedSize()
                }
                if isSameAsCurrent && PhoneRule.isValid(phone) {
                    Text("지금 쓰는 번호예요").font(.pawfit(13)).foregroundStyle(PawFitColor.textSecondary).padding(.horizontal, 4)
                } else if verificationId != nil {
                    Label("인증번호를 문자로 보냈어요", systemImage: "checkmark")
                        .font(.pawfit(13.5)).foregroundStyle(PawFitColor.brand).padding(.horizontal, 4)
                }
            }

            if verificationId != nil {
                VStack(alignment: .leading, spacing: 6) {
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
                    BoxField(placeholder: "000000", text: Binding(
                        get: { code }, set: { code = String($0.filter(\.isNumber).prefix(6)) }),
                             keyboard: .numberPad, isInvalid: error != nil)
                        .textContentType(.oneTimeCode)
                    if env.usesMock {
                        Text("시연용 인증번호: 123456").font(.pawfit(13, .semibold)).foregroundStyle(PawFitColor.iconGray)
                            .padding(.horizontal, 4)
                    }
                }
            }

            if let error { Text(error).font(.pawfit(13)).foregroundStyle(PawFitColor.errorText) }
            Spacer(minLength: 0)
            HStack(spacing: 8) {
                Button("취소") { dismiss() }.buttonStyle(NeutralButtonStyle())
                Button { Task { await save() } } label: { if busy { ProgressView().tint(.white) } else { Text("번호 바꾸기") } }
                    .buttonStyle(PrimaryButtonStyle(fontSize: 16))
                    .disabled(!canSave)
            }
        }
        .padding(.horizontal, 20).padding(.bottom, 16)
        .presentationDetents([.height(verificationId == nil ? 360 : 500)])
        .onReceive(Timer.publish(every: 1, on: .main, in: .common).autoconnect()) { now = $0 }
    }

    private func sendCode() async {
        busy = true; defer { busy = false }
        error = nil
        do {
            let sent = try await store.api.sendPhoneCode(phone, purpose: .changePhone)
            verificationId = sent.verificationId
            expiresAt = Date.now.addingTimeInterval(TimeInterval(sent.expiresInSeconds))
            now = .now
            code = ""
        } catch {
            self.error = APIError.message(error)
        }
    }

    private func save() async {
        guard let verificationId else { return }
        busy = true; defer { busy = false }
        error = nil
        do {
            let token = try await store.api.confirmPhoneCode(id: verificationId, code: code)
            let updated = try await store.api.changePhone(verificationToken: token)
            onChanged(updated)
            dismiss()
        } catch {
            // 인증 토큰은 한 번 쓰면 끝이라, 실패하면 인증번호부터 다시 받게 한다
            if case .server(.duplicatePhoneNumber, _, _)? = error as? APIError {
                self.verificationId = nil
                code = ""
            } else if case .server(.invalidVerificationToken, _, _)? = error as? APIError {
                self.verificationId = nil
                code = ""
            }
            self.error = APIError.message(error)
        }
    }
}

// MARK: - 비밀번호 변경

/// 보호자 계정 관리 > 비밀번호
/// PATCH /users/me/password { currentPassword, newPassword } → 204.
/// 성공하면 서버가 이 계정의 리프레시 토큰을 모두 폐기하므로, 앱도 로그아웃하고 새 비밀번호로 다시 로그인하게 한다.
struct PasswordChangeSheet: View {
    @Environment(AppStore.self) private var store
    @Environment(AppSession.self) private var session
    @Environment(\.appEnvironment) private var env
    @Environment(\.dismiss) private var dismiss
    @State private var current = ""
    @State private var newPassword = ""
    @State private var confirm = ""
    @State private var busy = false
    @State private var error: String?
    @State private var done = false

    private var rule: (length: Bool, letter: Bool, symbol: Bool) { PasswordRule.check(newPassword) }
    private var mismatch: Bool { !confirm.isEmpty && confirm != newPassword }
    private var sameAsCurrent: Bool { !newPassword.isEmpty && newPassword == current }
    private var canSave: Bool {
        !current.isEmpty && PasswordRule.isValid(newPassword) && newPassword == confirm && !sameAsCurrent && !busy
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            SheetGrabber().frame(maxWidth: .infinity)
            if done { doneView } else { form }
        }
        .padding(.horizontal, 20).padding(.bottom, 16)
        .presentationDetents([.height(done ? 300 : 560)])
        .interactiveDismissDisabled(done)
    }

    private var form: some View {
        VStack(alignment: .leading, spacing: 14) {
            Text("비밀번호 바꾸기").font(.pawfit(20, .bold)).accessibilityAddTraits(.isHeader)

            VStack(alignment: .leading, spacing: 6) {
                FieldLabel(text: "지금 비밀번호")
                BoxField(placeholder: "지금 비밀번호", text: $current, isSecure: true,
                         isInvalid: error != nil && !busy)
            }
            VStack(alignment: .leading, spacing: 6) {
                FieldLabel(text: "새 비밀번호")
                BoxField(placeholder: "영문 + 특수기호 포함 8자 이상", text: $newPassword, isSecure: true)
                HStack(spacing: 6) {
                    ruleChip("8자 이상", rule.length)
                    ruleChip("영문", rule.letter)
                    ruleChip("특수기호", rule.symbol)
                }
                if sameAsCurrent {
                    Text("지금 비밀번호와 다른 비밀번호를 입력해 주세요").font(.pawfit(13)).foregroundStyle(PawFitColor.errorText)
                        .padding(.horizontal, 4)
                }
            }
            VStack(alignment: .leading, spacing: 6) {
                FieldLabel(text: "새 비밀번호 확인")
                BoxField(placeholder: "한 번 더 입력", text: $confirm, isSecure: true, isInvalid: mismatch)
                if mismatch {
                    Text("새 비밀번호가 서로 달라요").font(.pawfit(13)).foregroundStyle(PawFitColor.errorText).padding(.horizontal, 4)
                }
            }
            if let error { Text(error).font(.pawfit(13)).foregroundStyle(PawFitColor.errorText) }
            Spacer(minLength: 0)
            HStack(spacing: 8) {
                Button("취소") { dismiss() }.buttonStyle(NeutralButtonStyle())
                Button { Task { await save() } } label: { if busy { ProgressView().tint(.white) } else { Text("바꾸기") } }
                    .buttonStyle(PrimaryButtonStyle(fontSize: 16))
                    .disabled(!canSave)
            }
        }
    }

    private var doneView: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("비밀번호를 바꿨어요").font(.pawfit(20, .bold)).accessibilityAddTraits(.isHeader)
            Text("안전을 위해 모든 기기에서 로그아웃됐어요. 새 비밀번호로 다시 로그인해 주세요.")
                .font(.pawfit(14.5)).lineSpacing(3).foregroundStyle(PawFitColor.iconGray)
            Spacer(minLength: 0)
            Button("다시 로그인하기") { Task { await signOut() } }
                .buttonStyle(PrimaryButtonStyle())
        }
    }

    private func ruleChip(_ title: String, _ ok: Bool) -> some View {
        HStack(spacing: 4) {
            Image(systemName: ok ? "checkmark" : "minus").font(.system(size: 11, weight: .bold))
            Text(title).font(.pawfit(13, .semibold))
        }
        .foregroundStyle(ok ? PawFitColor.brand : PawFitColor.textSecondary)
        .padding(.leading, 8).padding(.trailing, 10).frame(height: 28)
        .background(ok ? PawFitColor.brandTint : PawFitColor.surfaceNeutral, in: Capsule())
        .accessibilityLabel("\(title) \(ok ? "충족" : "미충족")")
    }

    private func save() async {
        busy = true; defer { busy = false }
        error = nil
        do {
            try await store.api.changePassword(current: current, new: newPassword)
            current = ""; newPassword = ""; confirm = ""
            done = true
        } catch {
            // INVALID_PASSWORD(401)는 토큰 문제가 아니라 지금 비밀번호가 틀린 것 → 문구만 보여 준다
            self.error = APIError.message(error)
        }
    }

    private func signOut() async {
        // 서버에서 리프레시 토큰이 이미 폐기됐으므로 로그아웃 요청은 실패해도 된다(기기 토큰은 지운다)
        await env.auth.logout()
        store.clear()
        dismiss()
        session.signedOut()
    }
}
