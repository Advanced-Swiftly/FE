import SwiftUI

/// UI-S-002 약관 동의(1/3) 자리. 다음 작업에서 캔버스 S2로 교체한다.
struct SignUpPlaceholderView: View {
    var body: some View {
        VStack(spacing: 12) {
            Text("약관 동의")
                .font(.pawfit(PawFitType.title, .bold))
                .foregroundStyle(PawFitColor.textPrimary)
            Text("UI-S-002 화면은 다음 작업에서 만들어요")
                .font(.pawfit(PawFitType.body))
                .foregroundStyle(PawFitColor.textSecondary)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(PawFitColor.background)
        .navigationTitle("회원가입")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar(.visible, for: .navigationBar)
    }
}
