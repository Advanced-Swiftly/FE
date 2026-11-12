import Foundation

// 인증 · 내 정보 모델 — 백엔드 BE `auth/api/dto/AuthDtos.java`, `member/MemberController.java` 기준
// ID는 서버에서 Long(숫자)이라 Int64로 받는다.

enum UserRole: String, Codable, Sendable {
    case guardian = "GUARDIAN"   // 보호자 — 사용자 앱은 이 역할만 쓴다
    case business = "BUSINESS"   // 업체관리자
    case `operator` = "OPERATOR" // 운영자
}

/// POST /auth/login
struct LoginRequest: Encodable, Sendable {
    /// "01012345678" 또는 "010-1234-5678" 둘 다 서버가 받는다. 앱은 숫자만 보낸다.
    let phoneNumber: String
    let password: String
    /// 알림(APNs) 기기 토큰. 알림 작업 전까지는 nil (보내지 않음)
    let deviceToken: String?
}

/// POST /auth/token/refresh
struct RefreshRequest: Encodable, Sendable {
    let refreshToken: String
}

/// POST /auth/logout — 이 기기의 리프레시 토큰 · 알림 토큰 연결을 끊는다
struct LogoutRequest: Encodable, Sendable {
    let refreshToken: String
    let deviceToken: String?
}

struct LogoutResponse: Decodable, Sendable {
    let success: Bool
}

/// 로그인 응답의 사용자 요약
struct UserSummary: Decodable, Equatable, Sendable {
    let userId: Int64
    let role: UserRole
    let name: String
}

/// POST /auth/login 응답
struct LoginResponse: Decodable, Sendable {
    let user: UserSummary
    let accessToken: String
    let refreshToken: String

    var tokens: AuthTokens { AuthTokens(accessToken: accessToken, refreshToken: refreshToken) }
}

/// GET /users/me
struct Me: Decodable, Equatable, Sendable {
    let userId: Int64
    let role: UserRole
    let name: String
    /// 서버가 저장한 형식 그대로 (예: "010-1234-5678")
    let phoneNumber: String
}

enum AuthEndpoints {
    static func login(phone: String, password: String, deviceToken: String? = nil) -> Endpoint<LoginResponse> {
        Endpoint(
            method: .post,
            path: APIPath.login,
            body: LoginRequest(phoneNumber: PhoneRule.digits(phone), password: password, deviceToken: deviceToken),
            requiresAuth: false
        )
    }

    static func refresh(refreshToken: String) -> Endpoint<AuthTokens> {
        Endpoint(method: .post, path: APIPath.tokenRefresh, body: RefreshRequest(refreshToken: refreshToken), requiresAuth: false)
    }

    static func logout(refreshToken: String, deviceToken: String? = nil) -> Endpoint<LogoutResponse> {
        Endpoint(method: .post, path: APIPath.logout, body: LogoutRequest(refreshToken: refreshToken, deviceToken: deviceToken))
    }

    /// 시작 화면에서 저장된 토큰이 살아 있는지 확인할 때도 쓴다
    static let me = Endpoint<Me>(method: .get, path: APIPath.me)
}

/// 휴대폰 번호 규칙 — 서버 정규식 `^(?:\+82[- ]?|0)10[- ]?\d{4}[- ]?\d{4}$` (010만 허용)
enum PhoneRule {
    /// 서버로 보낼 때: 숫자만 "01012345678"
    static func digits(_ phone: String) -> String {
        phone.filter(\.isNumber)
    }

    /// 입력 중 보기 좋게: "010-1234-5678" (최대 11자리)
    static func format(_ phone: String) -> String {
        let d = String(digits(phone).prefix(11))
        switch d.count {
        case 0...3: return d
        case 4...7: return "\(d.prefix(3))-\(d.dropFirst(3))"
        default: return "\(d.prefix(3))-\(d.dropFirst(3).prefix(4))-\(d.dropFirst(7))"
        }
    }

    /// 서버가 받는 모양인지: 010으로 시작하는 11자리
    static func isValid(_ phone: String) -> Bool {
        let d = digits(phone)
        return d.hasPrefix("010") && d.count == 11
    }
}

enum PasswordRule {
    /// 앱 기준: 8자 이상, 영문 1자 이상, 특수기호 1자 이상 (숫자는 선택) — 10-28 확정
    /// 서버는 지금 8~72자만 검사한다 → 백엔드에 같은 규칙 요청
    static let maxLength = 72

    static func check(_ password: String) -> (length: Bool, letter: Bool, symbol: Bool) {
        (
            length: (8...maxLength).contains(password.count),
            letter: password.contains { $0.isASCII && $0.isLetter },
            symbol: password.contains { $0.isASCII && ($0.isPunctuation || $0.isSymbol) }
        )
    }

    static func isValid(_ password: String) -> Bool {
        let c = check(password)
        return c.length && c.letter && c.symbol
    }
}
