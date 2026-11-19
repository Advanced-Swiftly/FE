import Foundation
import Observation

/// UI-S-001 로그인 — F-AUTH-06
@MainActor
@Observable
final class LoginViewModel {
    enum Field: Hashable { case phone, password }

    /// 입력하는 동안 010-1234-5678 모양으로 맞춰 보여 준다
    var phone = "" {
        didSet {
            let formatted = PhoneRule.format(phone)
            if formatted != phone { phone = formatted; return }
            if phone != oldValue { errorMessage = nil }
        }
    }
    var password = "" { didSet { if password != oldValue { errorMessage = nil } } }

    private(set) var isLoading = false
    /// 비밀번호 칸 아래 고정 자리에 뜨는 문구. 어느 칸이 틀렸는지는 알리지 않는다.
    private(set) var errorMessage: String?

    private let auth: AuthService

    init(auth: AuthService) {
        self.auth = auth
    }

    var showsError: Bool { errorMessage != nil }

    /// 비어 있는 첫 칸. 버튼은 항상 눌리게 두고(캔버스와 같은 모습), 비어 있으면 그 칸으로 커서를 옮긴다.
    var firstEmptyField: Field? {
        if PhoneRule.digits(phone).isEmpty { return .phone }
        if password.isEmpty { return .password }
        return nil
    }

    /// 성공하면 보호자 이름, 실패하면 nil
    func login() async -> String? {
        guard !isLoading, firstEmptyField == nil else { return nil }
        isLoading = true
        defer { isLoading = false }

        do {
            let user = try await auth.login(phone: phone, password: password)
            return user.name
        } catch let error as APIError {
            errorMessage = Self.message(for: error)
            return nil
        } catch {
            errorMessage = APIError.network.userMessage
            return nil
        }
    }

    static func message(for error: APIError) -> String {
        switch error.code {
        case .invalidCredentials?, .validationError?:
            // 형식 오류도 같은 문구로 — 어느 쪽이 틀렸는지 알리지 않음
            APIErrorCode.invalidCredentials.defaultMessage
        default:
            error.userMessage
        }
    }
}
