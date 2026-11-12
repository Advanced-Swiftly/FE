import XCTest
@testable import PawFit

/// 화면에 쓰는 모델 도우미 · 목업 판정 규칙 테스트
final class ModelTests: XCTestCase {

    // MARK: 조사

    func testJosa() {
        XCTAssertEqual(Josa.topic("몽이"), "몽이는")
        XCTAssertEqual(Josa.topic("콩"), "콩은")
        XCTAssertEqual(Josa.object("콩이"), "콩이를")
        XCTAssertEqual(Josa.with("밤"), "밤과")
        XCTAssertTrue(Josa.hasBatchim("별"))
        XCTAssertFalse(Josa.hasBatchim("몽이"))
    }

    // MARK: 날짜

    func testDateText() {
        XCTAssertEqual(DateText.dotted("2026-09-10"), "2026.09.10")
        XCTAssertEqual(DateText.fromDotted("2026.09.10"), "2026-09-10")
        XCTAssertEqual(DateText.fromDotted("20260910"), "2026-09-10")
        XCTAssertNil(DateText.fromDotted("2026.9.1"))
        XCTAssertEqual(DateText.monthDay("2026-10-12"), "10월 12일")
        // 서버 Instant (소수점 9자리)
        XCTAssertNotNil(DateText.instant("2026-10-12T05:20:00.123456789Z"))
        XCTAssertEqual(DateText.monthDay("2026-10-12T05:20:00.123456789Z"), "10월 12일")
    }

    // MARK: 예방접종 표시

    func testVaccinationBadge() {
        XCTAssertEqual(VaccinationBadge(record: .analyzed), .verified)
        XCTAssertEqual(VaccinationBadge(record: .needsManualReview), .needsMore)
        XCTAssertEqual(VaccinationBadge(record: .rejected), .reupload)
        XCTAssertEqual(VaccinationBadge(record: .operatorReview), .operatorReview)
        XCTAssertEqual(VaccinationBadge(record: .notSubmitted), .none)
    }

    func testVaccinationRecordDecodesUnknownStatus() throws {
        let json = #"{"recordId":3,"status":"SOMETHING_NEW","items":[{"itemId":1,"vaccineCode":"DHPPL","vaccinatedAt":"2026-09-10","confidence":0.92}]}"#
        let r = try JSONDecoder().decode(VaccinationRecord.self, from: Data(json.utf8))
        XCTAssertEqual(r.status, .unknown)
        XCTAssertEqual(r.latestDate, "2026-09-10")
        XCTAssertEqual(r.itemTitles, "종합백신")
    }

    // MARK: 조건 표

    private func detail(reasons: [String] = [], unrestricted: [String] = []) -> PlaceDetail {
        PlaceDetail(placeId: "STORE:5", name: "FF카페", address: nil, latitude: 0, longitude: 0, verdict: .prepare,
                    reasons: reasons, unrestrictedFields: unrestricted, policySource: nil, confirmedOn: nil, googleMapsUrl: nil)
    }

    func testConditionRowsShowMissingEquipment() {
        let dog = DogBasisInfo(dogId: 2, name: "콩이", weightKg: 10, equipment: [.mannerBelt], vaccinationVerified: false)
        let rows = ConditionTable.rows(detail: detail(unrestricted: ["BREED", "VACCINE"]), dogs: [dog],
                                       judgments: [2: ReasonCode.parse(["STROLLER_REQUIRED"])])
        let stroller = rows.first { $0.label == Equipment.stroller.title }
        XCTAssertEqual(stroller?.results, [.prepare("없음")])
        XCTAssertEqual(rows.first { $0.label == "체중" }?.results, [.ok("10kg")])
    }

    func testConditionRowsUnknownPolicy() {
        let rows = ConditionTable.rows(detail: detail(reasons: ["POLICY_UNCONFIRMED"]), dogs: [], judgments: [:])
        XCTAssertTrue(rows.allSatisfy { $0.results.allSatisfy { $0 == .unknown } })
    }

    // MARK: 목업 판정 (서버 규칙과 같아야 함)

    func testMockJudgment() async throws {
        let api = MockPawFitAPI(latency: .zero)
        // AA카페: 5kg 이하 → 몽이(5kg) 가능, 콩이(10kg) 불가, 함께 = 가장 까다로운 결과
        let aaMong = try await api.judge("STORE:1", dogIds: [1])
        let aaKong = try await api.judge("STORE:1", dogIds: [2])
        let aaBoth = try await api.judge("STORE:1", dogIds: [1, 2])
        XCTAssertEqual(aaMong.overallVerdict, .entryOK)
        XCTAssertEqual(aaKong.overallVerdict, .noEntry)
        XCTAssertEqual(aaBoth.overallVerdict, .noEntry)
        XCTAssertEqual(aaBoth.dogs.count, 2)

        // FF카페: 유모차 필수 → 콩이는 준비 필요
        let ff = try await api.judge("STORE:5", dogIds: [2])
        XCTAssertEqual(ff.overallVerdict, .prepare)
        XCTAssertTrue(ff.dogs[0].reasons?.contains("STROLLER_REQUIRED") == true)

        // 공공데이터(정책 없음) → 확인 필요
        let pub = try await api.judge("PUBLIC:4", dogIds: [1])
        XCTAssertEqual(pub.overallVerdict, .unknown)
    }

    func testVerdictWorst() {
        XCTAssertEqual(Verdict.worst(of: [.entryOK, .prepare]), .prepare)
        XCTAssertEqual(Verdict.worst(of: [.entryOK, .noEntry, .unknown]), .noEntry)
    }
}
