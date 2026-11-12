import type { DrawRun, StampEntry, StampPeriod, StampPrize, WinnerContactDetail } from '@/types';

// 시안용 예시 데이터 — '댕댕로드 추첨'(UI-O-012) 화면에서 써요.
// 숫자는 화면 모양 예시이고 실제 당첨 인원 · 확률 · 정책이 아니에요 (당첨 방식은 정하지 않음 · 명세 원본 43).

type PeriodBase = Omit<StampPeriod, 'entryCount' | 'prizeCount' | 'drawStatus' | 'publishedAt'>;

export const MOCK_PERIODS: PeriodBase[] = [
  {
    periodId: '2026Q4',
    name: '2026년 4분기 댕댕로드',
    startDate: '2026-10-01',
    endDate: '2026-12-31',
    entryDeadline: '2026-12-31T23:59:59+09:00',
    announceDate: '2027-01-01',
    phase: 'OPEN',
  },
  {
    periodId: '2026Q3',
    name: '2026년 3분기 댕댕로드',
    startDate: '2026-07-01',
    endDate: '2026-09-30',
    entryDeadline: '2026-09-30T23:59:59+09:00',
    announceDate: '2026-10-01',
    phase: 'CLOSED',
  },
  {
    periodId: '2026Q2',
    name: '2026년 2분기 댕댕로드',
    startDate: '2026-04-01',
    endDate: '2026-06-30',
    entryDeadline: '2026-06-30T23:59:59+09:00',
    announceDate: '2026-07-01',
    phase: 'CLOSED',
  },
];

export const MOCK_PRIZES: Record<string, StampPrize[]> = {
  '2026Q4': [{ prizeId: 'pz_7', name: '커피 쿠폰', brand: '[제휴사]', imageUrl: null, quantity: null }],
  '2026Q3': [
    { prizeId: 'pz_4', name: '커피 쿠폰', brand: '[제휴사]', imageUrl: null, quantity: 2 },
    { prizeId: 'pz_5', name: '반려견 간식 세트', brand: '[제휴사]', imageUrl: null, quantity: 1 },
  ],
  '2026Q2': [
    { prizeId: 'pz_1', name: '커피 쿠폰', brand: '[제휴사]', imageUrl: null, quantity: 1 },
    { prizeId: 'pz_2', name: '반려견 간식 세트', brand: '[제휴사]', imageUrl: null, quantity: 1 },
  ],
};

const entry = (entryId: string, enteredAt: string, phone: string, hasAddress: boolean, extra: Partial<StampEntry> = {}): StampEntry => ({
  entryId,
  userId: `u_${entryId.slice(3)}`,
  enteredAt,
  result: 'PENDING',
  canceled: false,
  canceledAt: null,
  contactPhoneMasked: phone,
  hasAddressSnapshot: hasAddress,
  awardedPrize: null,
  drawRunId: null,
  ...extra,
});

export const MOCK_ENTRIES: Record<string, StampEntry[]> = {
  '2026Q4': [
    entry('en_301', '2026-10-24T19:02:00+09:00', '010-****-5678', true),
    entry('en_302', '2026-10-30T10:15:00+09:00', '010-****-2231', false),
  ],
  '2026Q3': [
    entry('en_201', '2026-07-11T19:02:00+09:00', '010-****-4410', true),
    entry('en_202', '2026-07-23T10:15:00+09:00', '010-****-2231', false),
    entry('en_203', '2026-08-02T21:40:00+09:00', '010-****-9087', true),
    entry('en_204', '2026-08-14T08:31:00+09:00', '010-****-7752', true),
    entry('en_205', '2026-08-27T18:22:00+09:00', '010-****-3018', false),
    entry('en_206', '2026-09-05T17:49:00+09:00', '010-****-6624', true, { canceled: true, canceledAt: '2026-09-20T09:12:00+09:00' }),
    entry('en_207', '2026-09-11T20:13:00+09:00', '010-****-1195', false),
    entry('en_208', '2026-09-18T09:58:00+09:00', '010-****-8843', true),
    entry('en_209', '2026-09-24T15:36:00+09:00', '010-****-5502', true),
    entry('en_210', '2026-09-30T22:47:00+09:00', '010-****-0379', false),
  ],
  '2026Q2': [
    entry('en_101', '2026-04-06T11:20:00+09:00', '010-****-5678', false, { result: 'WON', awardedPrize: { prizeId: 'pz_1', name: '커피 쿠폰' }, drawRunId: 'dr_5' }),
    entry('en_102', '2026-04-19T09:42:00+09:00', '010-****-3301', true, { result: 'NOT_WON', drawRunId: 'dr_5' }),
    entry('en_103', '2026-05-02T20:11:00+09:00', '010-****-7126', true, { result: 'NOT_WON', drawRunId: 'dr_5' }),
    entry('en_104', '2026-05-15T13:05:00+09:00', '010-****-4087', false, { result: 'NOT_WON', drawRunId: 'dr_5' }),
    entry('en_105', '2026-05-21T18:30:00+09:00', '010-****-9915', true, { result: 'WON', awardedPrize: { prizeId: 'pz_2', name: '반려견 간식 세트' }, drawRunId: 'dr_5' }),
    entry('en_106', '2026-06-03T07:58:00+09:00', '010-****-2268', false, { result: 'NOT_WON', drawRunId: 'dr_5' }),
    entry('en_107', '2026-06-17T22:14:00+09:00', '010-****-6634', true, { result: 'NOT_WON', drawRunId: 'dr_5' }),
  ],
};

/** 분기별 마지막 추첨 실행 */
export const MOCK_DRAW_RUNS: Record<string, DrawRun | undefined> = {
  '2026Q2': {
    drawRunId: 'dr_5',
    periodId: '2026Q2',
    status: 'SUCCEEDED',
    requestedAt: '2026-07-01T00:04:00+09:00',
    requestedBy: { type: 'OPERATOR', operatorId: 'admin01' },
    finishedAt: '2026-07-01T00:04:30+09:00',
    eligibleCount: 7,
    wonCount: 2,
    notWonCount: 5,
    canceledDuringRunCount: 0,
    failure: null,
    publication: { publishedAt: '2026-07-01T00:10:00+09:00', notificationsQueued: 7 },
  },
};

/** 당첨 연락 조회 데이터 (가리지 않은 번호 · 배송 정보 · 연락 기록) */
export const MOCK_WINNER_DETAILS: Record<string, Omit<WinnerContactDetail, 'entryId' | 'periodId' | 'result' | 'awardedPrize'>> = {
  en_101: {
    phoneSnapshot: '010-1234-5678',
    addressSnapshot: null,
    deliveryInfo: null,
    contacts: [
      {
        contactId: 'ct_1',
        entryId: 'en_101',
        attemptedAt: '2026-07-01T10:00:00+09:00',
        channel: 'PHONE_CALL',
        outcome: 'NO_ANSWER',
        memo: '부재중, 다음 날 다시 연락',
        recordedBy: { operatorId: 'admin01' },
        recordedAt: '2026-07-01T10:03:00+09:00',
      },
      {
        contactId: 'ct_2',
        entryId: 'en_101',
        attemptedAt: '2026-07-02T11:20:00+09:00',
        channel: 'PHONE_CALL',
        outcome: 'REACHED',
        memo: '쿠폰 받을 번호 확인',
        recordedBy: { operatorId: 'admin01' },
        recordedAt: '2026-07-02T11:24:00+09:00',
      },
    ],
  },
  en_105: {
    phoneSnapshot: '010-9876-9915',
    addressSnapshot: { zip: '04790', line1: '서울 성동구 예시로 1', line2: '101호' },
    deliveryInfo: null,
    contacts: [],
  },
};
