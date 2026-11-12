import type { ConditionRequestDetailDto } from '@/api/requests';

/** 예시 근거 이미지 (실제 파일이 아니에요 · 서버는 짧게 유효한 주소를 줘요) */
const SAMPLE_FILE = `data:image/svg+xml;charset=utf-8,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="600" height="400"><rect width="600" height="400" fill="#f3f1ec"/><text x="300" y="200" font-size="26" text-anchor="middle" font-family="sans-serif">근거 자료 (예시)</text></svg>')}`;

// 시안용 예시 데이터 — F-WREQ-04 응답과 같은 모양이에요.
export const MOCK_REQUEST_DETAILS: Record<string, ConditionRequestDetailDto> = {
  'REQ-0142': {
    requestId: 'REQ-0142',
    placeId: 'store-ss-0142',
    status: 'IN_REVIEW',
    submittedAt: '2026-10-20T14:12:00+09:00',
    lastSubmittedAt: '2026-10-20T14:12:00+09:00',
    baseVersion: 7,
    latestConditionsVersion: 7,
    baseChanged: false,
    changes: [
      { field: 'weightLimitKg', currentValue: 7, currentUnrestricted: false, latestValue: 7, latestUnrestricted: false, requestedValue: 10, requestedUnrestricted: false },
    ],
    evidences: [
      { kind: 'FILE', fileName: 'instagram_공지_1020.png', url: SAMPLE_FILE },
      { kind: 'LINK', url: 'https://instagram.com/p/aacafe_notice' },
    ],
    reason: null,
    history: [
      { action: 'SUBMIT', status: 'RECEIVED', at: '2026-10-20T14:12:00+09:00', by: 'BUSINESS', reason: null },
      { action: 'START_REVIEW', status: 'IN_REVIEW', at: '2026-10-21T09:40:00+09:00', by: 'OPERATOR', reason: null },
    ],
    canCancel: false,
    canResubmit: false,
  },
  'REQ-0131': {
    requestId: 'REQ-0131',
    placeId: 'store-ss-0142',
    status: 'NEEDS_INFO',
    submittedAt: '2026-09-27T10:02:00+09:00',
    lastSubmittedAt: '2026-09-27T10:02:00+09:00',
    baseVersion: 6,
    latestConditionsVersion: 7,
    baseChanged: true,
    changes: [
      { field: 'vaccinationRequired', currentValue: null, currentUnrestricted: false, latestValue: null, latestUnrestricted: false, requestedValue: true, requestedUnrestricted: false },
    ],
    evidences: [{ kind: 'FILE', fileName: '매장_안내문.jpg', url: SAMPLE_FILE }],
    reason: '근거 자료에 적용 날짜가 보이지 않아요. 날짜가 보이는 공지 캡처를 다시 올려 주세요.',
    history: [
      { action: 'SUBMIT', status: 'RECEIVED', at: '2026-09-27T10:02:00+09:00', by: 'BUSINESS', reason: null },
      { action: 'START_REVIEW', status: 'IN_REVIEW', at: '2026-09-28T11:00:00+09:00', by: 'OPERATOR', reason: null },
      { action: 'REQUEST_SUPPLEMENT', status: 'NEEDS_INFO', at: '2026-10-01T15:20:00+09:00', by: 'OPERATOR', reason: '근거 자료에 적용 날짜가 보이지 않아요. 날짜가 보이는 공지 캡처를 다시 올려 주세요.' },
    ],
    canCancel: true,
    canResubmit: true,
  },
  'REQ-0118': {
    requestId: 'REQ-0118',
    placeId: 'store-ss-0142',
    status: 'APPROVED',
    submittedAt: '2026-09-12T16:40:00+09:00',
    lastSubmittedAt: '2026-09-12T16:40:00+09:00',
    baseVersion: 5,
    latestConditionsVersion: 7,
    baseChanged: true,
    changes: [
      { field: 'requiredItems', currentValue: ['STROLLER'], currentUnrestricted: false, latestValue: ['STROLLER', 'MANNER_BELT'], latestUnrestricted: false, requestedValue: ['STROLLER', 'MANNER_BELT'], requestedUnrestricted: false },
    ],
    evidences: [{ kind: 'FILE', fileName: '매장_공지_0912.png', url: SAMPLE_FILE }],
    reason: null,
    history: [
      { action: 'SUBMIT', status: 'RECEIVED', at: '2026-09-12T16:40:00+09:00', by: 'BUSINESS', reason: null },
      { action: 'START_REVIEW', status: 'IN_REVIEW', at: '2026-09-13T10:00:00+09:00', by: 'OPERATOR', reason: null },
      { action: 'APPROVE', status: 'APPROVED', at: '2026-09-15T13:30:00+09:00', by: 'OPERATOR', reason: null },
    ],
    canCancel: false,
    canResubmit: false,
  },
  'REQ-0104': {
    requestId: 'REQ-0104',
    placeId: 'store-ss-0142',
    status: 'REJECTED',
    submittedAt: '2026-08-30T11:20:00+09:00',
    lastSubmittedAt: '2026-08-30T11:20:00+09:00',
    baseVersion: 4,
    latestConditionsVersion: 7,
    baseChanged: true,
    changes: [
      { field: 'restrictedBreeds', currentValue: null, currentUnrestricted: true, latestValue: null, latestUnrestricted: true, requestedValue: ['시베리안 허스키', '진돗개'], requestedUnrestricted: false },
    ],
    evidences: [],
    reason: '견종 대신 체중 제한(실내 7kg 이하)으로 이미 안내하고 있어요. 견종 제한이 따로 필요하면 매장 공지를 첨부해 다시 요청해 주세요.',
    history: [
      { action: 'SUBMIT', status: 'RECEIVED', at: '2026-08-30T11:20:00+09:00', by: 'BUSINESS', reason: null },
      { action: 'START_REVIEW', status: 'IN_REVIEW', at: '2026-08-31T09:10:00+09:00', by: 'OPERATOR', reason: null },
      { action: 'REJECT', status: 'REJECTED', at: '2026-09-01T10:00:00+09:00', by: 'OPERATOR', reason: '견종 대신 체중 제한(실내 7kg 이하)으로 이미 안내하고 있어요.' },
    ],
    canCancel: false,
    canResubmit: false,
  },
};
