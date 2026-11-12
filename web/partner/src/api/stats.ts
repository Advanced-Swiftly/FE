import { MOCK_HOUR_SHARE, mockDailyVisits } from '@/mocks/stats';
import type { StatsPeriod, VisitStats, VisitSummary } from '@/types';
import { lastDays, toISODate } from '@/utils/date';
import { apiClient, mockResponse, USE_MOCK } from './client';

// ─── 업체 방문 인증 통계 (GET /business/stores/{storeId}/visit-stats) ───
interface VisitStatsDto {
  totalVisits?: number | null;
  stampAwards?: number | null;
  series?: { date: string; visits: number }[] | null;
}

const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : null);

/** 'YYYY-MM-DD' 두 날짜 사이 일수 (양 끝 포함) */
function dayCount(from: string, to: string) {
  const ms = Date.UTC(+to.slice(0, 4), +to.slice(5, 7) - 1, +to.slice(8, 10)) - Date.UTC(+from.slice(0, 4), +from.slice(5, 7) - 1, +from.slice(8, 10));
  return Math.round(ms / 86_400_000) + 1;
}

/** 같은 길이의 직전 기간 */
function previousRange(from: string, to: string) {
  const days = dayCount(from, to);
  const end = new Date(Date.UTC(+from.slice(0, 4), +from.slice(5, 7) - 1, +from.slice(8, 10) - 1));
  const start = new Date(end.getTime() - (days - 1) * 86_400_000);
  return { from: start.toISOString().slice(0, 10), to: end.toISOString().slice(0, 10) };
}

export async function fetchVisitStats(storeId: string, from: string, to: string): Promise<VisitStatsDto> {
  const { data } = await apiClient.get<VisitStatsDto>(`/business/stores/${encodeURIComponent(storeId)}/visit-stats`, { params: { from, to, groupBy: 'DAY' } });
  return data ?? {};
}

function toSummary(d: VisitStatsDto, from: string, to: string): VisitSummary {
  const total = num(d.totalVisits);
  return {
    qrVisitCount: total,
    // 인증한 보호자 수는 이 API 에 없어요
    guardianCount: null,
    dailyAverage: total === null ? null : Math.round((total / Math.max(1, dayCount(from, to))) * 10) / 10,
    stampCount: num(d.stampAwards),
  };
}

/** 7 · 30 · 90일이면 오늘 포함 기간을, 직접 설정이면 그대로 from · to 로 바꿔요 */
export function periodRange(period: StatsPeriod | { from: string; to: string }) {
  return typeof period === 'string' ? lastDays(Number(period)) : period;
}

/** F-WSTAT-01 기간별 QR 인증 통계. 서버에는 from · to 만 보내요. */
export async function getVisitStats(storeId: string, period: StatsPeriod | { from: string; to: string }): Promise<VisitStats> {
  const { from, to } = periodRange(period);
  if (USE_MOCK) return mockResponse(mockStats(from, to));
  // 직전 기간은 같은 API 를 직전 날짜로 한 번 더 불러 비교해요 (실패하면 비교만 빼요)
  const prev = previousRange(from, to);
  const [cur, before] = await Promise.all([fetchVisitStats(storeId, from, to), fetchVisitStats(storeId, prev.from, prev.to).catch(() => null)]);
  return {
    from,
    to,
    daily: (cur.series ?? []).map((x) => ({ date: x.date, count: x.visits })),
    summary: toSummary(cur, from, to),
    previous: before ? { ...toSummary(before, prev.from, prev.to), ...prev } : null,
    // 시간대별 방문은 이 API 에 없어요
    byHour: null,
  };
}

function mockStats(from: string, to: string): VisitStats {
  const daily = mockDailyVisits(120).filter((d) => d.date >= from && d.date <= to);
  const total = daily.reduce((sum, d) => sum + d.count, 0);
  const days = Math.max(1, daily.length);
  const summary = { qrVisitCount: total, guardianCount: Math.round(total * 0.835), dailyAverage: Math.round((total / days) * 10) / 10, stampCount: Math.round(total * 0.58) };
  // 직전 기간은 예시로 15% 적게 만들어요.
  const prevTotal = Math.round(total / 1.18);
  const prevTo = new Date(`${from}T00:00:00`);
  prevTo.setDate(prevTo.getDate() - 1);
  const prevFrom = new Date(prevTo);
  prevFrom.setDate(prevFrom.getDate() - (days - 1));
  return {
    from,
    to,
    daily,
    summary,
    previous: {
      from: toISODate(prevFrom),
      to: toISODate(prevTo),
      qrVisitCount: prevTotal,
      guardianCount: Math.round(prevTotal * 0.82),
      dailyAverage: Math.round((prevTotal / days) * 10) / 10,
      stampCount: Math.round(prevTotal * 0.6),
    },
    byHour: MOCK_HOUR_SHARE.map((share, hour) => ({ hour, count: Math.round((total * share) / 100) })),
  };
}
