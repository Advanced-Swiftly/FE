import Foundation
import CoreLocation

// 지도 · 업체 상세 · 판정 — BE place/PlaceService.java
// placeId는 "STORE:12" 또는 "PUBLIC:3" 형식의 문자열.

struct PlaceCard: Decodable, Identifiable, Hashable, Sendable {
    let placeId: String
    let name: String
    let latitude: Double
    let longitude: Double
    let verdict: Verdict

    var id: String { placeId }
    var coordinate: CLLocationCoordinate2D { .init(latitude: latitude, longitude: longitude) }
    var isPublicData: Bool { placeId.hasPrefix("PUBLIC:") }

    func distanceM(from c: CLLocationCoordinate2D) -> Int {
        Int(CLLocation(latitude: latitude, longitude: longitude)
            .distance(from: CLLocation(latitude: c.latitude, longitude: c.longitude)))
    }
}

struct PlaceMapResult: Decodable, Sendable { let places: [PlaceCard] }
struct PlaceSearchResult: Decodable, Sendable { let items: [PlaceCard]; let page: Int; let total: Int }

struct PlaceDetail: Decodable, Identifiable, Sendable {
    let placeId: String
    let name: String
    let address: String?
    let latitude: Double
    let longitude: Double
    let verdict: Verdict
    let reasons: [String]?
    /// 업체가 제한하지 않는 항목: WEIGHT · BREED · EQUIPMENT · VACCINE
    let unrestrictedFields: [String]?
    let policySource: String?
    let confirmedOn: String?        // "2026-09-25"
    let googleMapsUrl: String?

    var id: String { placeId }
    var coordinate: CLLocationCoordinate2D { .init(latitude: latitude, longitude: longitude) }
    var isPublicData: Bool { placeId.hasPrefix("PUBLIC:") }
}

/// POST /places/{id}/entry-judgments
struct EntryJudgment: Decodable, Sendable {
    struct DogResult: Decodable, Sendable, Hashable {
        let dogId: Int64
        let verdict: Verdict
        let reasons: [String]?
    }
    let overallVerdict: Verdict
    let dogs: [DogResult]
}

struct EntryJudgmentRequest: Encodable, Sendable { let dogIds: [Int64] }

/// 서버 판정 사유 코드 → 화면 표현
enum ReasonCode: Hashable, Sendable {
    case policyUnconfirmed           // POLICY_UNCONFIRMED
    case petsNotAllowed              // PETS_NOT_ALLOWED
    case weightUnknown               // WEIGHT_UNKNOWN (반려견 체중 미입력)
    case weightExceeded              // WEIGHT_LIMIT_EXCEEDED
    case breedRestricted             // BREED_RESTRICTED
    case equipmentRequired(String)   // STROLLER_REQUIRED
    case vaccineRequired(String)     // RABIES_VACCINATION_REQUIRED
    case other(String)

    init(_ raw: String) {
        switch raw {
        case "POLICY_UNCONFIRMED": self = .policyUnconfirmed
        case "PETS_NOT_ALLOWED": self = .petsNotAllowed
        case "WEIGHT_UNKNOWN": self = .weightUnknown
        case "WEIGHT_LIMIT_EXCEEDED": self = .weightExceeded
        case "BREED_RESTRICTED": self = .breedRestricted
        default:
            if raw.hasSuffix("_VACCINATION_REQUIRED") {
                self = .vaccineRequired(String(raw.dropLast("_VACCINATION_REQUIRED".count)))
            } else if raw.hasSuffix("_REQUIRED") {
                self = .equipmentRequired(String(raw.dropLast("_REQUIRED".count)))
            } else {
                self = .other(raw)
            }
        }
    }

    static func parse(_ raws: [String]?) -> [ReasonCode] { (raws ?? []).map(ReasonCode.init) }

    var missingEquipment: Equipment? {
        if case let .equipmentRequired(code) = self { return Equipment(rawValue: code) }
        return nil
    }

    var missingVaccine: String? {
        if case let .vaccineRequired(code) = self { return code }
        return nil
    }
}

/// 조건 표 한 줄의 반려견 쪽 결과
enum ConditionResult: Hashable, Sendable {
    case ok(String)        // 초록 글자
    case prepare(String)   // 테라코타 + !
    case denied(String)    // 진한 빨강 + ✕
    case unknown           // "확인 필요" + ?
}

struct ConditionRow: Identifiable, Hashable, Sendable {
    let label: String
    let placeRule: String
    var results: [ConditionResult]   // 반려견 수만큼 (함께 가요는 2개 이상)
    var id: String { label }
}

/// 상세 화면에 쓰는 반려견 기준 정보
struct DogBasisInfo: Hashable, Sendable {
    let dogId: Int64
    let name: String
    let weightKg: Double?
    let equipment: Set<Equipment>
    let vaccinationVerified: Bool
}

enum ConditionTable {
    /// 서버 상세 + 반려견별 판정으로 '맞춰 본 조건' 표를 만든다.
    /// 서버는 제한값(예: 최대 체중)을 주지 않아서 업체 기준은 '제한 있음/없음' 수준으로 보여 준다.
    static func rows(detail: PlaceDetail, dogs: [DogBasisInfo], judgments: [Int64: [ReasonCode]]) -> [ConditionRow] {
        let unrestricted = Set(detail.unrestrictedFields ?? [])
        let allReasons = dogs.flatMap { judgments[$0.dogId] ?? [] } + ReasonCode.parse(detail.reasons)
        let unknownPolicy = allReasons.contains(.policyUnconfirmed) && unrestricted.isEmpty
        let notAllowed = allReasons.contains(.petsNotAllowed)
        let count = max(dogs.count, 1)

        if unknownPolicy {
            return [
                ConditionRow(label: "동반 여부", placeRule: "알 수 없음", results: Array(repeating: .unknown, count: count)),
                ConditionRow(label: "체중", placeRule: "알 수 없음", results: Array(repeating: .unknown, count: count)),
                ConditionRow(label: "준비물", placeRule: "알 수 없음", results: Array(repeating: .unknown, count: count)),
                ConditionRow(label: "예방접종", placeRule: "알 수 없음", results: Array(repeating: .unknown, count: count)),
            ]
        }
        if notAllowed {
            return [ConditionRow(label: "동반 여부", placeRule: "반려견 동반 불가",
                                 results: Array(repeating: .denied("불가"), count: count))]
        }

        var rows: [ConditionRow] = [
            ConditionRow(label: "동반 여부", placeRule: "가능", results: Array(repeating: .ok("충족"), count: count))
        ]

        // 체중
        let weightRule = unrestricted.contains("WEIGHT") ? "제한 없음" : "체중 제한 있음"
        rows.append(ConditionRow(label: "체중", placeRule: weightRule, results: perDog(dogs, count) { dog in
            let r = judgments[dog?.dogId ?? -1] ?? []
            let w = dog?.weightKg.map(DogFormat.weight)
            if r.contains(.weightExceeded) { return .denied(w ?? "초과") }
            if r.contains(.weightUnknown) { return .unknown }
            return .ok(w ?? "충족")
        }))

        // 견종
        if !unrestricted.contains("BREED") {
            rows.append(ConditionRow(label: "견종", placeRule: "일부 견종 제한", results: perDog(dogs, count) { dog in
                (judgments[dog?.dogId ?? -1] ?? []).contains(.breedRestricted) ? .denied("제한 견종") : .ok("충족")
            }))
        }

        // 준비물: 부족한 것은 한 줄씩, 나머지는 한 줄로
        if unrestricted.contains("EQUIPMENT") {
            rows.append(ConditionRow(label: "준비물", placeRule: "필요 없음", results: Array(repeating: .ok("충족"), count: count)))
        } else {
            let missing = Set(allReasons.compactMap(\.missingEquipment))
            if missing.isEmpty {
                rows.append(ConditionRow(label: "준비물", placeRule: "필수 준비물 있음",
                                         results: Array(repeating: .ok("있음"), count: count)))
            }
            for item in Equipment.allCases where missing.contains(item) {
                rows.append(ConditionRow(label: item.title, placeRule: "필수", results: perDog(dogs, count) { dog in
                    let r = judgments[dog?.dogId ?? -1] ?? []
                    return r.contains(.equipmentRequired(item.rawValue)) ? .prepare("없음") : .ok("있음")
                }))
            }
        }

        // 예방접종
        if unrestricted.contains("VACCINE") {
            rows.append(ConditionRow(label: "예방접종", placeRule: "필요 없음", results: Array(repeating: .ok("충족"), count: count)))
        } else {
            let names = Set(allReasons.compactMap(\.missingVaccine)).map(Vaccine.title(for:)).sorted()
            let rule = names.isEmpty ? "완료 필요" : names.joined(separator: "·") + " 필요"
            rows.append(ConditionRow(label: "예방접종", placeRule: rule, results: perDog(dogs, count) { dog in
                let r = judgments[dog?.dogId ?? -1] ?? []
                return r.contains { $0.missingVaccine != nil } ? .prepare("확인 필요") : .ok("확인 완료")
            }))
        }
        return rows
    }

    private static func perDog(_ dogs: [DogBasisInfo], _ count: Int,
                               _ make: (DogBasisInfo?) -> ConditionResult) -> [ConditionResult] {
        dogs.isEmpty ? [make(nil)] : dogs.map { make($0) }
    }

    /// 길찾기 전 확인: 챙겨 갈 것 (물건 → 누구 것인지)
    static func thingsToBring(dogs: [DogBasisInfo], judgments: [Int64: [ReasonCode]]) -> [(Equipment, [String])] {
        Equipment.allCases.compactMap { item in
            let owners = dogs.filter { (judgments[$0.dogId] ?? []).contains(.equipmentRequired(item.rawValue)) }.map(\.name)
            return owners.isEmpty ? nil : (item, owners)
        }
    }
}

/// 판정 띠 문장
enum VerdictSentence {
    static func make(verdict: Verdict, dogs: [DogBasisInfo], judgments: [Int64: [ReasonCode]],
                     dogVerdicts: [Int64: Verdict]) -> (title: String, detail: String) {
        let names = dogs.map(\.name)
        guard !names.isEmpty else {
            switch verdict {
            case .noEntry: return ("반려견과 들어갈 수 없어요", "이 업체는 반려견 동반이 안 돼요")
            case .unknown: return ("동반 조건을 아직 몰라요", "가기 전에 업체에 물어보세요.")
            default: return ("반려견과 갈 수 있는 곳이에요", "반려견을 등록하면 조건을 맞춰 볼 수 있어요")
            }
        }
        let together = names.count > 1
        let subject = together ? Josa.and(names) : names[0]
        let missing = Equipment.allCases.filter { item in
            dogs.contains { (judgments[$0.dogId] ?? []).contains(.equipmentRequired(item.rawValue)) }
        }
        let reasons = Set(dogs.flatMap { judgments[$0.dogId] ?? [] })

        switch verdict {
        case .entryOK:
            return together
                ? ("\(subject) 함께 들어갈 수 있어요", "\(names.count == 2 ? "두" : "\(names.count)") 마리 모두 조건이 맞아요")
                : ("\(Josa.topic(subject)) 들어갈 수 있어요", "조건이 모두 맞고, 따로 챙길 것도 없어요")
        case .prepare:
            if !missing.isEmpty {
                let items = missing.map(\.title).joined(separator: "·")
                return ("\(Josa.object(items)) 챙기면 들어갈 수 있어요", "\(missing.first!.bringNote)")
            }
            return ("준비하면 들어갈 수 있어요", "예방접종 확인이 필요해요. 증빙을 올려 주세요")
        case .noEntry:
            var why: [String] = []
            if reasons.contains(.petsNotAllowed) { why.append("반려견 동반이 안 되는 곳이에요") }
            if reasons.contains(.weightExceeded) { why.append("체중 조건이 맞지 않아요") }
            if reasons.contains(.breedRestricted) { why.append("견종 조건이 맞지 않아요") }
            var detail = why.isEmpty ? "입장 조건이 맞지 않아요" : why.joined(separator: " ")
            if together, let ok = dogs.first(where: { dogVerdicts[$0.dogId] == .entryOK }) {
                detail += " \(ok.name) 혼자라면 들어갈 수 있어요."
            }
            return together ? ("\(Josa.topic(subject)) 함께 들어갈 수 없어요", detail)
                            : ("\(Josa.topic(subject)) 들어갈 수 없어요", detail)
        case .unknown:
            return ("\(Josa.subject(subject)) 들어갈 수 있는지 아직 몰라요",
                    "반려견 동반만 알려져 있고 세부 조건은 없어요. 가기 전에 업체에 물어보세요.")
        }
    }
}

/// 받침에 따라 조사를 고른다 (몽이는/콩이는, 유모차를/이동장을)
enum Josa {
    static func hasBatchim(_ word: String) -> Bool {
        guard let last = word.unicodeScalars.last?.value, (0xAC00...0xD7A3).contains(last) else { return false }
        return (last - 0xAC00) % 28 != 0
    }
    static func topic(_ w: String) -> String { w + (hasBatchim(w) ? "은" : "는") }
    static func subject(_ w: String) -> String { w + (hasBatchim(w) ? "이" : "가") }
    static func object(_ w: String) -> String { w + (hasBatchim(w) ? "을" : "를") }
    static func with(_ w: String) -> String { w + (hasBatchim(w) ? "과" : "와") }
    /// ["몽이", "콩이"] → "몽이와 콩이"
    static func and(_ names: [String]) -> String {
        guard names.count > 1 else { return names.first ?? "" }
        return names.dropLast().map { with($0) }.joined(separator: " ") + " " + names.last!
    }
}
