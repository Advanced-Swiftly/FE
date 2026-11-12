// 상태 값은 서버와 맞출 영문 코드로 두고, 화면 글자는 LABEL에서만 가져와요.

/** 요청 처리 상태 (입장 조건 변경 · 가입 인증 · 이벤트/광고 신청 공통) */
export const REQUEST_STATUS = {
  RECEIVED: 'RECEIVED',
  IN_REVIEW: 'IN_REVIEW',
  NEEDS_INFO: 'NEEDS_INFO',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
  /** 업체가 취소 (조건 변경 요청 · 신청) */
  CANCELED: 'CANCELED',
  /** 참여 신청: 모집 마감까지 승인되지 않음 (표시 전용 displayStatus) */
  CLOSED_NOT_APPROVED: 'CLOSED_NOT_APPROVED',
} as const;

export type RequestStatus = (typeof REQUEST_STATUS)[keyof typeof REQUEST_STATUS];

export const REQUEST_STATUS_LABEL: Record<RequestStatus, string> = {
  RECEIVED: '접수',
  IN_REVIEW: '검토 중',
  NEEDS_INFO: '보완 요청',
  APPROVED: '승인',
  REJECTED: '반려',
  CANCELED: '취소',
  CLOSED_NOT_APPROVED: '모집 종료 · 미승인',
};

/** 진행 중으로 묶는 상태 (요청 처리 현황 · 대시보드) */
export const IN_PROGRESS_STATUSES: RequestStatus[] = ['RECEIVED', 'IN_REVIEW', 'NEEDS_INFO'];

/** 입장 판정 4단계 (서버 Verdict 값, 판정 우선순위: 불가 → 확인 필요 → 준비 필요 → 가능) */
export const JUDGMENT = {
  ENTRY_OK: 'ENTRY_OK',
  PREPARE: 'PREPARE',
  NO_ENTRY: 'NO_ENTRY',
  UNKNOWN: 'UNKNOWN',
} as const;

export type Judgment = (typeof JUDGMENT)[keyof typeof JUDGMENT];

export const JUDGMENT_LABEL: Record<Judgment, string> = {
  ENTRY_OK: '입장 가능',
  PREPARE: '준비 필요',
  NO_ENTRY: '입장 불가',
  UNKNOWN: '조건 확인 필요',
};

/** 서비스 지역 (MVP) */
export const AREAS = ['성수', '건대', '서울숲'] as const;
export type Area = (typeof AREAS)[number];
