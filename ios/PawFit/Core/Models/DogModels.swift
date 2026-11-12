import Foundation

// 반려견 — BE dog/api/dto/DogDtos.java
// 서버는 null 필드를 빼고 보내므로 값이 없을 수 있는 것은 모두 Optional.

/// 서버 반려견 접종 상태 (dog.vaccination_status)
enum DogVaccinationStatus: String, Codable, Sendable {
    case notSubmitted = "NOT_SUBMITTED"
    case pending = "PENDING"                    // AI 확인 끝, 운영자 확인 전
    case verified = "VERIFIED"
    case rejected = "REJECTED"
    case needsManualReview = "NEEDS_MANUAL_REVIEW"
    case unknown

    init(from decoder: Decoder) throws {
        let raw = try decoder.singleValueContainer().decode(String.self)
        self = DogVaccinationStatus(rawValue: raw) ?? .unknown
    }
}

/// 입장 준비물. 서버는 자유 코드(영문 대문자)라 앱에서 4가지로 정한다.
enum Equipment: String, CaseIterable, Codable, Sendable, Identifiable {
    case stroller = "STROLLER"
    case carrier = "CARRIER"
    case muzzle = "MUZZLE"
    case mannerBelt = "MANNER_BELT"

    var id: String { rawValue }

    /// 칩 · 조건 표 이름
    var title: String {
        switch self {
        case .stroller: "유모차"
        case .carrier: "이동장"
        case .muzzle: "입마개"
        case .mannerBelt: "매너벨트·기저귀"
        }
    }

    /// A5 토글 문구
    var toggleTitle: String {
        switch self {
        case .stroller: "유모차 있어요"
        case .carrier: "이동장 있어요"
        case .muzzle: "입마개 준비할 수 있어요"
        case .mannerBelt: "매너벨트·기저귀 있어요"
        }
    }

    var symbol: String {
        switch self {
        case .stroller: "cart"
        case .carrier: "bag"
        case .muzzle: "shield"
        case .mannerBelt: "seal"
        }
    }

    /// 길찾기 전 확인 팝업 설명
    var bringNote: String {
        switch self {
        case .stroller: "실내에서는 태워야 해요"
        case .carrier: "매장 안에서는 이동장에 넣어 주세요"
        case .muzzle: "매장 안에서 꼭 씌워 주세요"
        case .mannerBelt: "매장 안에서 꼭 채워 주세요"
        }
    }
}

struct DogSummary: Decodable, Identifiable, Equatable, Hashable, Sendable {
    let dogId: Int64
    let name: String
    let breedName: String?
    let isDefault: Bool
    var id: Int64 { dogId }
}

struct DogList: Decodable, Sendable {
    let dogs: [DogSummary]
}

struct DogDetail: Decodable, Identifiable, Equatable, Hashable, Sendable {
    let dogId: Int64
    let name: String
    let breedId: Int64?
    let breedName: String?
    let birthDate: String?          // "2022-05-01"
    let weightKg: Double?
    let equipmentCodes: [String]?
    let isDefault: Bool
    let vaccinationStatus: DogVaccinationStatus?

    var id: Int64 { dogId }
    var equipment: Set<Equipment> { Set((equipmentCodes ?? []).compactMap(Equipment.init(rawValue:))) }

    /// "말티즈 · 4살 · 5.0kg"
    var subtitle: String {
        var parts: [String] = []
        if let breedName { parts.append(breedName) }
        if let age = DogAge.years(fromBirthDate: birthDate) { parts.append("\(age)살") }
        if let weightKg { parts.append(DogFormat.weight(weightKg)) }
        if let size = DogSize(weightKg: weightKg) { parts.append(size.title) }
        return parts.joined(separator: " · ")
    }
}

struct DogCreateRequest: Encodable, Sendable {
    let name: String
    let breedId: Int64
    let birthDate: String?
    let weightKg: Double?
    let equipmentCodes: [String]
    let isDefault: Bool?
}

struct DogCreated: Decodable, Sendable {
    let dogId: Int64
    let name: String
    let isDefault: Bool
}

/// PATCH — 바꾼 필드만 보낸다(nil은 JSON에서 빠짐)
struct DogUpdateRequest: Encodable, Sendable {
    var name: String?
    var breedId: Int64?
    var weightKg: Double?
    var equipmentCodes: [String]?
}

struct Breed: Decodable, Identifiable, Hashable, Sendable {
    let breedId: Int64
    let name: String
    var id: Int64 { breedId }
}

struct BreedList: Decodable, Sendable { let breeds: [Breed] }

/// 크기는 서버에 없어서 체중으로 정한다 (소형 10kg 미만 · 중형 25kg 미만 · 대형)
enum DogSize: String, CaseIterable, Identifiable {
    case small, medium, large
    var id: String { rawValue }

    init?(weightKg: Double?) {
        guard let w = weightKg else { return nil }
        self = w < 10 ? .small : (w < 25 ? .medium : .large)
    }

    var title: String {
        switch self {
        case .small: "소형견"
        case .medium: "중형견"
        case .large: "대형견"
        }
    }
}

enum DogAge {
    static func years(fromBirthDate date: String?) -> Int? {
        guard let date, let d = DateText.day(date) else { return nil }
        return Calendar.current.dateComponents([.year], from: d, to: .now).year
    }

    /// 나이(살) → 오늘 기준 생일 "yyyy-MM-dd"
    static func birthDate(forAge years: Int) -> String {
        let d = Calendar.current.date(byAdding: .year, value: -years, to: .now) ?? .now
        return DateText.dayString(d)
    }
}

enum DogFormat {
    static func weight(_ kg: Double) -> String {
        kg == kg.rounded() ? "\(Int(kg))kg" : String(format: "%.1fkg", kg)
    }
}
