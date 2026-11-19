import type { RequestItemDto } from '@/api/requests';

// 시안용 예시 데이터 — F-WREQ-01 응답 items[] 와 같은 모양에 매장 ID(placeId)만 더했어요.
// 목업도 api/requests.ts 의 같은 변환 함수를 거쳐 화면에 가요.
export const MOCK_REQUESTS: (RequestItemDto & { placeId: string })[] = [
  { placeId: 'store-ss-0142', type: 'EVENT_AD', appKind: 'AD', applicationId: 'AD-0042', status: 'RECEIVED', group: 'IN_PROGRESS', summaryText: '지도 추천 노출 · 성수 · 11.02 – 11.15', submittedAt: '2026-10-21T15:02:00+09:00' },
  { placeId: 'store-ss-0142', type: 'CONDITION', requestId: 'REQ-0142', status: 'IN_REVIEW', group: 'IN_PROGRESS', summaryText: '견종 제한 · 제한 없음 → 도베르만 출입 제한', submittedAt: '2026-10-20T14:12:00+09:00' },
  { placeId: 'store-ss-0142', type: 'CONDITION', requestId: 'REQ-0131', status: 'NEEDS_INFO', group: 'IN_PROGRESS', summaryText: '예방접종 · 종합백신 접종 증빙 필요', submittedAt: '2026-09-27T10:02:00+09:00' },
  { placeId: 'store-ss-0142', type: 'EVENT_AD', appKind: 'EVENT', applicationId: 'EV-0019', status: 'APPROVED', group: 'DONE', summaryText: '성수 가을 스탬프 투어 참여', submittedAt: '2026-09-26T11:20:00+09:00' },
  { placeId: 'store-ss-0142', type: 'CONDITION', requestId: 'REQ-0118', status: 'APPROVED', group: 'DONE', summaryText: '준비물 · 리드줄 필수 추가', submittedAt: '2026-09-12T16:40:00+09:00' },
  { placeId: 'store-ss-0142', type: 'EVENT_AD', appKind: 'AD', applicationId: 'AD-0031', status: 'REJECTED', group: 'DONE', summaryText: '지도 추천 노출 · 서울숲', submittedAt: '2026-09-10T13:00:00+09:00' },
  { placeId: 'store-ss-0142', type: 'CONDITION', requestId: 'REQ-0104', status: 'REJECTED', group: 'DONE', summaryText: '견종 제한 · 시베리안 허스키 · 진돗개', submittedAt: '2026-08-30T09:10:00+09:00' },
];

/** 목업 평균 처리 기간(일) — 서버는 최근 90일 승인 · 반려 건으로 계산해요 */
export const MOCK_AVG_PROCESSING_DAYS = 2.5;
