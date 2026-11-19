import Foundation

// 예방접종 증빙 — BE vaccination/VaccinationService.java

/// 접종 항목 코드 (서버는 영문 대문자 자유 코드)
enum Vaccine: String, CaseIterable, Identifiable, Sendable {
    case dhppl = "DHPPL"
    case rabies = "RABIES"
    case corona = "CORONA"
    case kennelCough = "KENNEL_COUGH"

    var id: String { rawValue }
    var title: String {
        switch self {
        case .dhppl: "종합백신"
        case .rabies: "광견병"
        case .corona: "코로나장염"
        case .kennelCough: "켄넬코프"
        }
    }

    static func title(for code: String) -> String {
        Vaccine(rawValue: code)?.title ?? code
    }
}

/// 증빙 기록 상태
enum VaccinationRecordStatus: String, Decodable, Sendable {
    case notSubmitted = "NOT_SUBMITTED"
    case analyzing = "ANALYZING"
    case analyzed = "ANALYZED"                    // AI가 읽음 → 확인 완료(프로필 반영 가능)
    case needsManualReview = "NEEDS_MANUAL_REVIEW" // AI가 일부 못 읽음 → 추가 확인 필요
    case rejected = "REJECTED"                    // 다시 올려주세요
    case operatorReview = "OPERATOR_REVIEW"       // 보호자가 고쳐서 운영자 확인 중
    case verified = "VERIFIED"                    // 운영자 확인 끝
    case unknown

    init(from decoder: Decoder) throws {
        let raw = try decoder.singleValueContainer().decode(String.self)
        self = VaccinationRecordStatus(rawValue: raw) ?? .unknown
    }
}

struct VaccinationItem: Decodable, Identifiable, Hashable, Sendable {
    let itemId: Int64
    let vaccineCode: String
    let vaccinatedAt: String?   // "2026-09-10"
    let confidence: Double?
    var id: Int64 { itemId }
}

/// GET /dogs/{id}/vaccination-record · GET /vaccination-records/{id}
struct VaccinationRecord: Decodable, Sendable {
    let recordId: Int64?
    let status: VaccinationRecordStatus
    let items: [VaccinationItem]?

    var latestDate: String? { (items ?? []).compactMap(\.vaccinatedAt).max() }
    var itemTitles: String {
        var names: [String] = []
        for item in items ?? [] where !names.contains(Vaccine.title(for: item.vaccineCode)) {
            names.append(Vaccine.title(for: item.vaccineCode))
        }
        return names.isEmpty ? "접종 항목 없음" : names.joined(separator: " · ")
    }
}

/// POST /dogs/{id}/vaccination-documents 응답
struct VaccinationUpload: Decodable, Sendable {
    struct Document: Decodable, Sendable { let documentId: Int64 }
    let recordId: Int64
    let status: VaccinationRecordStatus
    let documents: [Document]?
}

struct VaccinationState: Decodable, Sendable {
    let recordId: Int64
    let status: VaccinationRecordStatus
}

/// PATCH /vaccination-records/{id}
struct VaccinationCorrection: Encodable, Sendable {
    struct Item: Encodable, Sendable { let vaccineCode: String; let vaccinatedAt: String }
    let items: [Item]
}

/// 결과 블록 · 프로필 칩 표현 (A9 참고 자료)
enum VaccinationBadge: Equatable {
    case none, analyzing, verified, needsMore, reupload, operatorReview

    init(record status: VaccinationRecordStatus) {
        switch status {
        case .analyzed, .verified: self = .verified
        case .needsManualReview: self = .needsMore
        case .rejected: self = .reupload
        case .operatorReview: self = .operatorReview
        case .analyzing: self = .analyzing
        case .notSubmitted, .unknown: self = .none
        }
    }

    init(dog status: DogVaccinationStatus?) {
        switch status {
        case .verified?, .pending?: self = .verified
        case .needsManualReview?: self = .needsMore
        case .rejected?: self = .reupload
        default: self = .none
        }
    }

    var chipTitle: String {
        switch self {
        case .none: "접종 증빙 없음"
        case .analyzing: "AI 확인 중"
        case .verified: "접종 확인 완료"
        case .needsMore: "접종 추가 확인 필요"
        case .reupload: "서류 다시 올리기"
        case .operatorReview: "운영자 확인 중"
        }
    }
}
