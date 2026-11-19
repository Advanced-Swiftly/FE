import SwiftUI

/// 모서리 · 간격 · 그림자 토큰
enum PawFitRadius {
    static let sheet: CGFloat = 28        // 바텀 시트 위쪽 모서리, 업체 상세 시트
    static let loginField: CGFloat = 16   // S1 눌려 들어간 입력칸
    static let field: CGFloat = 14        // 회원가입 등 기본 흰 입력칸
}

enum PawFitSize {
    static let loginField: CGFloat = 53
    static let field: CGFloat = 52
    static let minTapTarget: CGFloat = 44
}

extension View {
    /// 기본 떠 있는 그림자: 넓고 옅게 (0 4 20 rgba(45,45,45,0.08))
    func pawfitFloatingShadow() -> some View {
        shadow(color: Color(hex: 0x2D2D2D, opacity: 0.08), radius: 10, x: 0, y: 4)
    }
}
// 참고: CSS blur 20px ≈ SwiftUI radius 10 (SwiftUI radius는 대략 CSS blur의 절반).
