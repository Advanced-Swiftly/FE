import Foundation

// MARK: - 댕댕로드(이벤트) · 방문 — BE event/api/dto/EventDtos.java

enum EventStatus: String, Decodable, Sendable {
    case draft = "DRAFT", open = "OPEN", closed = "CLOSED", drawn = "DRAWN", unknown
    init(from decoder: Decoder) throws {
        self = EventStatus(rawValue: try decoder.singleValueContainer().decode(String.self)) ?? .unknown
    }
}

struct CurrentEvent: Decodable, Sendable {
    let eventId: Int64
    let title: String
    let year: Int
    let quarter: Int
    let status: EventStatus
}

struct EventDetail: Decodable, Sendable {
    struct Prize: Decodable, Hashable, Sendable { let rank: Int; let name: String; let quantity: Int }
    let eventId: Int64
    let title: String
    let startsOn: String
    let endsOn: String
    let regions: [Int64]?
    let prizes: [Prize]?
    let notice: String?
}

struct StampStatus: Decodable, Sendable {
    struct Store: Decodable, Hashable, Sendable { let storeId: Int64; let awarded: Bool }
    let eventId: Int64
    let stampCount: Int
    let maxStampCount: Int
    let stores: [Store]?
}

struct EventStore: Decodable, Hashable, Sendable { let storeId: Int64; let name: String; let distanceMeters: Int? }
struct EventStoreList: Decodable, Sendable { let items: [EventStore] }

struct Visit: Decodable, Identifiable, Hashable, Sendable {
    let visitId: Int64
    let storeName: String
    let visitedAt: String
    var id: Int64 { visitId }
}
struct VisitList: Decodable, Sendable { let items: [Visit] }

struct QRVisitRequest: Encodable, Sendable { let qrToken: String; let dogIds: [Int64] }
struct QRVisitResult: Decodable, Sendable {
    let visitId: Int64
    let storeId: Int64
    let stampAwarded: Bool
    let stampCount: Int
}

enum DrawEntryStatus: String, Decodable, Sendable {
    case entered = "ENTERED", won = "WON", notSelected = "NOT_SELECTED", canceled = "CANCELED", unknown
    init(from decoder: Decoder) throws {
        self = DrawEntryStatus(rawValue: try decoder.singleValueContainer().decode(String.self)) ?? .unknown
    }
}

struct DrawEntryRequest: Encodable, Sendable {
    let phoneNumber: String     // 숫자만
    let address: String
    let privacyAgreed: Bool
}
struct DrawEntryCreated: Decodable, Sendable { let drawEntryId: Int64; let status: DrawEntryStatus; let stampCount: Int }
struct DrawEntry: Decodable, Sendable {
    struct Prize: Decodable, Sendable { let name: String }
    let drawEntryId: Int64
    let status: DrawEntryStatus
    let prize: Prize?
}

// MARK: - 챗봇 — BE chat/ChatController.java

struct ChatSessionCreated: Decodable, Sendable { let sessionId: Int64; let title: String? }
struct ChatSessionCreate: Encodable, Sendable { let title: String? }

struct ChatPlaceRef: Decodable, Hashable, Sendable {
    let placeId: String
    let verdict: Verdict?
}

struct ChatAssistantMessage: Decodable, Sendable {
    let messageId: Int64
    let content: String
    let places: [ChatPlaceRef]?
}

struct ChatSendRequest: Encodable, Sendable {
    let content: String
    let selectedDogIds: [Int64]?
    let latitude: Double?
    let longitude: Double?
}

struct ChatSent: Decodable, Sendable {
    let userMessageId: Int64
    let assistantMessage: ChatAssistantMessage
}

// MARK: - 내 정보 · 알림 — BE member/MemberController.java

struct ProfileUpdate: Encodable, Sendable {
    var name: String?
    var phoneVerificationToken: String?
}

struct ProfileUpdated: Decodable, Sendable { let userId: Int64; let name: String; let phoneNumber: String }

/// 알림 설정 (서버 키 4개)
struct NotificationSettings: Codable, Equatable, Sendable {
    var event: Bool?        // 댕댕로드 스탬프 · 추첨
    var inquiry: Bool?      // (업체용 문의 답변 — 앱 화면에는 없음)
    var reviewResult: Bool? // 예방접종 증빙 결과
    var marketing: Bool?    // 혜택 · 이벤트 소식
}

struct Withdrawal: Encodable, Sendable { let password: String; let reason: String? }

// MARK: - 회원가입 — BE auth/api/dto

struct Term: Decodable, Identifiable, Hashable, Sendable {
    let termId: Int64
    let title: String
    let required: Bool
    let version: String
    var id: Int64 { termId }
}
struct TermList: Decodable, Sendable { let terms: [Term] }

enum PhoneVerificationPurpose: String, Encodable, Sendable {
    case signUp = "SIGN_UP", login = "LOGIN", changePhone = "CHANGE_PHONE"
}

struct PhoneVerificationRequest: Encodable, Sendable {
    let phoneNumber: String
    let purpose: PhoneVerificationPurpose
}
struct PhoneVerificationSent: Decodable, Sendable { let verificationId: Int64; let expiresInSeconds: Int }
struct PhoneVerificationConfirm: Encodable, Sendable { let verificationId: Int64; let code: String }
struct PhoneVerificationConfirmed: Decodable, Sendable { let verified: Bool; let verificationToken: String? }

struct SignupRequest: Encodable, Sendable {
    struct Agreement: Encodable, Sendable { let termId: Int64; let agreed: Bool }
    let phoneVerificationToken: String
    let name: String
    let password: String
    let termAgreements: [Agreement]
}
struct SignupResponse: Decodable, Sendable {
    let userId: Int64
    let role: UserRole
    let accessToken: String
    let refreshToken: String
}
