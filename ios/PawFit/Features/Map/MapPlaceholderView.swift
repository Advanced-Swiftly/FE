import SwiftUI

/// UI-M-001 메인 지도 자리. 로그인 흐름 확인용이며 다음 작업에서 Google Maps 화면으로 교체한다.
struct MapPlaceholderView: View {
    @Environment(AppSession.self) private var session
    @Environment(\.appEnvironment) private var env

    var body: some View {
        VStack(spacing: 16) {
            Text("\(session.userName ?? "보호자")님, 로그인했어요")
                .font(.pawfit(PawFitType.title, .bold))
                .foregroundStyle(PawFitColor.textPrimary)
            Text("UI-M-001 메인 지도는 다음 작업에서 만들어요")
                .font(.pawfit(PawFitType.body))
                .foregroundStyle(PawFitColor.textSecondary)

            LazyVGrid(columns: [GridItem(.adaptive(minimum: 110), spacing: 8)], spacing: 8) {
                ForEach(Verdict.allCases, id: \.self) { VerdictChip(verdict: $0) }
            }
            .padding(.top, 8)

            Button("로그아웃") {
                Task {
                    await env.auth.logout()
                    session.signedOut()
                }
            }
            .font(.pawfit(PawFitType.body, .semibold))
            .foregroundStyle(PawFitColor.brand)
            .frame(minHeight: PawFitSize.minTapTarget)
            .padding(.top, 24)
        }
        .padding(16)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(PawFitColor.background)
    }
}
