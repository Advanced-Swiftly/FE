import SwiftUI

/// S1 [로그인] 알약 버튼 (230×50, #3A2E78, 볼록한 그림자)
struct PillButton: View {
    let title: String
    var isLoading: Bool = false
    let action: () -> Void

    @Environment(\.isEnabled) private var isEnabled

    var body: some View {
        Button(action: action) {
            ZStack {
                Text(title)
                    .font(.pawfit(PawFitType.button, .semibold))
                    .opacity(isLoading ? 0 : 1)
                if isLoading {
                    ProgressView().tint(.white)
                }
            }
            .foregroundStyle(.white)
            .frame(width: 230, height: 50)
            .background(PawFitColor.brand, in: Capsule())
            .shadow(color: Color(hex: 0x3A2E78, opacity: isEnabled ? 0.32 : 0.12), radius: 10, x: 8, y: 10)
            .shadow(color: .white, radius: 8, x: -6, y: -6)
            .opacity(isEnabled ? 1 : 0.45)
        }
        .buttonStyle(PressScaleStyle())
        .disabled(isLoading)
        .accessibilityLabel(title)
    }
}

/// 누를 때 살짝 작아지는 반응 (사용자 동작에만 쓰는 움직임)
struct PressScaleStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .scaleEffect(configuration.isPressed ? 0.97 : 1)
            .animation(.easeOut(duration: 0.12), value: configuration.isPressed)
    }
}

#Preview {
    VStack(spacing: 30) {
        PillButton(title: "로그인") {}
        PillButton(title: "로그인", isLoading: true) {}
        PillButton(title: "로그인") {}.disabled(true)
    }
    .padding(40)
    .background(PawFitColor.loginBackground)
}
