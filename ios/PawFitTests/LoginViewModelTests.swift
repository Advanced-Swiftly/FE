import XCTest
@testable import PawFit

@MainActor
final class LoginViewModelTests: XCTestCase {
    private func makeViewModel() -> (LoginViewModel, InMemoryTokenStore) {
        let store = InMemoryTokenStore()
        let auth = MockAuthService(tokenStore: store, latency: .zero)
        return (LoginViewModel(auth: auth), store)
    }

    func test_빈칸이면_요청하지_않고_빈_칸을_알려준다() async {
        let (vm, _) = makeViewModel()
        XCTAssertEqual(vm.firstEmptyField, .phone)
        vm.phone = "01012345678"
        XCTAssertEqual(vm.firstEmptyField, .password)
        let name = await vm.login()
        XCTAssertNil(name)
        XCTAssertNil(vm.errorMessage)
    }

    func test_맞는_계정이면_이름을_돌려준다() async {
        let (vm, store) = makeViewModel()
        vm.phone = MockAuthService.demoPhone
        vm.password = MockAuthService.demoPassword
        let name = await vm.login()
        XCTAssertEqual(name, "이채린")
        XCTAssertNotNil(store.load())
    }

    func test_틀리면_어느_칸인지_말하지_않는_문구() async {
        let (vm, _) = makeViewModel()
        vm.phone = "01012345678"
        vm.password = "wrong!pass"
        _ = await vm.login()
        XCTAssertEqual(vm.errorMessage, "휴대폰 번호 또는 비밀번호가 맞지 않아요")
        XCTAssertTrue(vm.showsError)
    }

    func test_다시_입력하면_오류가_사라진다() async {
        let (vm, _) = makeViewModel()
        vm.phone = "01012345678"
        vm.password = "wrong!pass"
        _ = await vm.login()
        vm.password += "1"
        XCTAssertNil(vm.errorMessage)
    }

    func test_요청_과다_업체_계정_연결_오류_문구() async {
        let (vm, _) = makeViewModel()
        vm.phone = "01000000000"
        vm.password = "anything!1"
        _ = await vm.login()
        XCTAssertEqual(vm.errorMessage, "요청이 많아요. 잠시 후 다시 시도해 주세요")

        vm.phone = "01055555555"
        _ = await vm.login()
        XCTAssertEqual(vm.errorMessage, "보호자 계정으로 로그인해 주세요")

        vm.phone = "01099999999"
        _ = await vm.login()
        XCTAssertEqual(vm.errorMessage, "인터넷 연결을 확인해 주세요")
    }
}

final class RuleTests: XCTestCase {
    @MainActor
    func test_휴대폰_번호는_입력하면서_하이픈이_붙는다() {
        let vm = LoginViewModel(auth: MockAuthService(tokenStore: InMemoryTokenStore(), latency: .zero))
        vm.phone = "0101234"
        XCTAssertEqual(vm.phone, "010-1234")
        vm.phone = "01012345678"
        XCTAssertEqual(vm.phone, "010-1234-5678")
        vm.phone = "010123456789"                       // 11자리 넘으면 자름
        XCTAssertEqual(vm.phone, "010-1234-5678")
    }

    func test_휴대폰_번호_규칙() {
        XCTAssertEqual(PhoneRule.digits("010-1234-5678"), "01012345678")
        XCTAssertTrue(PhoneRule.isValid("010-1234-5678"))
        XCTAssertFalse(PhoneRule.isValid("011-123-4567"))      // 서버는 010만 받음
        XCTAssertFalse(PhoneRule.isValid("02-123-4567"))
    }

    func test_비밀번호_조건() {
        XCTAssertTrue(PasswordRule.isValid("pawfit!1"))
        XCTAssertTrue(PasswordRule.isValid("abcdefg#"))        // 숫자는 없어도 됨
        XCTAssertFalse(PasswordRule.isValid("pawfit12"))       // 특수기호 없음
        XCTAssertFalse(PasswordRule.isValid("1234!@#$"))       // 영문 없음
        XCTAssertFalse(PasswordRule.isValid("pa!1"))           // 8자 미만
    }

    func test_함께_가요는_가장_나쁜_판정() {
        XCTAssertEqual(Verdict.worst(of: [.entryOK, .prepare]), .prepare)
        XCTAssertEqual(Verdict.worst(of: [.prepare, .unknown]), .unknown)
        XCTAssertEqual(Verdict.worst(of: [.unknown, .noEntry, .entryOK]), .noEntry)
        XCTAssertEqual(Verdict.worst(of: [.entryOK, .entryOK]), .entryOK)
    }

    func test_판정값은_서버_문자열과_같다() throws {
        let decoded = try JSONDecoder().decode([Verdict].self, from: Data(#"["ENTRY_OK","PREPARE","ENTRY_DENIED","CHECK_REQUIRED"]"#.utf8))
        XCTAssertEqual(decoded, [.entryOK, .prepare, .noEntry, .unknown])
    }
}
