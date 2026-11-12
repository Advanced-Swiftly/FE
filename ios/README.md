# PawFit 사용자 앱 (iOS · SwiftUI)

반려견 보호자가 쓰는 PawFit 앱. 업체 관리자 웹 · 관리자 화면(React, 차명실)과는 따로 빌드하고, **디자인 규칙 · API 규칙 · 용어**만 맞춘다.

- 담당: 이채린 (사용자 앱)
- 기준 문서: 기능 명세서 — 사용자 앱(0.2), UI 설계 보고서 2.1, 디자인방향.md, 결정사항.md
- 디자인 원본: 캔버스 'PawFit 출입증' (https://claude.ai/artifact/4G5UuMGr9Tv4BX5KPC62zX)

## 처음 실행하기

필요한 것: macOS + Xcode 16 이상, iOS 17 시뮬레이터, [XcodeGen](https://github.com/yonaskolb/XcodeGen)

```bash
brew install xcodegen
cd FE/ios
xcodegen generate        # project.yml → PawFit.xcodeproj
open PawFit.xcodeproj     # 스킴 PawFit, iPhone 15/16 시뮬레이터로 실행(⌘R), 테스트(⌘U)
```

명령줄로 빌드 · 테스트:

```bash
xcodebuild test -project PawFit.xcodeproj -scheme PawFit \
  -destination 'platform=iOS Simulator,name=iPhone 16'
```

`.xcodeproj`는 저장소에 올리지 않는다. 파일을 추가 · 삭제한 뒤에는 `xcodegen generate`만 다시 하면 된다(충돌 방지).

## 백엔드 연결

기본(Debug)은 **백엔드 시연 서버**에 붙는다 → `PawFit/Config/Debug.xcconfig`

| 값 | 지금 | 뜻 |
| --- | --- | --- |
| `PAWFIT_API_BASE_URL` | `https://pawfit-api.onrender.com/api/v1` | 서버 주소, `/api/v1`까지 포함. `//`는 `/$()/`로 쓴다 |
| `PAWFIT_USE_MOCK_API` | `NO` | `YES`면 서버 없이 앱 안 가짜 데이터 |

- 서버: Render 무료(싱가포르), BE `develop` 브랜치가 자동 배포. 한동안 요청이 없으면 잠들어서 **첫 요청이 30~60초** 걸릴 수 있다.
- 시연 기간 휴대폰 인증번호는 **123456 고정**.
- API 문서: `https://pawfit-api.onrender.com/swagger-ui.html`
- 경로는 `Core/Network/APIPath.swift`, 백엔드와의 차이 · 요청할 것은 `docs/백엔드연동.md`.

개인 설정은 `PawFit/Config/Local.xcconfig.example`을 `Local.xcconfig`로 복사해서 덮어쓴다(저장소에 안 올라감). 목업으로 보거나, 내 맥에서 띄운 백엔드(`http://localhost:8080`)에 붙을 때 쓴다.

목업 계정 (`PAWFIT_USE_MOCK_API = YES`일 때)

| 휴대폰 번호 | 비밀번호 | 결과 |
| --- | --- | --- |
| 010-1234-5678 | pawfit!123 | 로그인 성공 → 지도 |
| 그 밖의 값 | | "휴대폰 번호 또는 비밀번호가 맞지 않아요" |
| 010-0000-0000 | 아무거나 | 요청 과다(TOO_MANY_REQUESTS) |
| 010-5555-5555 | 아무거나 | 업체관리자 계정 → "보호자 계정으로 로그인해 주세요" |
| 010-9999-9999 | 아무거나 | 네트워크 오류 |

목업에서는 반려견 몽이(말티즈 5kg) · 콩이(푸들 10kg), 성수동 매장 8곳, 댕댕로드 스탬프 3/10이 들어 있다. 회원가입 인증번호는 123456, QR 화면에는 [시연용 QR로 인증하기] 버튼이 보인다(한 번에 스탬프 1개).

## 폴더 구조

```
PawFit/
  App/            앱 시작, 화면 흐름(AppSession), 의존성(AppEnvironment)
  Config/         Debug · Release 설정
  DesignSystem/   색 · 글꼴 · 판정 4색 · 모서리 토큰, 공용 컴포넌트
  Core/Network/   API 클라이언트(백엔드 규칙), 경로 모음, 오류 코드
  Core/Auth/      로그인 · 토큰 · 내 정보 모델과 서비스(실서버/목업)
  Core/Storage/   토큰 키체인 저장
  Core/Models/    서버 응답 모델(반려견 · 장소 · 예방접종 · 이벤트 · 챗봇 · 회원), 날짜 · 조사 도우미
  Core/Services/  PawFitAPI(실서버 LivePawFitAPI / 목업 MockPawFitAPI)
  Core/Location/  현재 위치 (거부 시 성수동)
  Features/       화면별 폴더 (Start, Login, SignUp, Map, Dogs, Vaccination, Chat, My, Road)
  Resources/      Pretendard 글꼴, 로고, 앱 아이콘
PawFitTests/      API · 로그인 · 규칙 테스트
```

## 디자인 → 코드 규칙

캔버스 보드는 390×844, 상태 표시줄 없이 그려져 있다. 값은 pt로 그대로 옮긴다.

| 캔버스(CSS) | SwiftUI |
| --- | --- |
| 색 hex | `PawFitColor.*` / 판정은 `Verdict.fill · text · background`만 |
| Pretendard 400/600/700 | `.font(.pawfit(15))`, `.pawfit(17, .semibold)`, `.pawfit(40, .bold)` |
| `box-shadow` blur N | `.shadow(radius: N/2)` |
| `inset` 그림자 | `.fill(color.shadow(.inner(...)))` |
| Tabler 아이콘 1.75 | 가까운 SF Symbols (대응표는 화면 만들 때마다 여기에 추가) |
| `line-height: 1.6` (15px) | `.lineSpacing(15 * 0.6)` |

지킬 것

- 판정 4색은 판정에만. 오류는 로즈(`errorBorder` · `errorText`). 판정 상태는 색 + 모양(✓ ! ✕ ?) + 글자를 같이.
- 판정은 서버가 계산한다. 앱은 서버 값(`ENTRY_OK` …)을 표시만 한다.
- 문구는 해요체. 서버 오류는 `code`로 앱 문구를 고른다(`APIErrorCode.defaultMessage`). 서버 `message`는 화면에 쓰지 않는다.
- 누를 수 있는 곳은 44pt 이상, 아이콘 버튼에는 `accessibilityLabel`.
- 화면마다 `#Preview`를 두고 캔버스 보드와 나란히 비교한다.

## 화면 진행 상황

| 캔버스 보드 | 화면 | 파일 | 서버 API |
| --- | --- | --- | --- |
| S0 · S1 | 시작 · 로그인(휴대폰 번호) | `Start/` `Login/` | `/auth/login` `/auth/refresh` `/users/me` |
| SignTerms · SignAccount · SignPhone · SignDone | 회원가입 3단계 · 출입증 | `SignUp/SignUpFlow.swift` | `/terms?role=GUARDIAN` `/auth/phone-verifications` `/auth/signup/guardian` |
| Map · MapList · MapDogMenu · Criteria · InfoGuide | 지도 · 목록 시트 · 반려견 기준 · 판정 기준 | `Map/` | `/places/map` `/places` |
| DetailOk/Prep/No/Unknown · Together · GoSheet | 업체 상세 · 조건 표 · 길찾기 | `Map/PlaceDetailView.swift` | `/places/{id}` `/places/{id}/entry-judgments` |
| DogBasic · DogPrep · DogPrepVax · DogDone | 반려견 등록 3단계 | `Dogs/DogRegistrationFlow.swift` | `/dogs` `/breeds` |
| MyDogs · DogEdit · DogDelete | 내 반려견 · 수정 · 삭제 | `Dogs/MyDogsView.swift` | `/dogs/{id}` `/dogs/{id}/default` |
| VaxEmpty · VaxUpload · VaxCheck · VaxStates · VaxEdit | 예방접종 증빙 (AI 확인) | `Vaccination/` | `/dogs/{id}/vaccination-documents` `/vaccination-records/{id}` |
| ChatEmpty · Chat · ChatPublic | 챗봇 | `Chat/ChatView.swift` | `/chat/sessions` `/chat/sessions/{id}/messages` |
| My · Account · Notify · Logout | 마이 · 계정 · 알림 · 로그아웃 | `My/MyView.swift` | `/users/me` `/users/me/notification-settings` |
| Road · QrScan · Stamp · DrawReady · DrawDone | 댕댕로드 · QR · 스탬프 · 추첨 | `Road/` | `/events/current` `/visits/qr` `/events/{id}/draw-entries` |

서버에 없어서 이 기기에만 저장하는 값: 배송지(추첨 응모 때 함께 보냄), 알림 '다녀온 매장 조건 변경' · '밤에도 받기', 반려견 성별 · 특이사항.
서버에 아직 없어 '다음 업데이트' 안내만 띄우는 것: 휴대폰 번호 변경, 비밀번호 변경, 반려견 사진.

지도는 지금 Apple 지도(MapKit). 백엔드가 Google 지도를 쓰기로 하면 `Map/PlaceMapLayer.swift` 한 파일만 바꾼다.

## 브랜치 · 커밋

저장소 루트 README의 Git Flow를 따른다.

- 이슈 만들기 → `feat/#이슈번호` 브랜치 → `develop`으로 PR
- 커밋: `Feat: 로그인 API 연결`, `Design: 로그인 화면 UI 수정`, `Fix: …`, `Chore: …`
- PR에 시뮬레이터 캡처와 캔버스 보드 캡처를 나란히 붙인다.
