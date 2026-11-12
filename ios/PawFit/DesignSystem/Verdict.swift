import SwiftUI

/// 입장 판정 4단계. 서버 값을 그대로 받는다 — 백엔드 `PlaceService.Verdict`
/// (기능 명세서의 UNKNOWN · NO_ENTRY는 서버 이름 CHECK_REQUIRED · ENTRY_DENIED로 바뀜, 11-12)
/// 판정은 서버에서만 계산하고(QUR-001), 앱은 표시만 한다.
/// 상태는 항상 색 + 모양(✓ ! ✕ ?) + 글자를 함께 보여 준다(색만으로 구분하지 않음).
enum Verdict: String, Codable, CaseIterable, Sendable {
    case entryOK = "ENTRY_OK"   // 입장 가능
    case prepare = "PREPARE"    // 준비 필요
    case noEntry = "ENTRY_DENIED"   // 입장 불가
    case unknown = "CHECK_REQUIRED" // 조건 확인 필요

    /// 화면에 쓰는 이름 (용어 통일: 회색은 반드시 '조건 확인 필요')
    var title: String {
        switch self {
        case .entryOK: "입장 가능"
        case .prepare: "준비 필요"
        case .noEntry: "입장 불가"
        case .unknown: "조건 확인 필요"
        }
    }

    /// 모양 아이콘(SF Symbols). 디자인은 Tabler outline 1.75 기준.
    var symbol: String {
        switch self {
        case .entryOK: "checkmark"
        case .prepare: "exclamationmark"
        case .noEntry: "xmark"
        case .unknown: "questionmark"
        }
    }

    /// 칩·핀·판정 띠 아이콘 원 채움색
    var fill: Color {
        switch self {
        case .entryOK: Color(hex: 0x599D7E)
        case .prepare: Color(hex: 0xB9774F)
        case .noEntry: Color(hex: 0xD93A3F)
        case .unknown: Color(hex: 0x8E8E93)
        }
    }

    /// 15pt 안팎 글자색. 입장 불가는 대비 때문에 진한 빨강(#C2272D)을 글자에만 쓴다(10-27 확정).
    var text: Color {
        switch self {
        case .entryOK: Color(hex: 0x3F7A60)
        case .prepare: Color(hex: 0x9C5F3D)
        case .noEntry: Color(hex: 0xC2272D)
        case .unknown: Color(hex: 0x76767B)
        }
    }

    /// 업체 상세 판정 띠 · 카드 배경
    var background: Color {
        switch self {
        case .entryOK: Color(hex: 0xEAF3EE)
        case .prepare: Color(hex: 0xF7EEE8)
        case .noEntry: Color(hex: 0xFBEBEB)
        case .unknown: PawFitColor.surfaceNeutral
        }
    }

    /// 함께 가요 합치기 순서: 빨강 > 회색 > 노랑 > 초록 (값이 클수록 나쁨)
    /// 실제 합치기는 서버가 하지만, 목업·미리보기에서 같은 규칙을 쓰려고 둔다.
    var severity: Int {
        switch self {
        case .noEntry: 3
        case .unknown: 2
        case .prepare: 1
        case .entryOK: 0
        }
    }

    static func worst(of verdicts: [Verdict]) -> Verdict {
        verdicts.max(by: { $0.severity < $1.severity }) ?? .unknown
    }
}

/// 판정 칩: 색 원 + 흰 모양 아이콘 + 이름 (캡슐)
struct VerdictChip: View {
    let verdict: Verdict

    var body: some View {
        HStack(spacing: 6) {
            Image(systemName: verdict.symbol)
                .font(.system(size: 9, weight: .bold))
                .foregroundStyle(.white)
                .frame(width: 16, height: 16)
                .background(verdict.fill, in: Circle())
            Text(verdict.title)
                .font(.pawfit(13, .semibold))
                .foregroundStyle(verdict.text)
        }
        .padding(.leading, 6)
        .padding(.trailing, 10)
        .frame(height: 26)
        .background(PawFitColor.background, in: Capsule())
        .overlay(Capsule().stroke(PawFitColor.separator, lineWidth: 0.5))
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(verdict.title)
    }
}

#Preview("판정 칩") {
    VStack(alignment: .leading, spacing: 12) {
        ForEach(Verdict.allCases, id: \.self) { VerdictChip(verdict: $0) }
    }
    .padding()
}
