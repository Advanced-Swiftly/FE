import Foundation

/// 사용자 앱이 쓰는 API 경로 — 백엔드 저장소(Advanced-Swiftly/BE, develop) 컨트롤러 기준 (2026-11-12 확인)
/// 모두 `/api/v1` 뒤의 경로다(baseURL에 `/api/v1`이 들어 있음).
/// 서버 Swagger: {서버}/swagger-ui.html
enum APIPath {
    // MARK: 공통 · 인증 (AuthController, CommonController)
    static let terms = "/terms"
    static let regions = "/regions"
    static let breeds = "/breeds"
    static let phoneVerifications = "/auth/phone-verifications"            // { phoneNumber, purpose: SIGN_UP|LOGIN|CHANGE_PHONE }
    static let phoneVerificationsConfirm = "/auth/phone-verifications/confirm" // { verificationId, code } → verificationToken
    static let signupGuardian = "/auth/signup/guardian"                    // { phoneVerificationToken, name, password, termAgreements }
    static let login = "/auth/login"
    static let tokenRefresh = "/auth/token/refresh"
    static let logout = "/auth/logout"

    // MARK: 내 정보 (MemberController)
    static let me = "/users/me"                                            // GET 조회 · PATCH 이름/번호 변경 · DELETE 탈퇴
    static let meNotificationSettings = "/users/me/notification-settings"  // GET · PATCH

    // MARK: 반려견 (DogController)
    static let dogs = "/dogs"
    static func dog(_ id: Int64) -> String { "/dogs/\(id)" }
    static func dogDefault(_ id: Int64) -> String { "/dogs/\(id)/default" }

    // MARK: 지도 · 업체 (PlaceController)
    static let places = "/places"                                          // 검색 목록
    static let placesMap = "/places/map"                                   // 지도 범위 안 업체 + 판정
    static func place(_ id: String) -> String { "/places/\(id)" }          // 업체 상세
    static func entryJudgments(_ id: String) -> String { "/places/\(id)/entry-judgments" } // { dogIds } → 판정

    // MARK: 예방접종 (VaccinationController)
    static func vaccinationDocuments(dogId: Int64) -> String { "/dogs/\(dogId)/vaccination-documents" } // multipart
    static func vaccinationRecordOfDog(_ dogId: Int64) -> String { "/dogs/\(dogId)/vaccination-record" }
    static func vaccinationRecord(_ id: Int64) -> String { "/vaccination-records/\(id)" }
    static func vaccinationResubmit(_ id: Int64) -> String { "/vaccination-records/\(id)/resubmit" }

    // MARK: 챗봇 (ChatController)
    static let chatSessions = "/chat/sessions"
    static func chatSession(_ id: Int64) -> String { "/chat/sessions/\(id)" }
    static func chatMessages(_ sessionId: Int64) -> String { "/chat/sessions/\(sessionId)/messages" }

    // MARK: 댕댕로드 = 이벤트 · 방문 (EventController)
    static let currentEvent = "/events/current"
    static func event(_ id: Int64) -> String { "/events/\(id)" }
    static func eventStores(_ id: Int64) -> String { "/events/\(id)/stores" }
    static func eventStamps(_ id: Int64) -> String { "/events/\(id)/stamps" }
    static func drawEntries(_ eventId: Int64) -> String { "/events/\(eventId)/draw-entries" }
    static func drawEntry(_ eventId: Int64) -> String { "/events/\(eventId)/draw-entry" }
    static let visits = "/visits"
    static let visitQR = "/visits/qr"
}
