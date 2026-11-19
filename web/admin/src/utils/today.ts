import { USE_MOCK } from '@/api/client';
import { MOCK_TODAY } from '@/mocks/queue';

/**
 * 경과일 · 승인일 안내에 쓰는 '오늘'.
 * 서버 모드는 지금 시각(날짜 계산은 utils/format 이 한국 시간으로 해요), 예시 모드만 예시 데이터에 맞춘 날짜를 써요.
 */
export function appToday(): Date {
  return USE_MOCK ? new Date(`${MOCK_TODAY}T12:00:00+09:00`) : new Date();
}
