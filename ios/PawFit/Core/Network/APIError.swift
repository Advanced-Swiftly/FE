import Foundation

/// 서버 오류 응답 — 백엔드 `ApiErrorResponse` (BE global/error)
/// { "timestamp", "status": 401, "code": "INVALID_CREDENTIALS", "message", "path", "requestId",
///   "fieldErrors": { "phoneNumber": "올바른 휴대전화 번호 형식이어야 합니다." } }
/// `code`로 화면 문구를 고른다. 서버 `message`는 대부분 "요청을 처리할 수 없습니다."라 화면에 쓰지 않는다.
struct APIErrorBody: Decodable, Sendable {
    let status: Int?
    let code: String
    let message: String?
    let requestId: String?
    let fieldErrors: [String: String]?
}

enum APIError: Error, Equatable, Sendable {
    /// 서버가 보낸 오류 코드. `field`는 fieldErrors의 첫 필드 이름
    case server(code: APIErrorCode, status: Int, field: String?)
    /// 인터넷 연결 없음 · 시간 초과
    case network
    /// 응답 형식이 서버와 다름(디코딩 실패)
    case decoding(String)
    /// 리프레시 토큰까지 만료 → 로그인 화면으로
    case sessionExpired
    /// 보호자(GUARDIAN)가 아닌 계정으로 앱에 로그인
    case notGuardian

    var code: APIErrorCode? {
        if case let .server(code, _, _) = self { return code }
        return nil
    }

    var userMessage: String {
        switch self {
        case let .server(code, _, _): code.defaultMessage
        case .network: "인터넷 연결을 확인해 주세요"
        case .notGuardian: "보호자 계정으로 로그인해 주세요"   // [확인 필요] 문구
        case .decoding, .sessionExpired: "잠시 후 다시 시도해 주세요"
        }
    }
}

/// 백엔드 ErrorCode의 `code` 값. 사용자 앱에서 쓰는 것만 이름을 붙이고 나머지는 `.unknown`.
enum APIErrorCode: Equatable, Sendable {
    // 공통
    case validationError        // COMMON_001 (400) — fieldErrors에 필드별 사유
    case notFound               // COMMON_002 (404)
    case conflict               // COMMON_003 (409)
    case unauthorized           // AUTH_001 (401) — 토큰 없음 · 만료 → 갱신 후 재시도
    case forbidden              // AUTH_002 (403)
    case rateLimited            // TOO_MANY_REQUESTS (429)
    case serverError            // COMMON_500 (500)
    // 인증 · 계정
    case invalidCredentials     // INVALID_CREDENTIALS (401) 로그인 실패
    case invalidRefreshToken    // INVALID_REFRESH_TOKEN (401)
    case invalidVerificationCode   // INVALID_VERIFICATION_CODE (400)
    case invalidVerificationToken  // INVALID_VERIFICATION_TOKEN (400)
    case requiredTermNotAgreed  // REQUIRED_TERM_NOT_AGREED (400)
    case duplicatePhoneNumber   // DUPLICATE_PHONE_NUMBER (409)
    case phoneDeliveryUnavailable  // PHONE_DELIVERY_UNAVAILABLE (503)
    case invalidPassword        // INVALID_PASSWORD (401) 탈퇴 · 비밀번호 확인
    case unknown(String)

    init(rawValue: String) {
        switch rawValue {
        case "COMMON_001": self = .validationError
        case "COMMON_002": self = .notFound
        case "COMMON_003": self = .conflict
        case "AUTH_001": self = .unauthorized
        case "AUTH_002": self = .forbidden
        case "TOO_MANY_REQUESTS": self = .rateLimited
        case "COMMON_500": self = .serverError
        case "INVALID_CREDENTIALS": self = .invalidCredentials
        case "INVALID_REFRESH_TOKEN": self = .invalidRefreshToken
        case "INVALID_VERIFICATION_CODE": self = .invalidVerificationCode
        case "INVALID_VERIFICATION_TOKEN": self = .invalidVerificationToken
        case "REQUIRED_TERM_NOT_AGREED": self = .requiredTermNotAgreed
        case "DUPLICATE_PHONE_NUMBER": self = .duplicatePhoneNumber
        case "PHONE_DELIVERY_UNAVAILABLE": self = .phoneDeliveryUnavailable
        case "INVALID_PASSWORD": self = .invalidPassword
        default: self = .unknown(rawValue)
        }
    }

    /// 화면 문구 (해요체). 서버 message는 쓰지 않는다.
    var defaultMessage: String {
        switch self {
        case .notFound: "정보를 찾을 수 없어요"
        case .invalidCredentials: "휴대폰 번호 또는 비밀번호가 맞지 않아요"
        case .duplicatePhoneNumber: "이미 가입한 휴대폰 번호예요"
        case .invalidVerificationCode: "인증번호가 맞지 않아요"
        case .invalidVerificationToken: "휴대폰 인증을 다시 해 주세요"
        case .requiredTermNotAgreed: "필수 약관에 동의해 주세요"
        case .invalidPassword: "비밀번호가 맞지 않아요"
        case .phoneDeliveryUnavailable: "인증번호를 보낼 수 없어요. 잠시 후 다시 시도해 주세요"
        case .rateLimited: "요청이 많아요. 잠시 후 다시 시도해 주세요"
        case .validationError, .conflict, .unauthorized, .forbidden, .invalidRefreshToken,
             .serverError, .unknown:
            "잠시 후 다시 시도해 주세요"
        }
    }
}
