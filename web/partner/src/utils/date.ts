import { USE_MOCK } from '@/api/client';
import { MOCK_TODAY } from '@/mocks/stats';

/** Date → 'YYYY-MM-DD' (브라우저 시간 = 한국 시간 기준) */
export function toISODate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * 오늘 날짜 'YYYY-MM-DD'. 예시 모드에서는 시안 날짜를 써요.
 * TODO: 서버 시간(serverTime)을 받는 API가 생기면 그 값을 기준으로.
 */
export function todayISO(): string {
  return USE_MOCK ? MOCK_TODAY : toISODate(new Date());
}

/** 오늘 포함 최근 days 일의 from · to (명세 F-WSTAT-01: 7 · 30 · 90일은 오늘 포함) */
export function lastDays(days: number, today = todayISO()): { from: string; to: string } {
  const end = new Date(`${today}T00:00:00`);
  const start = new Date(end);
  start.setDate(end.getDate() - (days - 1));
  return { from: toISODate(start), to: today };
}
