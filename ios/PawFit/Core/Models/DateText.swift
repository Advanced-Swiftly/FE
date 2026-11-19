import Foundation

/// 서버 날짜는 문자열로 받고 화면에 쓸 때 바꾼다.
/// - 날짜만: "2026-10-27" (LocalDate)
/// - 시각: "2026-11-12T02:05:59.315582601Z" (Instant, 소수 초 9자리까지) · "+09:00" (OffsetDateTime)
enum DateText {
    private static let dayFormatter: DateFormatter = {
        let f = DateFormatter()
        f.calendar = Calendar(identifier: .gregorian)
        f.locale = Locale(identifier: "en_US_POSIX")
        f.timeZone = TimeZone(identifier: "Asia/Seoul")
        f.dateFormat = "yyyy-MM-dd"
        return f
    }()

    static func day(_ text: String) -> Date? {
        dayFormatter.date(from: String(text.prefix(10)))
    }

    static func dayString(_ date: Date) -> String {
        dayFormatter.string(from: date)
    }

    /// ISO 8601 시각. 소수 초 자릿수가 달라도 읽는다.
    static func instant(_ text: String) -> Date? {
        let plain = ISO8601DateFormatter()
        if let d = plain.date(from: text) { return d }
        // 소수 초를 3자리로 잘라 다시 시도
        let trimmed = text.replacingOccurrences(
            of: #"(\.\d{3})\d+"#, with: "$1", options: .regularExpression)
        let frac = ISO8601DateFormatter()
        frac.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return frac.date(from: trimmed)
    }

    /// "10월 12일"
    static func monthDay(_ text: String?) -> String? {
        guard let text, let d = day(text) ?? instant(text) else { return nil }
        let c = Calendar.current.dateComponents(in: TimeZone(identifier: "Asia/Seoul")!, from: d)
        return "\(c.month ?? 0)월 \(c.day ?? 0)일"
    }

    /// "2026.09.10"
    static func dotted(_ text: String?) -> String? {
        guard let text, let d = day(text) ?? instant(text) else { return nil }
        let c = Calendar.current.dateComponents(in: TimeZone(identifier: "Asia/Seoul")!, from: d)
        return String(format: "%04d.%02d.%02d", c.year ?? 0, c.month ?? 0, c.day ?? 0)
    }

    /// "2026.09.10" 또는 "20260910" → "2026-09-10"
    static func fromDotted(_ text: String) -> String? {
        let digits = text.filter(\.isNumber)
        guard digits.count == 8 else { return nil }
        let s = "\(digits.prefix(4))-\(digits.dropFirst(4).prefix(2))-\(digits.suffix(2))"
        return day(s) == nil ? nil : s
    }

    /// 오늘부터 남은 날 (마감일 포함 계산 X)
    static func daysLeft(until text: String?) -> Int? {
        guard let text, let d = day(text) else { return nil }
        return Calendar.current.dateComponents([.day], from: Calendar.current.startOfDay(for: .now), to: d).day
    }
}
