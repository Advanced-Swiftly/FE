import type { DailyVisit } from '@/types';

/** 시안 기준 '오늘' — API 연동 후에는 서버 날짜를 써요. */
export const MOCK_TODAY = '2026-10-22';

// 시안 '일별 QR 인증 방문' 30일 (09.23 – 10.22)
const LAST_30 = [9, 10, 14, 26, 24, 7, 9, 11, 10, 15, 28, 25, 8, 10, 12, 11, 16, 30, 27, 9, 11, 12, 13, 17, 31, 29, 9, 12, 12, 9];

function toISO(d: Date) {
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
}

/** 오늘까지 days 일 동안의 예시 방문 수 */
export function mockDailyVisits(days: number): DailyVisit[] {
  const end = new Date(`${MOCK_TODAY}T00:00:00`);
  return Array.from({ length: days }, (_, i) => {
    const d = new Date(end);
    d.setDate(end.getDate() - (days - 1 - i));
    const fromEnd = days - 1 - i;
    let count: number;
    if (fromEnd < LAST_30.length) {
      count = LAST_30[LAST_30.length - 1 - fromEnd];
    } else {
      // 30일 이전은 요일 패턴으로 만든 값 (조금 적게)
      const weekend = d.getDay() === 0 || d.getDay() === 6;
      count = Math.round((weekend ? 22 : 8) + ((d.getDate() * 7) % 5));
    }
    return { date: toISO(d), count };
  });
}

/** 0~23시 비율 (%) — 영업시간 10~22시에 몰려 있어요 */
export const MOCK_HOUR_SHARE = [0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 8, 10, 13, 14, 12, 11, 11, 8, 5, 3, 2, 1, 1, 0];
