import Foundation

/// 사용자 앱이 쓰는 백엔드 기능 전체. 화면은 이 프로토콜만 안다.
/// 실서버 = `LivePawFitAPI`, 목업 = `MockPawFitAPI` (캔버스 예시 데이터).
protocol PawFitAPI: Sendable {
    // 내 정보 · 알림
    func me() async throws -> Me
    func updateName(_ name: String) async throws -> ProfileUpdated
    func notificationSettings() async throws -> NotificationSettings
    func updateNotificationSettings(_ s: NotificationSettings) async throws -> NotificationSettings
    func withdraw(password: String) async throws

    // 반려견
    func dogs() async throws -> [DogSummary]
    func dog(_ id: Int64) async throws -> DogDetail
    func createDog(_ r: DogCreateRequest) async throws -> DogCreated
    func updateDog(_ id: Int64, _ r: DogUpdateRequest) async throws
    func setDefaultDog(_ id: Int64) async throws
    func deleteDog(_ id: Int64) async throws
    func breeds() async throws -> [Breed]

    // 지도 · 업체
    func mapPlaces(latitude: Double, longitude: Double, radiusM: Int, category: String?, dogIds: [Int64]) async throws -> [PlaceCard]
    func searchPlaces(keyword: String, dogIds: [Int64]) async throws -> [PlaceCard]
    func placeDetail(_ id: String, dogIds: [Int64]) async throws -> PlaceDetail
    func judge(_ id: String, dogIds: [Int64]) async throws -> EntryJudgment

    // 예방접종
    func vaccinationRecord(dogId: Int64) async throws -> VaccinationRecord
    func vaccinationResult(recordId: Int64) async throws -> VaccinationRecord
    func uploadVaccination(dogId: Int64, files: [UploadFile]) async throws -> VaccinationUpload
    func resubmitVaccination(recordId: Int64, files: [UploadFile]) async throws -> VaccinationState
    func correctVaccination(recordId: Int64, _ c: VaccinationCorrection) async throws -> VaccinationState

    // 챗봇
    func createChatSession() async throws -> ChatSessionCreated
    func sendChat(sessionId: Int64, _ r: ChatSendRequest) async throws -> ChatSent

    // 댕댕로드
    func currentEvent() async throws -> CurrentEvent?
    func event(_ id: Int64) async throws -> EventDetail
    func stamps(eventId: Int64) async throws -> StampStatus
    func eventStores(eventId: Int64) async throws -> [EventStore]
    func visits() async throws -> [Visit]
    func visitQR(token: String, dogIds: [Int64]) async throws -> QRVisitResult
    func enterDraw(eventId: Int64, _ r: DrawEntryRequest) async throws -> DrawEntryCreated
    func drawEntry(eventId: Int64) async throws -> DrawEntry?

    // 회원가입
    func terms() async throws -> [Term]
    func sendPhoneCode(_ phone: String) async throws -> PhoneVerificationSent
    func confirmPhoneCode(id: Int64, code: String) async throws -> String
    func signup(_ r: SignupRequest) async throws -> SignupResponse
}

struct LivePawFitAPI: PawFitAPI {
    let api: APIClient

    // MARK: 내 정보
    func me() async throws -> Me { try await api.send(AuthEndpoints.me) }
    func updateName(_ name: String) async throws -> ProfileUpdated {
        try await api.send(Endpoint(method: .patch, path: APIPath.me, body: ProfileUpdate(name: name)))
    }
    func notificationSettings() async throws -> NotificationSettings {
        try await api.send(Endpoint(method: .get, path: APIPath.meNotificationSettings))
    }
    func updateNotificationSettings(_ s: NotificationSettings) async throws -> NotificationSettings {
        try await api.send(Endpoint(method: .patch, path: APIPath.meNotificationSettings, body: s))
    }
    func withdraw(password: String) async throws {
        let _: EmptyResponse = try await api.send(Endpoint(method: .delete, path: APIPath.me,
                                                           body: Withdrawal(password: password, reason: nil)))
    }

    // MARK: 반려견
    func dogs() async throws -> [DogSummary] {
        let list: DogList = try await api.send(Endpoint(method: .get, path: APIPath.dogs))
        return list.dogs
    }
    func dog(_ id: Int64) async throws -> DogDetail { try await api.send(Endpoint(method: .get, path: APIPath.dog(id))) }
    func createDog(_ r: DogCreateRequest) async throws -> DogCreated {
        try await api.send(Endpoint(method: .post, path: APIPath.dogs, body: r))
    }
    func updateDog(_ id: Int64, _ r: DogUpdateRequest) async throws {
        let _: EmptyResponse = try await api.send(Endpoint(method: .patch, path: APIPath.dog(id), body: r))
    }
    func setDefaultDog(_ id: Int64) async throws {
        let _: EmptyResponse = try await api.send(Endpoint(method: .patch, path: APIPath.dogDefault(id)))
    }
    func deleteDog(_ id: Int64) async throws {
        let _: EmptyResponse = try await api.send(Endpoint(method: .delete, path: APIPath.dog(id)))
    }
    func breeds() async throws -> [Breed] {
        let list: BreedList = try await api.send(Endpoint(method: .get, path: APIPath.breeds, requiresAuth: false))
        return list.breeds
    }

    // MARK: 지도 · 업체
    func mapPlaces(latitude: Double, longitude: Double, radiusM: Int, category: String?, dogIds: [Int64]) async throws -> [PlaceCard] {
        var q = [URLQueryItem(name: "latitude", value: String(latitude)),
                 URLQueryItem(name: "longitude", value: String(longitude)),
                 URLQueryItem(name: "radiusMeters", value: String(min(max(radiusM, 1), 50_000)))]
        if let category { q.append(URLQueryItem(name: "category", value: category)) }
        q += dogIds.map { URLQueryItem(name: "dogIds", value: String($0)) }
        let r: PlaceMapResult = try await api.send(Endpoint(method: .get, path: APIPath.placesMap, query: q))
        return r.places
    }
    func searchPlaces(keyword: String, dogIds: [Int64]) async throws -> [PlaceCard] {
        var q = [URLQueryItem(name: "keyword", value: keyword), URLQueryItem(name: "size", value: "30")]
        q += dogIds.map { URLQueryItem(name: "dogIds", value: String($0)) }
        let r: PlaceSearchResult = try await api.send(Endpoint(method: .get, path: APIPath.places, query: q))
        return r.items
    }
    func placeDetail(_ id: String, dogIds: [Int64]) async throws -> PlaceDetail {
        try await api.send(Endpoint(method: .get, path: APIPath.place(id),
                                    query: dogIds.map { URLQueryItem(name: "dogIds", value: String($0)) }))
    }
    func judge(_ id: String, dogIds: [Int64]) async throws -> EntryJudgment {
        try await api.send(Endpoint(method: .post, path: APIPath.entryJudgments(id), body: EntryJudgmentRequest(dogIds: dogIds)))
    }

    // MARK: 예방접종
    func vaccinationRecord(dogId: Int64) async throws -> VaccinationRecord {
        try await api.send(Endpoint(method: .get, path: APIPath.vaccinationRecordOfDog(dogId)))
    }
    func vaccinationResult(recordId: Int64) async throws -> VaccinationRecord {
        try await api.send(Endpoint(method: .get, path: APIPath.vaccinationRecord(recordId)))
    }
    func uploadVaccination(dogId: Int64, files: [UploadFile]) async throws -> VaccinationUpload {
        try await api.send(Endpoint(method: .post, path: APIPath.vaccinationDocuments(dogId: dogId), files: files))
    }
    func resubmitVaccination(recordId: Int64, files: [UploadFile]) async throws -> VaccinationState {
        try await api.send(Endpoint(method: .post, path: APIPath.vaccinationResubmit(recordId), files: files))
    }
    func correctVaccination(recordId: Int64, _ c: VaccinationCorrection) async throws -> VaccinationState {
        try await api.send(Endpoint(method: .patch, path: APIPath.vaccinationRecord(recordId), body: c))
    }

    // MARK: 챗봇
    func createChatSession() async throws -> ChatSessionCreated {
        try await api.send(Endpoint(method: .post, path: APIPath.chatSessions, body: ChatSessionCreate(title: nil)))
    }
    func sendChat(sessionId: Int64, _ r: ChatSendRequest) async throws -> ChatSent {
        try await api.send(Endpoint(method: .post, path: APIPath.chatMessages(sessionId), body: r))
    }

    // MARK: 댕댕로드
    func currentEvent() async throws -> CurrentEvent? {
        do { return try await api.send(Endpoint(method: .get, path: APIPath.currentEvent)) }
        catch APIError.server(.unknown("EVENT_NOT_FOUND"), _, _) { return nil }
        catch APIError.server(.notFound, _, _) { return nil }
    }
    func event(_ id: Int64) async throws -> EventDetail { try await api.send(Endpoint(method: .get, path: APIPath.event(id))) }
    func stamps(eventId: Int64) async throws -> StampStatus {
        try await api.send(Endpoint(method: .get, path: APIPath.eventStamps(eventId)))
    }
    func eventStores(eventId: Int64) async throws -> [EventStore] {
        let r: EventStoreList = try await api.send(Endpoint(method: .get, path: APIPath.eventStores(eventId)))
        return r.items
    }
    func visits() async throws -> [Visit] {
        let r: VisitList = try await api.send(Endpoint(method: .get, path: APIPath.visits))
        return r.items
    }
    func visitQR(token: String, dogIds: [Int64]) async throws -> QRVisitResult {
        try await api.send(Endpoint(method: .post, path: APIPath.visitQR, body: QRVisitRequest(qrToken: token, dogIds: dogIds)))
    }
    func enterDraw(eventId: Int64, _ r: DrawEntryRequest) async throws -> DrawEntryCreated {
        try await api.send(Endpoint(method: .post, path: APIPath.drawEntries(eventId), body: r))
    }
    func drawEntry(eventId: Int64) async throws -> DrawEntry? {
        do { return try await api.send(Endpoint(method: .get, path: APIPath.drawEntry(eventId))) }
        catch APIError.server(.unknown("DRAW_ENTRY_NOT_FOUND"), _, _) { return nil }
        catch APIError.server(.notFound, _, _) { return nil }
    }

    // MARK: 회원가입
    func terms() async throws -> [Term] {
        let r: TermList = try await api.send(Endpoint(method: .get, path: APIPath.terms,
                                                      query: [URLQueryItem(name: "role", value: "GUARDIAN")],
                                                      requiresAuth: false))
        return r.terms
    }
    func sendPhoneCode(_ phone: String) async throws -> PhoneVerificationSent {
        try await api.send(Endpoint(method: .post, path: APIPath.phoneVerifications,
                                    body: PhoneVerificationRequest(phoneNumber: PhoneRule.digits(phone), purpose: .signUp),
                                    requiresAuth: false))
    }
    func confirmPhoneCode(id: Int64, code: String) async throws -> String {
        let r: PhoneVerificationConfirmed = try await api.send(Endpoint(
            method: .post, path: APIPath.phoneVerificationsConfirm,
            body: PhoneVerificationConfirm(verificationId: id, code: code), requiresAuth: false))
        guard r.verified, let token = r.verificationToken else {
            throw APIError.server(code: .invalidVerificationCode, status: 400, field: "code")
        }
        return token
    }
    func signup(_ r: SignupRequest) async throws -> SignupResponse {
        try await api.send(Endpoint(method: .post, path: APIPath.signupGuardian, body: r, requiresAuth: false))
    }
}
