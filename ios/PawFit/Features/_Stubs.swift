import SwiftUI
// 임시: 다음 커밋에서 실제 화면으로 바뀜
struct ChatView: View { let openMapPlace: (String) -> Void; var body: some View { Text("챗봇") } }
struct MyView: View { let selectTab: (MainTabView.Tab) -> Void; var body: some View { Text("마이") } }
struct MyDogsView: View { var body: some View { Text("내 반려견") } }
struct DogRegistrationFlow: View { let onFinish: () -> Void; var body: some View { Text("등록") } }
