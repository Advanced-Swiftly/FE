import SwiftUI

/// 글꼴 토큰 — Pretendard 3가지 굵기만 넣었다.
/// 굵기 체계: 주요 제목 Bold(700) / 서브 제목·버튼 Semibold(600) / 본문 Regular(400). 시트 안 제목은 Semibold.
enum PawFitWeight {
    case regular, semibold, bold

    var postScriptName: String {
        switch self {
        case .regular: "Pretendard-Regular"
        case .semibold: "Pretendard-SemiBold"
        case .bold: "Pretendard-Bold"
        }
    }
}

extension Font {
    /// 예: `.font(.pawfit(15))`, `.font(.pawfit(17, .semibold))`
    /// `relativeTo`로 다이내믹 타입(글자 크기 설정)을 따라간다.
    static func pawfit(_ size: CGFloat, _ weight: PawFitWeight = .regular, relativeTo style: Font.TextStyle = .body) -> Font {
        .custom(weight.postScriptName, size: size, relativeTo: style)
    }
}

/// 자주 쓰는 글자 크기. 캔버스 기준값(pt).
enum PawFitType {
    static let display: CGFloat = 40      // S1 "PawFit"
    static let title: CGFloat = 22        // 화면 주요 제목
    static let button: CGFloat = 17       // 주요 버튼
    static let body: CGFloat = 15         // 본문 · 입력칸 라벨
    static let input: CGFloat = 16        // 로그인 입력칸 글자
    static let caption: CGFloat = 13
}
