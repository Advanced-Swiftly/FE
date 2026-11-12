import Foundation

/// 서버 없이 화면을 만들고 시연할 때 쓰는 가짜 백엔드.
/// 캔버스 'PawFit 출입증'의 예시 데이터(성수동 · 몽이 · 콩이 · AA카페 …)를 그대로 쓰고,
/// 판정은 서버(PlaceService.evaluateDog)와 같은 규칙으로 계산한다.
actor MockPawFitAPI: PawFitAPI {
    var latency: Duration

    init(latency: Duration = .milliseconds(350)) { self.latency = latency }

    // MARK: - 데이터

    struct Policy {
        var allowed = true
        var maxWeight: Double? = nil
        var equipment: [Equipment] = []
        var vaccines: [String] = []
        var deniedBreeds: [Int64] = []
        var source: String? = nil
        var confirmedOn: String? = nil
    }

    struct Place {
        let id: String, name: String, category: String, address: String
        let lat: Double, lng: Double
        let policy: Policy?
    }

    private var dogsById: [Int64: DogDetail] = [
        1: DogDetail(dogId: 1, name: "몽이", breedId: 3, breedName: "말티즈", birthDate: DogAge.birthDate(forAge: 4),
                     weightKg: 5, equipmentCodes: ["STROLLER", "CARRIER", "MANNER_BELT"], isDefault: true,
                     vaccinationStatus: .verified),
        2: DogDetail(dogId: 2, name: "콩이", breedId: 9, breedName: "푸들", birthDate: DogAge.birthDate(forAge: 3),
                     weightKg: 10, equipmentCodes: ["MANNER_BELT"], isDefault: false, vaccinationStatus: .verified),
    ]
    private var nextDogId: Int64 = 3
    private var vaccinationsByDog: [Int64: VaccinationRecord] = [
        1: VaccinationRecord(recordId: 11, status: .verified,
                             items: [VaccinationItem(itemId: 1, vaccineCode: "DHPPL", vaccinatedAt: "2026-09-10", confidence: 0.97)]),
        2: VaccinationRecord(recordId: 12, status: .verified,
                             items: [VaccinationItem(itemId: 2, vaccineCode: "DHPPL", vaccinatedAt: "2026-08-21", confidence: 0.95)]),
    ]
    private var analyzingSince: [Int64: Date] = [:]
    private var name = "이채린"
    private var settings = NotificationSettings(event: true, inquiry: true, reviewResult: true, marketing: true)
    private var stampStores: [Int64] = [101, 102, 103]
    private var visitList: [Visit] = [
        Visit(visitId: 3, storeName: "FF카페", visitedAt: "2026-10-12T05:20:00Z"),
        Visit(visitId: 2, storeName: "BB식당", visitedAt: "2026-10-08T03:10:00Z"),
        Visit(visitId: 1, storeName: "AA카페", visitedAt: "2026-10-03T07:40:00Z"),
    ]
    private var entered: DrawEntry?

    static let center = (lat: 37.5446, lng: 127.0557)   // 성수동

    let places: [Place] = [
        Place(id: "STORE:1", name: "AA카페", category: "카페", address: "서울 성동구 성수이로 88", lat: 37.5452, lng: 127.0571,
              policy: Policy(maxWeight: 5, source: "업체 공식 인스타그램", confirmedOn: "2026-10-08")),
        Place(id: "STORE:2", name: "BB베이커리", category: "베이커리", address: "서울 성동구 연무장길 21", lat: 37.5461, lng: 127.0548,
              policy: Policy(maxWeight: 10, vaccines: ["DHPPL"], source: "업체 공식 인스타그램", confirmedOn: "2026-09-25")),
        Place(id: "STORE:3", name: "CC레스토랑", category: "식당", address: "서울 성동구 아차산로 17", lat: 37.5428, lng: 127.0560,
              policy: Policy(maxWeight: 5, vaccines: ["DHPPL"], source: "업체 공식 홈페이지", confirmedOn: "2026-09-20")),
        Place(id: "PUBLIC:4", name: "DD브런치", category: "브런치", address: "서울 성동구 서울숲2길 32", lat: 37.5439, lng: 127.0590,
              policy: nil),
        Place(id: "STORE:5", name: "FF카페 성수점", category: "카페", address: "서울 성동구 성수이로7길 15", lat: 37.5467, lng: 127.0583,
              policy: Policy(maxWeight: 10, equipment: [.stroller, .mannerBelt], source: "업체 공식 SNS · 업체 직접 확인", confirmedOn: "2026-10-01")),
        Place(id: "STORE:6", name: "HH가든", category: "식당", address: "서울 성동구 왕십리로 115", lat: 37.5449, lng: 127.0528,
              policy: Policy(maxWeight: 15, vaccines: ["DHPPL"], source: "업체 직접 확인", confirmedOn: "2026-10-05")),
        Place(id: "STORE:7", name: "II식당", category: "식당", address: "서울 성동구 성수일로 56", lat: 37.5420, lng: 127.0577,
              policy: Policy(source: "업체 공식 인스타그램", confirmedOn: "2026-09-30")),
        Place(id: "PUBLIC:8", name: "MM브런치", category: "브런치", address: "서울 성동구 뚝섬로 377", lat: 37.5418, lng: 127.0546,
              policy: nil),
    ]

    private func pause() async { try? await Task.sleep(for: latency) }

    // MARK: - 판정 (서버와 같은 규칙)

    private func evaluate(_ p: Policy?, dog: DogDetail) -> EntryJudgment.DogResult {
        guard let p else { return .init(dogId: dog.dogId, verdict: .unknown, reasons: ["POLICY_UNCONFIRMED"]) }
        guard p.allowed else { return .init(dogId: dog.dogId, verdict: .noEntry, reasons: ["PETS_NOT_ALLOWED"]) }
        var v: Verdict = .entryOK
        var reasons: [String] = []
        if let max = p.maxWeight {
            if let w = dog.weightKg {
                if w > max { v = .noEntry; reasons.append("WEIGHT_LIMIT_EXCEEDED") }
            } else { v = .unknown; reasons.append("WEIGHT_UNKNOWN") }
        }
        if let breed = dog.breedId, p.deniedBreeds.contains(breed) { v = .noEntry; reasons.append("BREED_RESTRICTED") }
        for e in p.equipment where !dog.equipment.contains(e) {
            v = Verdict.worst(of: [v, .prepare]); reasons.append("\(e.rawValue)_REQUIRED")
        }
        let verified = vaccinationsByDog[dog.dogId]?.status == .verified
        let has = Set((vaccinationsByDog[dog.dogId]?.items ?? []).map(\.vaccineCode))
        for code in p.vaccines where !(verified && has.contains(code)) {
            v = Verdict.worst(of: [v, .prepare]); reasons.append("\(code)_VACCINATION_REQUIRED")
        }
        return .init(dogId: dog.dogId, verdict: v, reasons: reasons)
    }

    private func judgment(_ p: Policy?, _ ids: [Int64]) -> EntryJudgment {
        let results = ids.compactMap { dogsById[$0] }.map { evaluate(p, dog: $0) }
        let fallback: Verdict = p == nil ? .unknown : (p!.allowed ? .unknown : .noEntry)
        return EntryJudgment(overallVerdict: results.isEmpty ? fallback : Verdict.worst(of: results.map(\.verdict)), dogs: results)
    }

    private func card(_ p: Place, _ ids: [Int64]) -> PlaceCard {
        PlaceCard(placeId: p.id, name: p.name, latitude: p.lat, longitude: p.lng, verdict: judgment(p.policy, ids).overallVerdict)
    }

    // MARK: - 내 정보

    func me() async throws -> Me {
        await pause(); return Me(userId: 1, role: .guardian, name: name, phoneNumber: "01012345678")
    }
    func updateName(_ name: String) async throws -> ProfileUpdated {
        await pause(); self.name = name; return ProfileUpdated(userId: 1, name: name, phoneNumber: "01012345678")
    }
    func notificationSettings() async throws -> NotificationSettings { await pause(); return settings }
    func updateNotificationSettings(_ s: NotificationSettings) async throws -> NotificationSettings {
        await pause()
        if let v = s.event { settings.event = v }
        if let v = s.reviewResult { settings.reviewResult = v }
        if let v = s.marketing { settings.marketing = v }
        if let v = s.inquiry { settings.inquiry = v }
        return settings
    }
    func withdraw(password: String) async throws {
        await pause()
        guard password == MockAuthService.demoPassword else {
            throw APIError.server(code: .invalidPassword, status: 401, field: nil)
        }
    }

    // MARK: - 반려견

    func dogs() async throws -> [DogSummary] {
        await pause()
        return dogsById.values.sorted { ($0.isDefault ? 0 : 1, $0.dogId) < ($1.isDefault ? 0 : 1, $1.dogId) }
            .map { DogSummary(dogId: $0.dogId, name: $0.name, breedName: $0.breedName, isDefault: $0.isDefault) }
    }
    func dog(_ id: Int64) async throws -> DogDetail {
        await pause()
        guard var d = dogsById[id] else { throw APIError.server(code: .notFound, status: 404, field: nil) }
        d = DogDetail(dogId: d.dogId, name: d.name, breedId: d.breedId, breedName: d.breedName, birthDate: d.birthDate,
                      weightKg: d.weightKg, equipmentCodes: d.equipmentCodes, isDefault: d.isDefault,
                      vaccinationStatus: dogVaxStatus(id))
        return d
    }
    private func dogVaxStatus(_ id: Int64) -> DogVaccinationStatus {
        switch vaccinationsByDog[id]?.status {
        case .verified?: .verified
        case .analyzed?, .operatorReview?: .pending
        case .needsManualReview?: .needsManualReview
        case .rejected?: .rejected
        default: .notSubmitted
        }
    }
    func createDog(_ r: DogCreateRequest) async throws -> DogCreated {
        await pause()
        guard dogsById.count < 5 else { throw APIError.server(code: .unknown("DOG_LIMIT_EXCEEDED"), status: 400, field: nil) }
        let id = nextDogId; nextDogId += 1
        let makeDefault = dogsById.isEmpty || r.isDefault == true
        if makeDefault { clearDefault() }
        let breed = Self.breedList.first { $0.breedId == r.breedId }?.name
        dogsById[id] = DogDetail(dogId: id, name: r.name, breedId: r.breedId, breedName: breed, birthDate: r.birthDate,
                                 weightKg: r.weightKg, equipmentCodes: r.equipmentCodes, isDefault: makeDefault,
                                 vaccinationStatus: .notSubmitted)
        return DogCreated(dogId: id, name: r.name, isDefault: makeDefault)
    }
    func updateDog(_ id: Int64, _ r: DogUpdateRequest) async throws {
        await pause()
        guard let d = dogsById[id] else { throw APIError.server(code: .notFound, status: 404, field: nil) }
        let breedName = r.breedId.flatMap { b in Self.breedList.first { $0.breedId == b }?.name } ?? d.breedName
        dogsById[id] = DogDetail(dogId: id, name: r.name ?? d.name, breedId: r.breedId ?? d.breedId, breedName: breedName,
                                 birthDate: d.birthDate, weightKg: r.weightKg ?? d.weightKg,
                                 equipmentCodes: r.equipmentCodes ?? d.equipmentCodes, isDefault: d.isDefault,
                                 vaccinationStatus: d.vaccinationStatus)
    }
    private func clearDefault() {
        for (k, d) in dogsById where d.isDefault {
            dogsById[k] = DogDetail(dogId: d.dogId, name: d.name, breedId: d.breedId, breedName: d.breedName,
                                    birthDate: d.birthDate, weightKg: d.weightKg, equipmentCodes: d.equipmentCodes,
                                    isDefault: false, vaccinationStatus: d.vaccinationStatus)
        }
    }
    func setDefaultDog(_ id: Int64) async throws {
        await pause()
        guard let d = dogsById[id] else { throw APIError.server(code: .notFound, status: 404, field: nil) }
        clearDefault()
        dogsById[id] = DogDetail(dogId: d.dogId, name: d.name, breedId: d.breedId, breedName: d.breedName,
                                 birthDate: d.birthDate, weightKg: d.weightKg, equipmentCodes: d.equipmentCodes,
                                 isDefault: true, vaccinationStatus: d.vaccinationStatus)
    }
    func deleteDog(_ id: Int64) async throws {
        await pause()
        let wasDefault = dogsById[id]?.isDefault == true
        dogsById[id] = nil
        vaccinationsByDog[id] = nil
        if wasDefault, let next = dogsById.keys.sorted().first { try await setDefaultDog(next) }
    }
    static let breedList: [Breed] = ["골든 리트리버", "닥스훈트", "말티즈", "믹스견", "보더 콜리", "비숑 프리제",
                                     "시바견", "웰시코기", "푸들", "포메라니안", "진돗개", "치와와"]
        .enumerated().map { Breed(breedId: Int64($0.offset + 1), name: $0.element) }
    func breeds() async throws -> [Breed] { await pause(); return Self.breedList }

    // MARK: - 지도 · 업체

    func mapPlaces(latitude: Double, longitude: Double, radiusM: Int, category: String?, dogIds: [Int64]) async throws -> [PlaceCard] {
        await pause()
        return places.filter { category == nil || $0.category == category }.map { card($0, dogIds) }
    }
    func searchPlaces(keyword: String, dogIds: [Int64]) async throws -> [PlaceCard] {
        await pause()
        let k = keyword.trimmingCharacters(in: .whitespaces).lowercased()
        return places.filter { k.isEmpty || $0.name.lowercased().contains(k) || $0.category.contains(k) }.map { card($0, dogIds) }
    }
    func placeDetail(_ id: String, dogIds: [Int64]) async throws -> PlaceDetail {
        await pause()
        guard let p = places.first(where: { $0.id == id }) else {
            throw APIError.server(code: .unknown("PLACE_NOT_FOUND"), status: 404, field: nil)
        }
        let j = judgment(p.policy, dogIds)
        var unrestricted: [String] = []
        if let pol = p.policy, pol.allowed {
            if pol.maxWeight == nil { unrestricted.append("WEIGHT") }
            if pol.deniedBreeds.isEmpty { unrestricted.append("BREED") }
            if pol.equipment.isEmpty { unrestricted.append("EQUIPMENT") }
            if pol.vaccines.isEmpty { unrestricted.append("VACCINE") }
        }
        let reasons = Array(Set(j.dogs.flatMap { $0.reasons ?? [] })).sorted()
        return PlaceDetail(placeId: p.id, name: p.name, address: p.address, latitude: p.lat, longitude: p.lng,
                           verdict: j.overallVerdict, reasons: reasons, unrestrictedFields: unrestricted,
                           policySource: p.policy?.source ?? (p.id.hasPrefix("PUBLIC") ? "공공데이터 · 반려동물 동반 가능 문화시설" : nil),
                           confirmedOn: p.policy?.confirmedOn,
                           googleMapsUrl: "https://www.google.com/maps/search/?api=1&query=\(p.lat)%2C\(p.lng)")
    }
    func judge(_ id: String, dogIds: [Int64]) async throws -> EntryJudgment {
        await pause()
        return judgment(places.first { $0.id == id }?.policy, dogIds)
    }
    /// 목업 전용: 업체 업종 (서버 상세 응답에는 없음)
    nonisolated static func category(of placeId: String) -> String? {
        ["STORE:1": "카페", "STORE:2": "베이커리", "STORE:3": "식당", "PUBLIC:4": "브런치", "STORE:5": "카페",
         "STORE:6": "식당", "STORE:7": "식당", "PUBLIC:8": "브런치"][placeId]
    }

    // MARK: - 예방접종

    func vaccinationRecord(dogId: Int64) async throws -> VaccinationRecord {
        await pause()
        return finishAnalysisIfReady(dogId: dogId) ?? VaccinationRecord(recordId: nil, status: .notSubmitted, items: [])
    }
    private func finishAnalysisIfReady(dogId: Int64) -> VaccinationRecord? {
        guard var r = vaccinationsByDog[dogId] else { return nil }
        if r.status == .analyzing, let since = analyzingSince[dogId], Date().timeIntervalSince(since) > 2.5 {
            r = VaccinationRecord(recordId: r.recordId, status: .analyzed,
                                  items: [VaccinationItem(itemId: 100 + dogId, vaccineCode: "DHPPL", vaccinatedAt: "2026-09-10", confidence: 0.93)])
            vaccinationsByDog[dogId] = r
        }
        return r
    }
    func vaccinationResult(recordId: Int64) async throws -> VaccinationRecord {
        await pause()
        guard let dogId = vaccinationsByDog.first(where: { $0.value.recordId == recordId })?.key,
              let r = finishAnalysisIfReady(dogId: dogId) else { throw APIError.server(code: .notFound, status: 404, field: nil) }
        return r
    }
    func uploadVaccination(dogId: Int64, files: [UploadFile]) async throws -> VaccinationUpload {
        await pause()
        let id = 1000 + dogId
        vaccinationsByDog[dogId] = VaccinationRecord(recordId: id, status: .analyzing, items: [])
        analyzingSince[dogId] = .now
        return VaccinationUpload(recordId: id, status: .analyzing,
                                 documents: files.enumerated().map { .init(documentId: Int64($0.offset + 1)) })
    }
    func resubmitVaccination(recordId: Int64, files: [UploadFile]) async throws -> VaccinationState {
        guard let dogId = vaccinationsByDog.first(where: { $0.value.recordId == recordId })?.key else {
            throw APIError.server(code: .notFound, status: 404, field: nil)
        }
        let up = try await uploadVaccination(dogId: dogId, files: files)
        return VaccinationState(recordId: up.recordId, status: .analyzing)
    }
    func correctVaccination(recordId: Int64, _ c: VaccinationCorrection) async throws -> VaccinationState {
        await pause()
        guard let dogId = vaccinationsByDog.first(where: { $0.value.recordId == recordId })?.key else {
            throw APIError.server(code: .notFound, status: 404, field: nil)
        }
        vaccinationsByDog[dogId] = VaccinationRecord(
            recordId: recordId, status: .operatorReview,
            items: c.items.enumerated().map { VaccinationItem(itemId: Int64($0.offset + 500), vaccineCode: $0.element.vaccineCode,
                                                              vaccinatedAt: $0.element.vaccinatedAt, confidence: nil) })
        return VaccinationState(recordId: recordId, status: .operatorReview)
    }

    // MARK: - 챗봇 (예시 질문에 맞춘 고정 답변)

    func createChatSession() async throws -> ChatSessionCreated { await pause(); return .init(sessionId: 1, title: nil) }

    func sendChat(sessionId: Int64, _ r: ChatSendRequest) async throws -> ChatSent {
        try? await Task.sleep(for: .milliseconds(900))
        let t = r.content
        let content: String
        var refs: [ChatPlaceRef] = []
        if t.contains("FF") {
            let j = judgment(places[4].policy, t.contains("몽이") ? [1] : [2])
            content = j.overallVerdict == .prepare
                ? "콩이는 체중 조건은 맞아요. 다만 FF카페는 실내에서 유모차가 필요한데, 콩이 프로필에는 유모차가 없어요."
                : "FF카페는 들어갈 수 있어요. 필요한 준비물도 모두 있어요."
            refs = [ChatPlaceRef(placeId: "STORE:5", verdict: j.overallVerdict)]
        } else if t.contains("AA") {
            let j = judgment(places[0].policy, t.contains("같이") || t.contains("함께") ? [1, 2] : [1])
            content = j.overallVerdict == .noEntry
                ? "함께는 어려워요. AA카페는 5kg 이하만 들어갈 수 있어서 콩이는 체중 조건이 맞지 않아요. 몽이 혼자라면 갈 수 있어요."
                : "AA카페는 몽이와 들어갈 수 있어요."
            refs = [ChatPlaceRef(placeId: "STORE:1", verdict: j.overallVerdict)]
        } else if t.contains("성동") || t.contains("카페") {
            content = "성동구에서 반려동물 동반 출입을 신고한 카페 중 가까운 곳을 보여드릴게요. PawFit에 조건이 있는 곳은 판정도 함께 보여드려요."
            refs = [ChatPlaceRef(placeId: "STORE:2", verdict: judgment(places[1].policy, [1]).overallVerdict),
                    ChatPlaceRef(placeId: "PUBLIC:4", verdict: .unknown),
                    ChatPlaceRef(placeId: "PUBLIC:8", verdict: .unknown)]
        } else if t.contains("강릉") || t.contains("숙소") || t.contains("제주") {
            content = "공공데이터(한국문화정보원 반려동물 동반 가능 문화시설)에서 찾아봤어요. 시연용 목업에는 성수동 데이터만 있어서, 실제 서버에 연결하면 지역별 결과가 나와요."
        } else {
            content = "어떤 아이와 가세요? 매장 이름이나 지역과 함께 물어보시면 입장 조건을 확인해 드릴게요."
        }
        return ChatSent(userMessageId: Int64.random(in: 1...9999),
                        assistantMessage: ChatAssistantMessage(messageId: Int64.random(in: 1...9999), content: content, places: refs))
    }

    // MARK: - 댕댕로드

    func currentEvent() async throws -> CurrentEvent? {
        await pause(); return CurrentEvent(eventId: 7, title: "성수 댕댕로드 10곳 방문하기", year: 2026, quarter: 4, status: .open)
    }
    func event(_ id: Int64) async throws -> EventDetail {
        await pause()
        return EventDetail(eventId: 7, title: "성수 댕댕로드 10곳 방문하기", startsOn: "2026-10-01", endsOn: "2026-12-31",
                           regions: [11], prizes: [.init(rank: 1, name: "강아지 유모차", quantity: 1),
                                                   .init(rank: 2, name: "하네스", quantity: 5),
                                                   .init(rank: 3, name: "반려견 의류 쿠폰", quantity: 20),
                                                   .init(rank: 4, name: "커피 쿠폰", quantity: 100)],
                           notice: "응모는 분기 마지막 날까지 받고, 다음 분기 시작일에 발표해요.")
    }
    func stamps(eventId: Int64) async throws -> StampStatus {
        await pause()
        return StampStatus(eventId: 7, stampCount: stampStores.count, maxStampCount: 10,
                           stores: stampStores.map { .init(storeId: $0, awarded: true) })
    }
    func eventStores(eventId: Int64) async throws -> [EventStore] {
        await pause()
        let names = ["AA카페", "BB식당", "FF카페", "DD카페", "HH가든", "II식당", "JJ카페", "KK커피", "LL베이커리", "NN펍", "OO살롱"]
        return names.enumerated().map { EventStore(storeId: Int64(101 + $0.offset), name: $0.element, distanceMeters: 150 * ($0.offset + 1)) }
    }
    func visits() async throws -> [Visit] { await pause(); return visitList }
    func visitQR(token: String, dogIds: [Int64]) async throws -> QRVisitResult {
        await pause()
        let next = Int64(101 + stampStores.count)
        let awarded = stampStores.count < 10 && !stampStores.contains(next)
        if awarded {
            stampStores.append(next)
            let stores = try await eventStores(eventId: 7)
            let name = stores.first { $0.storeId == next }?.name ?? "DD카페"
            visitList.insert(Visit(visitId: Int64(visitList.count + 1), storeName: name,
                                   visitedAt: ISO8601DateFormatter().string(from: .now)), at: 0)
        }
        return QRVisitResult(visitId: Int64(visitList.count), storeId: next, stampAwarded: awarded, stampCount: stampStores.count)
    }
    func enterDraw(eventId: Int64, _ r: DrawEntryRequest) async throws -> DrawEntryCreated {
        await pause()
        guard stampStores.count >= 10 else { throw APIError.server(code: .unknown("INSUFFICIENT_STAMPS"), status: 400, field: nil) }
        entered = DrawEntry(drawEntryId: 1, status: .entered, prize: nil)
        return DrawEntryCreated(drawEntryId: 1, status: .entered, stampCount: stampStores.count)
    }
    func drawEntry(eventId: Int64) async throws -> DrawEntry? { await pause(); return entered }

    /// 목업 전용: 시연에서 10곳을 바로 채워 응모 화면을 보여 줄 때
    func fillStamps() { stampStores = Array(101...110) }

    // MARK: - 회원가입

    func terms() async throws -> [Term] {
        await pause()
        return [Term(termId: 1, title: "만 14세 이상이에요", required: true, version: "1.0"),
                Term(termId: 2, title: "서비스 이용약관", required: true, version: "1.0"),
                Term(termId: 3, title: "개인정보 수집·이용", required: true, version: "1.0"),
                Term(termId: 4, title: "위치기반 서비스 이용약관", required: true, version: "1.0"),
                Term(termId: 5, title: "혜택·광고 알림 받기", required: false, version: "1.0")]
    }
    func sendPhoneCode(_ phone: String) async throws -> PhoneVerificationSent {
        await pause()
        guard PhoneRule.isValid(phone) else { throw APIError.server(code: .validationError, status: 400, field: "phoneNumber") }
        return PhoneVerificationSent(verificationId: 1, expiresInSeconds: 180)
    }
    func confirmPhoneCode(id: Int64, code: String) async throws -> String {
        await pause()
        guard code == "123456" else { throw APIError.server(code: .invalidVerificationCode, status: 400, field: "code") }
        return "mock-verification-token"
    }
    func signup(_ r: SignupRequest) async throws -> SignupResponse {
        await pause()
        name = r.name
        dogsById = [:]
        return SignupResponse(userId: 2, role: .guardian, accessToken: "mock-access", refreshToken: "mock-refresh")
    }
}
