import type { DashboardSummary, Store } from '@/types';

// 시안용 예시 데이터 — API 연동 후에는 쓰지 않아요.
export const MOCK_STORES: Store[] = [
  { id: 'store-ss-0142', name: 'AA 카페 성수점', area: '성수', category: '카페', verification: 'APPROVED', qrId: 'PF-SS-0142' },
  { id: 'store-sf-0087', name: 'AA 카페 서울숲점', area: '서울숲', category: '카페', verification: 'APPROVED', qrId: 'PF-SF-0087' },
  { id: 'store-kd-0203', name: 'AA 베이커리 건대점', area: '건대', category: '베이커리', verification: 'PENDING' },
];

/** F-WDASH-02 대시보드 요약 예시 (진행 중 요청 수는 API 목업이 요청 목록에서 다시 세요) */
export const MOCK_DASHBOARD: Record<string, DashboardSummary> = {
  'store-ss-0142': { placeId: 'store-ss-0142', qrVisitCount: 372, stampCount: 214, inProgressRequestCount: 3, conditionCheckedAt: '2026-09-15' },
  'store-sf-0087': { placeId: 'store-sf-0087', qrVisitCount: 158, stampCount: 87, inProgressRequestCount: 1, conditionCheckedAt: '2026-08-11' },
};
