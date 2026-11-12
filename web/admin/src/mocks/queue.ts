import type { ApplicationReviewDto, ConditionReviewDto, QueueItemDto } from '@/api/queue';

/** 시안 기준 '오늘' — API 연동 후에는 서버 날짜를 써요. */
export const MOCK_TODAY = '2026-10-22';

// 시안용 예시 데이터 — 서버 응답(명세 F-OREV-02 · 03, F-OAPP-01)과 같은 모양이에요.
// 목업도 api/queue.ts 의 같은 변환 함수를 거쳐 화면에 가요.
// region · category · summary · evidence 는 명세 F-OREV-02 응답에 없는 값이라 [확인 필요] 예요 (화면은 없으면 빈 칸).
export const MOCK_QUEUE: QueueItemDto[] = [
  { kind: 'EVENT_APPLICATION', applicationId: 'EV-0027', placeId: 'store-sf-0087', placeName: 'AA 카페 서울숲점', status: 'RECEIVED', submittedAt: '2026-10-22T11:40:00+09:00', region: '서울숲', category: '카페', summary: '2027년 1분기 댕댕로드 참여', evidence: '조건 자동 확인 4 / 4' },
  { kind: 'AD_APPLICATION', applicationId: 'AD-0042', placeId: 'store-ss-0142', placeName: 'AA 카페 성수점', status: 'RECEIVED', submittedAt: '2026-10-21T15:02:00+09:00', region: '성수', category: '카페', summary: '지도 추천 노출 · 성수 · 11.02 – 11.15', evidence: '—' },
  { kind: 'AI_CANDIDATE', requestId: 'POL-0311', placeId: 'store-bb', placeName: 'BB 베이커리', status: 'RECEIVED', submittedAt: '2026-10-21T03:00:00+09:00', region: '건대', category: '베이커리', summary: '신규 정책 6개 항목 · 미확인 2', evidence: '공식 홈페이지' },
  { kind: 'AI_CANDIDATE', requestId: 'POL-0308', placeId: 'store-cc', placeName: 'CC 브런치', status: 'RECEIVED', submittedAt: '2026-10-21T02:00:00+09:00', region: '서울숲', category: '식당', summary: '실내 이용 조건 변경 감지', evidence: '인스타그램 게시물' },
  { kind: 'CONDITION_REQUEST', requestId: 'REQ-0142', placeId: 'store-ss-0142', placeName: 'AA 카페 성수점', status: 'IN_REVIEW', submittedAt: '2026-10-20T14:12:00+09:00', region: '성수', category: '카페', summary: '체중 제한 7kg → 10kg', evidence: '인스타그램 공지 캡처' },
  { kind: 'CONDITION_REQUEST', requestId: 'REQ-0139', placeId: 'store-dd', placeName: 'DD 펫카페', status: 'RECEIVED', submittedAt: '2026-10-19T10:00:00+09:00', region: '성수', category: '카페', summary: '입마개 필수 조건 삭제', evidence: '업체 제출 사진 2장' },
  { kind: 'AI_CANDIDATE', requestId: 'POL-0305', placeId: 'store-ee', placeName: 'EE 식당', status: 'IN_REVIEW', submittedAt: '2026-10-18T03:00:00+09:00', region: '건대', category: '식당', summary: '체중 제한 문구 모호 · ‘소형견만’', evidence: '블로그 공지' },
  { kind: 'CONDITION_REQUEST', requestId: 'REQ-0137', placeId: 'store-ff', placeName: 'FF 와인바', status: 'RECEIVED', submittedAt: '2026-10-17T16:00:00+09:00', region: '서울숲', category: '주점', summary: '동반 가능 → 야외 테라스만', evidence: '업체 제출 공지문' },
  { kind: 'CONDITION_REQUEST', requestId: 'REQ-0131', placeId: 'store-ss-0142', placeName: 'AA 카페 성수점', status: 'NEEDS_INFO', submittedAt: '2026-09-27T10:02:00+09:00', region: '성수', category: '카페', summary: '예방접종 증빙 확인 추가', evidence: '10.01 보완 요청함' },
];

export const MOCK_PROCESSED_TODAY = 5;

/** 예시 근거 이미지 (실제 파일이 아니에요) */
const SAMPLE_CAPTURE = `data:image/svg+xml;charset=utf-8,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="640" height="420"><rect width="640" height="420" fill="#f3f1ec"/><text x="320" y="200" font-size="26" text-anchor="middle" font-family="sans-serif">공지 캡처 (예시)</text><text x="320" y="240" font-size="16" fill="#888" text-anchor="middle" font-family="sans-serif">시안용 예시 이미지</text></svg>')}`;

/** F-OREV-03 응답 모양 */
export const MOCK_POLICY_REVIEWS: Record<string, ConditionReviewDto> = {
  'REQ-0142': {
    requestId: 'REQ-0142',
    kind: 'CONDITION_REQUEST',
    placeId: 'store-ss-0142',
    placeName: 'AA 카페 성수점',
    status: 'IN_REVIEW',
    submittedAt: '2026-10-20T14:12:00+09:00',
    baseChanged: false,
    allowedActions: ['APPROVE', 'REQUEST_SUPPLEMENT', 'REJECT'],
    source: { links: ['https://instagram.com/p/aacafe_notice'], files: [{ fileName: 'instagram_공지_1020.png', url: SAMPLE_CAPTURE }], collectedAt: null },
    currentConditions: { weightLimitKg: 7 },
    currentUnrestrictedFields: [],
    proposal: { weightLimitKg: { originalValue: 10, originalUnrestricted: false, value: 10, unrestricted: false, edited: false } },
    boundaryWarnings: ['‘10kg 이하’ 실내와 ‘10kg 이상’ 테라스가 겹쳐요. 정확히 10kg인 반려견의 이용 구역을 업체에 확인하세요.'],
  },
  'POL-0311': {
    requestId: 'POL-0311',
    kind: 'AI_CANDIDATE',
    placeId: 'store-bb',
    placeName: 'BB 베이커리',
    status: 'RECEIVED',
    submittedAt: '2026-10-21T03:00:00+09:00',
    baseChanged: false,
    allowedActions: ['START_REVIEW'],
    source: { links: ['https://bb-bakery.example.com/notice'], files: [], collectedAt: '2026-10-21' },
    currentConditions: { petAllowed: null, sizeLimit: null, area: null, requiredItems: null, weightLimitKg: null, vaccinationRequired: null },
    currentUnrestrictedFields: [],
    // '리드줄'은 준비물 값 목록(Item)에 없어서 AI 가 미확인으로 남겼어요 — 운영자가 원문을 보고 정해요.
    proposal: {
      petAllowed: { originalValue: true, originalUnrestricted: false, value: true, unrestricted: false, edited: false },
      sizeLimit: { originalValue: 'SMALL', originalUnrestricted: false, value: 'SMALL', unrestricted: false, edited: false },
      area: { originalValue: 'INDOOR_OK', originalUnrestricted: false, value: 'INDOOR_OK', unrestricted: false, edited: false },
      requiredItems: { originalValue: null, originalUnrestricted: false, value: null, unrestricted: false, edited: false },
      weightLimitKg: { originalValue: null, originalUnrestricted: false, value: null, unrestricted: false, edited: false },
      vaccinationRequired: { originalValue: null, originalUnrestricted: false, value: null, unrestricted: false, edited: false },
    },
    boundaryWarnings: [],
  },
  'POL-0308': {
    requestId: 'POL-0308',
    kind: 'AI_CANDIDATE',
    placeId: 'store-cc',
    placeName: 'CC 브런치',
    status: 'RECEIVED',
    submittedAt: '2026-10-21T02:00:00+09:00',
    baseChanged: false,
    allowedActions: ['START_REVIEW'],
    source: { links: ['https://instagram.com/p/cc_brunch_terrace'], files: [], collectedAt: '2026-10-21' },
    currentConditions: { area: 'INDOOR_OK' },
    currentUnrestrictedFields: [],
    proposal: { area: { originalValue: 'OUTDOOR_ONLY', originalUnrestricted: false, value: 'OUTDOOR_ONLY', unrestricted: false, edited: false } },
    boundaryWarnings: [],
  },
  'POL-0305': {
    requestId: 'POL-0305',
    kind: 'AI_CANDIDATE',
    placeId: 'store-ee',
    placeName: 'EE 식당',
    status: 'IN_REVIEW',
    submittedAt: '2026-10-18T03:00:00+09:00',
    baseChanged: false,
    allowedActions: ['EDIT_PROPOSAL', 'APPROVE', 'REJECT'],
    source: { links: ['https://blog.example.com/ee_restaurant/notice'], files: [], collectedAt: '2026-10-18' },
    currentConditions: { sizeLimit: null, weightLimitKg: null },
    currentUnrestrictedFields: [],
    // '소형견만'은 크기로만 읽었고 체중은 원문에 숫자가 없어 미확인으로 남겼어요.
    proposal: {
      sizeLimit: { originalValue: 'SMALL', originalUnrestricted: false, value: 'SMALL', unrestricted: false, edited: false },
      weightLimitKg: { originalValue: null, originalUnrestricted: false, value: null, unrestricted: false, edited: false },
    },
    boundaryWarnings: ['‘소형견만’이 크기 기준인지 체중 기준인지 원문에 없어요. 업체에 확인해 주세요.'],
  },
  'REQ-0131': {
    requestId: 'REQ-0131',
    kind: 'CONDITION_REQUEST',
    placeId: 'store-ss-0142',
    placeName: 'AA 카페 성수점',
    status: 'NEEDS_INFO',
    submittedAt: '2026-09-27T10:02:00+09:00',
    baseChanged: false,
    allowedActions: [],
    source: { links: ['https://instagram.com/p/aacafe_vaccine'], files: [], collectedAt: null },
    currentConditions: { vaccinationRequired: false },
    currentUnrestrictedFields: [],
    proposal: { vaccinationRequired: { originalValue: true, originalUnrestricted: false, value: true, unrestricted: false, edited: false } },
    boundaryWarnings: [],
  },
  'REQ-0139': {
    requestId: 'REQ-0139',
    kind: 'CONDITION_REQUEST',
    placeId: 'store-dd',
    placeName: 'DD 펫카페',
    status: 'RECEIVED',
    submittedAt: '2026-10-19T10:00:00+09:00',
    baseChanged: false,
    allowedActions: ['START_REVIEW'],
    source: { links: [], files: [{ fileName: '매장_안내판_1019.png', url: SAMPLE_CAPTURE }, { fileName: '카운터_공지_1019.png', url: SAMPLE_CAPTURE }], collectedAt: null },
    currentConditions: { requiredItems: ['MUZZLE'] },
    currentUnrestrictedFields: [],
    // 입마개 필수를 없애 달라는 요청 → 준비물 제한 없음
    proposal: { requiredItems: { originalValue: null, originalUnrestricted: true, value: null, unrestricted: true, edited: false } },
    boundaryWarnings: [],
  },
  'REQ-0137': {
    requestId: 'REQ-0137',
    kind: 'CONDITION_REQUEST',
    placeId: 'store-ff',
    placeName: 'FF 와인바',
    status: 'RECEIVED',
    submittedAt: '2026-10-17T16:00:00+09:00',
    baseChanged: false,
    allowedActions: ['START_REVIEW'],
    source: { links: [], files: [{ fileName: '매장_공지문_1017.png', url: SAMPLE_CAPTURE }], collectedAt: null },
    currentConditions: { area: 'INDOOR_OK' },
    currentUnrestrictedFields: [],
    proposal: { area: { originalValue: 'OUTDOOR_ONLY', originalUnrestricted: false, value: 'OUTDOOR_ONLY', unrestricted: false, edited: false } },
    boundaryWarnings: [],
  },
};

/** 원문 강조 — 명세 응답에 없는 값(강조 위치는 OR-14 [확인 필요])이라 목업 화면에서만 덧붙여요 */
export const MOCK_SOURCE_TEXT: Record<string, [string, boolean][]> = {
  'REQ-0142': [
    ['11월 1일부터 ', false],
    ['실내는 10kg 이하', true],
    [' 친구들까지 함께할 수 있어요. ', false],
    ['10kg 이상', true],
    [' 친구들은 테라스석을 이용해 주세요.', false],
  ],
  'POL-0311': [
    ['반려견 동반 가능해요. ', true],
    ['소형견', true],
    ['은 매장 안에서, 그 밖의 친구들은 ', false],
    ['테라스', true],
    ['를 이용해 주세요. ', false],
    ['리드줄', true],
    ['은 꼭 해 주세요.', false],
  ],
  'POL-0308': [
    ['11월부터 반려견과 함께 오시는 손님은 ', false],
    ['야외 테라스석만', true],
    [' 이용할 수 있어요.', false],
  ],
  'POL-0305': [
    ['저희 매장은 ', false],
    ['소형견만', true],
    [' 함께 들어오실 수 있어요.', false],
  ],
  'REQ-0131': [
    ['반려견과 함께 오실 때는 ', false],
    ['종합백신 접종 증명서', true],
    ['를 보여 주세요.', false],
  ],
  'REQ-0139': [
    ['이제 ', false],
    ['입마개 없이도', true],
    [' 함께 들어오실 수 있어요. 다른 친구들을 위해 리드줄은 짧게 잡아 주세요.', false],
  ],
  'REQ-0137': [
    ['반려견 동반 손님은 ', false],
    ['야외 테라스에서만', true],
    [' 이용할 수 있어요. 실내는 반려견 동반이 어려워요.', false],
  ],
};

/** F-OAPP-01 응답 모양 */
export const MOCK_APPLY_REVIEWS: Record<string, ApplicationReviewDto> = {
  'EV-0027': {
    applicationId: 'EV-0027',
    type: 'STAMP_ROAD',
    placeId: 'store-sf-0087',
    placeName: 'AA 카페 서울숲점',
    status: 'RECEIVED',
    displayStatus: 'RECEIVED',
    submittedAt: '2026-10-22T11:40:00+09:00',
    reviewStartedAt: null,
    stampRoad: {
      eventId: 'ev_2027q1',
      periodId: '2027Q1',
      title: '2027년 1분기 댕댕로드',
      regions: ['성수', '서울숲'],
      recruitment: { startAt: '2026-12-25T00:00:00+09:00', endAt: '2027-01-01T00:00:00+09:00' },
      intro: '산책 후 테라스에서 쉬어 가요. 물그릇 준비돼 있어요.',
      qrPledgeAgreed: true,
      recruitmentStatus: { applicationCount: 12, approvedCount: 7 },
    },
    checks: [
      { code: 'REGION', passed: true, detail: null },
      { code: 'BUSINESS_VERIFIED', passed: true, detail: null },
      { code: 'QR_ACTIVE', passed: true, detail: null },
      { code: 'CONDITION_CHECKED_RECENT', passed: true, detail: { checkedDate: '2026-09-29', daysSince: 23 } },
    ],
    checkedAt: '2026-10-22T11:45:00+09:00',
    eligibilityAtSubmit: [
      { code: 'REGION', passed: true },
      { code: 'BUSINESS_VERIFIED', passed: true },
      { code: 'QR_ACTIVE', passed: true },
      { code: 'CONDITION_CHECKED_RECENT', passed: true },
      { code: 'QR_PLEDGE', passed: true },
    ],
    introCheck: { length: 30, maxLength: 40, passed: true },
    allowedActions: ['START_REVIEW'],
    prevApplicationId: null,
    nextApplicationId: 'AD-0042',
  },
  'AD-0042': {
    applicationId: 'AD-0042',
    type: 'AD',
    placeId: 'store-ss-0142',
    placeName: 'AA 카페 성수점',
    status: 'RECEIVED',
    submittedAt: '2026-10-21T15:02:00+09:00',
    ad: { region: '성수', startDate: '2026-11-02', weeks: 2, endDate: '2026-11-15' },
    checks: [],
    checkedAt: null,
    allowedActions: ['APPROVE', 'REJECT'],
    prevApplicationId: 'EV-0027',
    nextApplicationId: null,
  },
};
