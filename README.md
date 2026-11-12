# 🗣️ Swiftly FE

## 📁 폴더 구조

| 폴더 | 내용 | 담당 |
| --- | --- | --- |
| `ios/` | PawFit 사용자 앱 (iOS · SwiftUI) — 실행 방법은 [ios/README.md](ios/README.md) | 이채린 |

## 🚀 Git Flow

* `main`

  * 프로젝트 최종 merge
  * 기본 프로젝트 세팅 및 배포 가능한 브랜치
  * 항상 배포 가능한 상태를 유지
* `develop`

  * 프로젝트 완성 전까지 구현이 완료된 기능들을 계속해서 merge
  * 개발 내용을 통합하고 관리하는 브랜치
* `{type}/{issue number}`

  * 개발 브랜치
  * 예: `feat/#5`, `fix/#11`, `design/#15`

> 작업 단위로 이슈 생성 → 브랜치 생성 → 생성한 브랜치에서 작업 후 끝나면 develop 브랜치로 PR 남기기
>
> 모든 작업 시작 전 생성한 브랜치에서 develop 브랜치의 최신 내용을 pull 받은 후 작업

## 💡 PR Rules

* Assignee에는 본인을 지정해 주세요.
* Reviewers에는 본인을 제외한 프론트엔드 팀원을 지정한 후, 카카오톡으로 공유해 주세요.
* 이후 팀원이 PR을 확인하고 승인한 뒤 merge해 주세요.
* UI 변경 사항이 있는 경우 필요한 스크린샷을 함께 첨부해 주세요.
* 해당 브랜치는 merge 후 삭제하며, 필요할 경우 복구할 수 있습니다.

## 💻 Commit Message Convention

| **Type**             | **Description**                         |
| -------------------- | --------------------------------------- |
| **Feat**             | 새로운 기능 추가                               |
| **Fix**              | 버그 수정                                   |
| **Docs**             | 문서 수정                                   |
| **Style**            | 코드 formatting, 공백 수정 등 코드 동작의 변경이 없는 경우 |
| **Refactor**         | 코드 리팩토링                                 |
| **Test**             | 테스트 코드 추가 및 수정                          |
| **Chore**            | 패키지, 설정 파일, `.gitignore` 등 기타 수정        |
| **Design**           | 사용자 UI 및 디자인 변경                         |
| **Comment**          | 필요한 주석 추가 및 변경                          |
| **Rename**           | 파일 또는 폴더명을 수정하거나 이동하는 작업                |
| **Remove**           | 파일을 삭제하는 작업                             |
| **Init**             | 프로젝트 초기 세팅                              |
| **Merge**            | 브랜치 merge                               |
| **!BREAKING CHANGE** | 기존 기능과 호환되지 않는 큰 변경                     |
| **!HOTFIX**          | 치명적인 버그를 긴급하게 수정하는 경우                   |

> Type: commit title
>
> ex. `Feat: 로그인 기능 추가`
> ex. `Design: 로그인 화면 UI 수정`
> ex. `Fix: 버튼 클릭 오류 수정`


