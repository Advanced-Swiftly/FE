# PawFit-admin-frontend

PawFit 운영자 콘솔 (Admin Web) · 운영자가 정책 후보 · 변경 요청 · 이벤트 · 광고 신청 검토, 예방접종 증명서 확인, 업체 관리, Q&A 답변을 하는 웹이에요.

> 팀 GitHub 저장소가 만들어지기 전까지 로컬에서 먼저 작업하는 프로젝트예요. 원격 저장소가 생기면 `git remote add origin <주소>` 후 `main`, `develop` 브랜치를 올리면 돼요.

## 🛠 기술 스택

- React 19 · TypeScript · Vite
- React Router (`createBrowserRouter`)
- axios (API 호출) · CSS Modules + CSS 변수 디자인 토큰
- oxlint (린트)

## ▶️ 실행 방법

Node.js 20.19 이상이 필요해요.

```bash
npm install
cp .env.example .env   # 처음 한 번 (Windows: copy .env.example .env)
npm run dev            # http://localhost:5174
```

| 명령어 | 설명 |
| --- | --- |
| `npm run dev` | 개발 서버 실행 (포트 5174) |
| `npm run build` | 타입 검사 + 배포용 빌드 |
| `npm run lint` | 린트 검사 |
| `npm run preview` | 빌드 결과 미리 보기 |

### 환경 변수 (`.env`)

| 이름 | 설명 |
| --- | --- |
| `VITE_API_BASE_URL` | 백엔드 API 주소 |
| `VITE_USE_MOCK` | `true` 면 `src/mocks` 예시 데이터 사용, `false` 면 실제 API 호출 |

`.env` 는 Git 에 올리지 않아요. 값이 바뀌면 `.env.example` 도 같이 고쳐 주세요.

## 📁 폴더 구조

```
src/
├── api/            # API 함수 (client.ts: axios 설정 · mock 전환)
├── mocks/          # API 명세 확정 전 예시 데이터
├── components/
│   ├── common/     # Button, Field, Card, Modal, PageHeader, Notice, Tag, Timeline 등 공용 UI
│   └── layout/     # AdminLayout · AdminSidebar (어두운 사이드바 + 처리 대기 배지)
├── constants/      # 요청 상태 · 판정 · 지역 상수와 라벨
├── hooks/          # useFetch 등 공용 훅
├── pages/          # 화면 (기능별 폴더)
├── routes/         # router.tsx (전체 경로)
├── styles/         # tokens.css (색 · 글자 · 간격), global.css
├── types/          # 공용 타입
└── utils/          # 날짜 포맷 등
```

- import 는 `@/` 로 시작해요. 예: `import { Button } from '@/components/common/Button';`
- 색 · 간격은 직접 쓰지 말고 `tokens.css` 변수를 써 주세요. 예: `color: var(--color-primary);`
- 새 화면은 `pages/기능/이름Page.tsx` 로 만들고 `routes/router.tsx` 에 경로를 추가해요.
- API 는 `api/` 에 함수로 만들고, 화면에서는 `useFetch` 로 불러요. 예시는 대시보드 화면을 참고해 주세요.

## 🗺 화면 목록

모든 화면은 `src/mocks` 예시 데이터로 동작해요 (신청 · 처리 결과도 새로고침 전까지 화면에 반영돼요). API 연동할 곳은 `src/api/*.ts` 의 `TODO` 를 보면 돼요.

| 경로 | 화면 |
| --- | --- |
| `/login` | 운영자 로그인 |
| `/queue` | 검토 대기열 |
| `/queue/policy/:id` | 정책 · 변경 요청 검토 상세 |
| `/queue/apply/:id` | 이벤트 · 광고 신청 검토 |
| `/vaccines` | 예방접종 증명서 확인 |
| `/stores` | 업체 목록 |
| `/stores/:id` | 업체 상세 · 관리 |
| `/qna` | Q&A |

---

# Swiftly FE

## 🚀 Git Flow

### `main`

- 프로젝트 최종 merge
- 기본 프로젝트 세팅 및 배포 가능한 브랜치
- 항상 배포 가능한 상태를 유지

### `develop`

- 프로젝트 완성 전까지 구현이 완료된 기능들을 계속해서 merge
- 개발 내용을 통합하고 관리하는 브랜치

### `{type}/{issue number}`

- 개발 브랜치
- 예: `feat/#5`, `fix/#11`, `design/#15`
- 작업 단위로 이슈 생성 → 브랜치 생성 → 생성한 브랜치에서 작업 후 끝나면 `develop` 브랜치로 PR 남기기

> 모든 작업 시작 전 생성한 브랜치에서 `develop` 브랜치의 최신 내용을 pull 받은 후 작업

## 💡 PR Rules

- Assignee에는 본인을 지정해 주세요.
- Reviewers에는 본인을 제외한 프론트엔드 팀원을 지정한 후, 카카오톡으로 공유해 주세요.
- 이후 팀원이 PR을 확인하고 승인한 뒤 merge해 주세요.
- UI 변경 사항이 있는 경우 필요한 스크린샷을 함께 첨부해 주세요.
- 해당 브랜치는 merge 후 삭제하며, 필요할 경우 복구할 수 있습니다.

## 💻 Commit Message Convention

| Type | Description |
| --- | --- |
| Feat | 새로운 기능 추가 |
| Fix | 버그 수정 |
| Docs | 문서 수정 |
| Style | 코드 formatting, 공백 수정 등 코드 동작의 변경이 없는 경우 |
| Refactor | 코드 리팩토링 |
| Test | 테스트 코드 추가 및 수정 |
| Chore | 패키지, 설정 파일, .gitignore 등 기타 수정 |
| Design | 사용자 UI 및 디자인 변경 |
| Comment | 필요한 주석 추가 및 변경 |
| Rename | 파일 또는 폴더명을 수정하거나 이동하는 작업 |
| Remove | 파일을 삭제하는 작업 |
| Init | 프로젝트 초기 세팅 |
| Merge | 브랜치 merge |
| !BREAKING CHANGE | 기존 기능과 호환되지 않는 큰 변경 |
| !HOTFIX | 치명적인 버그를 긴급하게 수정하는 경우 |

```
Type: commit title
```

ex. `Feat: 로그인 기능 추가` ex. `Design: 로그인 화면 UI 수정` ex. `Fix: 버튼 클릭 오류 수정`
