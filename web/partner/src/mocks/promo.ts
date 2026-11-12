import type { ApplicationDto, EventBaseDto, EventStatsDto } from '@/api/promo';

/**
 * 광고 · 이벤트 시안이 쓰는 '지금 시각'.
 * 모집은 분기 시작 7일 전부터라서, 모집 중인 행사를 보여 주려고 12월 말로 두었어요. API 연동 후에는 서버 serverTime 을 써요.
 */
export const MOCK_EVENT_NOW = '2026-12-28T10:00:00+09:00';

// 시안용 예시 데이터 — 분기 댕댕로드 행사 (명세 F-WAD-02 응답에서 매장마다 다른 값을 뺀 공통 부분).
// 매장별 값(myApplication · canApply 등)과 F-WAD-01 목록은 api/promo.ts 목업이 이 매장의 신청 내역으로 계산해요.
export const MOCK_EVENTS: EventBaseDto[] = [
  {
    eventId: 'ev_2027q1',
    periodId: '2027Q1',
    title: '2027년 1분기 댕댕로드',
    phase: 'RECRUITING',
    period: { startDate: '2027-01-01', endDate: '2027-03-31' },
    recruitment: { startAt: '2026-12-25T00:00:00+09:00', endAt: '2027-01-01T00:00:00+09:00' },
    regions: ['성수', '서울숲'],
    description: '분기 동안 PawFit 매장 QR 인증으로 스탬프를 모아요. 참여 매장은 이벤트 통계로 매장의 스탬프 적립 수를 볼 수 있어요.',
    conditions: ['REGION', 'BUSINESS_VERIFIED', 'QR_ACTIVE', 'QR_PLEDGE', 'CONDITION_CHECKED_RECENT'],
  },
  {
    eventId: 'ev_2026q4',
    periodId: '2026Q4',
    title: '2026년 4분기 댕댕로드',
    phase: 'IN_PROGRESS',
    period: { startDate: '2026-10-01', endDate: '2026-12-31' },
    recruitment: { startAt: '2026-09-24T00:00:00+09:00', endAt: '2026-10-01T00:00:00+09:00' },
    regions: ['성수'],
    description: '성수동 반려견 동반 가능 매장에서 QR 인증으로 스탬프를 모아요.',
    conditions: ['REGION', 'BUSINESS_VERIFIED', 'QR_ACTIVE', 'QR_PLEDGE', 'CONDITION_CHECKED_RECENT'],
  },
  {
    eventId: 'ev_2026q3',
    periodId: '2026Q3',
    title: '2026년 3분기 댕댕로드',
    phase: 'ENDED',
    period: { startDate: '2026-07-01', endDate: '2026-09-30' },
    recruitment: { startAt: '2026-06-24T00:00:00+09:00', endAt: '2026-07-01T00:00:00+09:00' },
    regions: ['성수', '건대'],
    description: null,
    conditions: ['REGION', 'BUSINESS_VERIFIED', 'QR_ACTIVE', 'QR_PLEDGE', 'CONDITION_CHECKED_RECENT'],
  },
];

/** F-WAD-06 응답 모양 */
export const MOCK_APPLICATIONS: ApplicationDto[] = [
  {
    applicationId: 'AD-0042',
    type: 'AD',
    placeId: 'store-ss-0142',
    placeName: 'AA 카페 성수점',
    status: 'RECEIVED',
    submittedAt: '2026-10-21T15:02:00+09:00',
    ad: { region: '성수', startDate: '2026-11-02', weeks: 2, endDate: '2026-11-15' },
    history: [{ at: '2026-10-21T15:02:00+09:00', status: 'RECEIVED', by: 'BUSINESS' }],
    rejectReason: null,
    canCancel: true,
    canEditPeriod: true,
  },
  {
    applicationId: 'EV-0019',
    type: 'STAMP_ROAD',
    placeId: 'store-ss-0142',
    placeName: 'AA 카페 성수점',
    status: 'APPROVED',
    displayStatus: 'APPROVED',
    submittedAt: '2026-09-26T11:20:00+09:00',
    stampRoad: {
      eventId: 'ev_2026q4',
      periodId: '2026Q4',
      title: '2026년 4분기 댕댕로드',
      period: { startDate: '2026-10-01', endDate: '2026-12-31' },
      recruitment: { startAt: '2026-09-24T00:00:00+09:00', endAt: '2026-10-01T00:00:00+09:00' },
      intro: '산책 중 잠깐 쉬어 가요. 물그릇 준비돼 있어요.',
      qrPledgeAgreed: true,
      eligibilityAtSubmit: [
        { code: 'REGION', passed: true },
        { code: 'BUSINESS_VERIFIED', passed: true },
        { code: 'QR_ACTIVE', passed: true },
        { code: 'CONDITION_CHECKED_RECENT', passed: true },
        { code: 'QR_PLEDGE', passed: true },
      ],
      participation: { participationId: 'pt_3', approvedAt: '2026-09-30T15:00:00+09:00' },
    },
    history: [
      { at: '2026-09-26T11:20:00+09:00', status: 'RECEIVED', by: 'BUSINESS' },
      { at: '2026-09-28T10:00:00+09:00', status: 'IN_REVIEW', by: 'OPERATOR' },
      { at: '2026-09-30T15:00:00+09:00', status: 'APPROVED', by: 'OPERATOR' },
    ],
    rejectReason: null,
    canCancel: false,
    canEditPeriod: false,
    canReapply: false,
  },
  {
    applicationId: 'AD-0031',
    type: 'AD',
    placeId: 'store-ss-0142',
    placeName: 'AA 카페 성수점',
    status: 'REJECTED',
    submittedAt: '2026-09-10T13:00:00+09:00',
    ad: { region: '서울숲', startDate: '2026-09-14', weeks: 2, endDate: '2026-09-27' },
    history: [
      { at: '2026-09-10T13:00:00+09:00', status: 'RECEIVED', by: 'BUSINESS' },
      { at: '2026-09-11T10:40:00+09:00', status: 'REJECTED', by: 'OPERATOR' },
    ],
    rejectReason: '신청한 매장(AA 카페 성수점)이 서울숲 노출 지역 밖에 있어요. 매장이 있는 성수 지역으로 다시 신청해 주세요.',
    canCancel: false,
    canEditPeriod: false,
  },
];

/** F-WAD-09 응답에서 placeId · selectedMonth 를 뺀 공통 부분 */
export const MOCK_EVENT_STATS: Record<string, EventStatsDto> = {
  ev_2026q4: {
    eventId: 'ev_2026q4',
    periodId: '2026Q4',
    phase: 'IN_PROGRESS',
    months: [
      { month: '2026-10', state: 'CLOSED', stampCount: 212, completionCount: 18, aggregatedUntil: '2026-11-01T00:00:00+09:00' },
      { month: '2026-11', state: 'CLOSED', stampCount: 236, completionCount: 24, aggregatedUntil: '2026-12-01T00:00:00+09:00' },
      { month: '2026-12', state: 'IN_PROGRESS', stampCount: 198, completionCount: 21, aggregatedUntil: '2026-12-28T10:00:00+09:00' },
    ],
  },
};

// 같은 숫자 ID 1502 의 이벤트 · 광고 신청 (종류로 구분하는지 확인용)
{
  const ad = MOCK_APPLICATIONS.find((a) => a.type === 'AD');
  const ev = MOCK_APPLICATIONS.find((a) => a.type === 'STAMP_ROAD');
  // 요청 목록(mocks/requests.ts)의 1502 두 줄과 접수 시각 · 이력을 맞춰요
  const adAt = '2026-11-10T10:05:00+09:00';
  const evAt = '2026-11-10T10:00:00+09:00';
  if (ad) MOCK_APPLICATIONS.push({ ...structuredClone(ad), applicationId: '1502', status: 'RECEIVED', submittedAt: adAt, history: [{ at: adAt, status: 'RECEIVED', by: 'BUSINESS' }], canCancel: true });
  if (ev) MOCK_APPLICATIONS.push({ ...structuredClone(ev), applicationId: '1502', status: 'RECEIVED', displayStatus: 'RECEIVED', submittedAt: evAt, history: [{ at: evAt, status: 'RECEIVED', by: 'BUSINESS' }], canCancel: true });
}
