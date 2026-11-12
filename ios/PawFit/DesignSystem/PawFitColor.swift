import SwiftUI

/// PawFit 색 토큰 — 기준: pawfit/디자인방향.md (2026-10-23)
///
/// 원칙
/// - 판정 4색(`Verdict`)은 판정 전용. 브랜드·버튼·입력칸 등 다른 요소에 쓰지 않는다. (예외: 로고)
/// - 오류 표시는 로즈(`error*`). 판정 빨강(`noEntryFill`)은 오류에 쓰지 않는다.
/// - `textTertiary`(#8E8E93)는 대비 3.3이라 플레이스홀더·비활성 탭에만 쓴다.
enum PawFitColor {
    // MARK: 바탕
    static let background      = Color(hex: 0xFBFBFC)   // 시트, 떠 있는 버튼, 탭바
    static let loginBackground = Color(hex: 0xF8F8FB)   // S0 시작 · S1 로그인만
    static let surfaceNeutral  = Color(hex: 0xF2F2F7)   // 메뉴 선택 항목, 썸네일 배경, 토글 트랙
    static let separator       = Color(hex: 0xE5E5EA)   // 구분선 0.5pt

    // MARK: 브랜드
    static let brand     = Color(hex: 0x3A2E78)         // 네이비-퍼플: 선택 칩, 활성 탭, 주요 버튼, 내 위치 마커
    static let brandTint = Color(hex: 0xEEECF6)         // 선택 배경, 함께 가요 아이콘 배경
    static let dogNoPhoto = Color(hex: 0x8A7FB8)        // 사진 없는 반려견 원

    // MARK: 글자
    static let textPrimary     = Color(hex: 0x2D2D2D)
    static let textSecondary   = Color(hex: 0x76767B)   // 본문 크기 보조 글자
    static let textTertiary    = Color(hex: 0x8E8E93)   // 플레이스홀더 · 비활성 탭 전용
    static let iconGray        = Color(hex: 0x636366)   // 아이콘, 카드 설명 글자
    static let loginPlaceholder = Color(hex: 0x6B6B70)  // S1 입력칸 이름(플레이스홀더)

    // MARK: 오류(로즈)
    static let errorBorder = Color(hex: 0xB0325C)       // 테두리 · 아이콘
    static let errorText   = Color(hex: 0x8C1F45)       // 오류 문구

    // MARK: 로그인 뉴모피즘 그림자
    static let insetShadowDark  = Color(hex: 0xDCDFE6)
    static let insetShadowLight = Color.white
}

extension Color {
    /// 0xRRGGBB 정수로 색을 만든다. 예: `Color(hex: 0x3A2E78)`
    init(hex: UInt32, opacity: Double = 1) {
        self.init(
            .sRGB,
            red: Double((hex >> 16) & 0xFF) / 255,
            green: Double((hex >> 8) & 0xFF) / 255,
            blue: Double(hex & 0xFF) / 255,
            opacity: opacity
        )
    }
}
