import type { PlaceAccountDto, PlaceConditionsDto, PlaceDetailDto, PlaceHistoryDto, PlaceListItemDto } from '@/api/stores';

// 시안용 예시 데이터 — 서버 응답(명세 F-OPLACE-01 · 04 · 08 · 09 · 11)과 같은 모양이에요.
// 목업도 api/stores.ts 의 같은 변환 함수를 거쳐 화면에 가요.

export const MOCK_PLACES: PlaceListItemDto[] = [
  { placeId: 'store-ff', name: 'FF 와인바', category: 'RESTAURANT', region: '서울숲', source: 'ONLINE', conditionCheckedAt: '2026-08-29', stale: true, qrVisitCount: 38, recheckRequested: false, hidden: false },
  { placeId: 'store-gg', name: 'GG 펫살롱 카페', category: 'CAFE', region: '건대', source: 'ONLINE', conditionCheckedAt: '2026-09-04', stale: true, qrVisitCount: 0, recheckRequested: false, hidden: false },
  { placeId: 'store-hh', name: 'HH 베이글', category: 'CAFE', region: '성수', source: 'UNKNOWN', conditionCheckedAt: null, stale: false, qrVisitCount: 0, recheckRequested: false, hidden: false },
  { placeId: 'store-ee', name: 'EE 식당', category: 'RESTAURANT', region: '건대', source: 'ONLINE', conditionCheckedAt: '2026-09-30', stale: false, qrVisitCount: 51, recheckRequested: false, hidden: false },
  { placeId: 'store-ss-0142', name: 'AA 카페 성수점', category: 'CAFE', region: '성수', source: 'DIRECT', conditionCheckedAt: '2026-10-08', stale: false, qrVisitCount: 466, recheckRequested: false, hidden: false },
  { placeId: 'store-dd', name: 'DD 펫카페', category: 'CAFE', region: '성수', source: 'DIRECT', conditionCheckedAt: '2026-10-12', stale: false, qrVisitCount: 212, recheckRequested: false, hidden: false },
  { placeId: 'store-cc', name: 'CC 브런치', category: 'RESTAURANT', region: '서울숲', source: 'ONLINE', conditionCheckedAt: '2026-10-15', stale: false, qrVisitCount: 97, recheckRequested: false, hidden: false },
  { placeId: 'store-bb', name: 'BB 베이커리', category: 'CAFE', region: '건대', source: 'UNKNOWN', conditionCheckedAt: null, stale: false, qrVisitCount: 0, recheckRequested: false, hidden: false },
  { placeId: 'store-sf-0087', name: 'AA 카페 서울숲점', category: 'CAFE', region: '서울숲', source: 'DIRECT', conditionCheckedAt: '2026-09-29', stale: false, qrVisitCount: 212, recheckRequested: false, hidden: false },
];

/** 정보 근거 비율 — 목록에 없는 업체까지 센 전체 수 (예시) */
export const MOCK_SOURCE_RATIO = [
  { source: 'ONLINE', count: 15 },
  { source: 'DIRECT', count: 10 },
  { source: 'UNKNOWN', count: 10 },
];

export const MOCK_PLACE_DETAILS: Record<string, PlaceDetailDto> = {
  'store-ss-0142': {
    placeId: 'store-ss-0142',
    name: 'AA 카페 성수점',
    category: 'CAFE',
    region: '성수',
    source: 'DIRECT',
    chips: { certification: 'APPROVED', checkMethod: '전화 확인', eventParticipation: '2026Q4 참여 중', hidden: false },
    summary: { conditionCheckedAt: '2026-10-08', qrVisitCount: 466, openRequestCount: 2, inquiryCount: 2 },
    info: { address: '서울 성동구 [상세 주소]', phone: '02-000-0000', channels: ['https://instagram.com/aacafe'] },
    memo: { text: '주말 오후 테라스 혼잡. 체중 기준 경계값(10kg) 업체 확인 필요.', updatedAt: '2026-10-21T15:00:00+09:00', updatedBy: '운영팀' },
  },
};

export const MOCK_PLACE_CONDITIONS: Record<string, PlaceConditionsDto> = {
  'store-ss-0142': {
    placeId: 'store-ss-0142',
    conditions: { petAllowed: true, weightLimitKg: 7, sizeLimit: null, restrictedBreeds: null, area: 'INDOOR_OK', requiredItems: ['STROLLER', 'MANNER_BELT'], vaccinationRequired: null },
    unrestrictedFields: ['sizeLimit', 'restrictedBreeds'],
    source: '업체 전화 확인',
    sourceUrl: null,
    checkedAt: '2026-10-08',
    conditionsVersion: 7,
    pendingRequests: [{ requestId: 'REQ-0142', status: 'IN_REVIEW' }],
  },
};

export const MOCK_PLACE_HISTORY: Record<string, PlaceHistoryDto[]> = {
  'store-ss-0142': [
    { historyId: 'h_6', type: 'CONDITION_REQUEST', at: '2026-10-20T14:12:00+09:00', actor: null, result: 'IN_REVIEW', changes: '체중 제한 7kg → 10kg 요청', requestId: 'REQ-0142' },
    { historyId: 'h_5', type: 'DIRECT_EDIT', at: '2026-10-08T11:00:00+09:00', actor: { operatorId: 'u_900', name: '운영팀' }, result: 'CHECKED', changes: '확인일 갱신 · 업체 전화 확인', requestId: null },
    { historyId: 'h_4', type: 'APPLICATION', at: '2026-09-30T15:00:00+09:00', actor: { operatorId: 'u_900', name: '운영팀' }, result: 'APPROVED', changes: '댕댕로드 2026Q4 참여 승인', requestId: 'EV-0019' },
    { historyId: 'h_3', type: 'CONDITION_REQUEST', at: '2026-10-01T10:00:00+09:00', actor: { operatorId: 'u_900', name: '운영팀' }, result: 'NEEDS_INFO', changes: '예방접종 조건 추가 요청 · 근거에 적용 날짜 없음', requestId: 'REQ-0131' },
    { historyId: 'h_2', type: 'CONDITION_REQUEST', at: '2026-09-15T09:00:00+09:00', actor: { operatorId: 'u_900', name: '운영팀' }, result: 'APPROVED', changes: '매너벨트 필수 추가', requestId: 'REQ-0118' },
    { historyId: 'h_1', type: 'VERIFICATION', at: '2026-08-12T10:00:00+09:00', actor: { operatorId: 'u_900', name: '운영팀' }, result: 'APPROVED', changes: '업체 인증 승인 · 매장 QR 발급', requestId: null },
  ],
};

export const MOCK_PLACE_ACCOUNTS: Record<string, PlaceAccountDto> = {
  'store-ss-0142': {
    placeId: 'store-ss-0142',
    account: {
      loginId: 'owner@aacafe.kr',
      managerName: '[담당자 이름]',
      lastLoginAt: '2026-10-22T09:31:00+09:00',
      linkedPlaces: [
        { placeId: 'store-ss-0142', name: 'AA 카페 성수점' },
        { placeId: 'store-sf-0087', name: 'AA 카페 서울숲점' },
      ],
      withdrawn: false,
    },
    qr: { qrId: 'PF-SS-0142', issuedAt: '2026-08-12', status: 'ACTIVE' },
  },
};
