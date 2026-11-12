import type { Area } from '@/constants/status';
import type { ConditionField, ConditionState, PlaceConditions } from './conditions';

export * from './conditions';

export interface TimelineStep {
  title: string;
  meta?: string;
  state: 'done' | 'current' | 'todo' | 'danger';
}

/* ───────── 검토 대기열 (명세 F-OREV-01 · 02) ───────── */

/**
 * 검토 대기열 항목 종류
 * - AI_POLICY: AI 정책 후보 · STORE_CHANGE: 업체 입장 조건 변경 요청
 * - EVENT: 댕댕로드 참여 신청 · AD: 지도 추천 노출 광고 신청
 */
export type QueueItemType = 'AI_POLICY' | 'STORE_CHANGE' | 'EVENT' | 'AD';

/** RECEIVED: 접수 · IN_REVIEW: 검토 중 · NEEDS_INFO: 업체 보완 대기 */
export type QueueStatus = 'RECEIVED' | 'IN_REVIEW' | 'NEEDS_INFO';

/** 검토 대기열 한 건 — 승인 · 반려 · 취소되면 대기열에서 빠지고 업체 처리 이력에 남아요 (담당자 배정은 없어요) */
export interface QueueItem {
  id: string;
  type: QueueItemType;
  storeId: string;
  storeName: string;
  area: Area;
  category: string;
  summary: string;
  /** 요약 뒤 회색 보조 글자 (예: '· 미확인 2') */
  summaryNote?: string;
  evidence: string;
  /** 접수 경과 기준 (보완 제출 뒤에는 마지막 제출 시각) */
  submittedAt: string;
  status: QueueStatus;
}

/** F-OREV-03 · 06 처리 작업 (서버 allowedActions) */
export type ConditionAction = 'START_REVIEW' | 'EDIT_PROPOSAL' | 'APPROVE' | 'REQUEST_SUPPLEMENT' | 'REJECT';

/** 처리 결과 — 업체 요청: 승인 · 보완 요청 · 반려 / AI 후보 · 신청: 승인 · 반려 */
export type Decision = 'APPROVE' | 'REVISE' | 'REJECT';

export interface QueueSummary {
  /** 운영자가 할 일 — 대시보드 요약 API 에서는 pendingConditionRequests (응답에 없는 지표는 null) */
  waiting: number | null;
  processedToday: number | null;
  avgDays: number | null;
  staleStores: number | null;
  /** 사이드바 배지 숫자 (F-OREV-01 badgeCount, 없으면 null) */
  badgeCount: number | null;
}

/** AI 구조화 결과 · 변경안 한 줄 */
/** 변경안 항목 상태 (원문 대비) */
export type ProposalFieldStatus = 'CHANGED' | 'CHECK' | 'NEW' | 'SAME' | 'KEEP_UNKNOWN';

/** 변경안 한 항목 — 처음 받은 값과 운영자가 고친 값 (F-OREV-03 proposal.*) */
export interface ProposalField {
  field: ConditionField;
  status: ProposalFieldStatus;
  /** 처음 받은 값 (AI 결과 또는 업체 요청값) */
  originalValue: PlaceConditions[ConditionField];
  originalUnrestricted: boolean;
  /** 운영자가 직접 고쳤는지 ([직접 수정] 표시) */
  edited: boolean;
}

/** F-OREV-03 정책 후보 · 업체 변경 요청 검토 상세 */
/** F-OREV-03 상세 상태 — 대기열 상태에 처리 끝난 상태(승인 · 반려 · 취소)까지. 직접 주소 · 이력 링크로 열 수 있어요 */
export type ReviewStatus = QueueStatus | 'APPROVED' | 'REJECTED' | 'CANCELED';

export interface PolicyReview {
  id: string;
  type: 'AI_POLICY' | 'STORE_CHANGE';
  /** 서버 상태 그대로 (모르는 값도 바꾸지 않아요) */
  status: ReviewStatus | (string & {});
  storeId: string;
  storeName: string;
  title: string;
  submittedAt: string;
  requester: string;
  /** 요청 뒤 확정 조건이 바뀌었으면 승인할 수 없어요 */
  baseChanged: boolean;
  /** 서버가 허용한 처리 (F-OREV-03 allowedActions) */
  allowedActions: ConditionAction[];
  source: {
    fileName?: string;
    /** 근거 파일 주소 (짧게 유효한 주소 · 명세 S-2) */
    fileUrl?: string;
    files?: { fileName: string; url: string }[];
    /** [글자, 강조 여부] 조각 */
    text: [string, boolean][];
    /** 원문 링크 (source.links[] 전부) */
    links: string[];
    meta: string;
  };
  /** 경계값 경고 (boundaryWarnings[] 전부 · 기준은 팀 확인 필요 · 명세 원본 22) */
  warnings: string[];
  /** 지금 적용 중인 조건 (place_conditions) */
  current: ConditionState;
  /** 저장된 변경안 — 승인되면 이 조건이 돼요 (운영자가 고친 값 포함) */
  proposal: ConditionState;
  /** 변경안이 다루는 항목 */
  fields: ProposalField[];
  /** 지금 조건 확인일 */
  checkedAt: string;
  history: TimelineStep[];
}

/** F-OAPP-01 · 02 처리 작업 (서버 allowedActions) */
export type ApplicationAction = 'START_REVIEW' | 'APPROVE' | 'REJECT';

/** F-OAPP-01 이벤트(댕댕로드 참여) · 광고 신청 상세 */
export interface ApplyReview {
  id: string;
  type: 'STAMP_ROAD' | 'AD';
  storeId: string;
  storeName: string;
  status: string;
  /** 참여 신청만 (CLOSED_NOT_APPROVED 포함) */
  displayStatus: string | null;
  submittedAt: string;
  reviewStartedAt: string | null;
  stampRoad: {
    eventId: string;
    periodId: string;
    title: string;
    regions: string[];
    recruitment: { startAt: string; endAt: string };
    intro: string;
    qrPledgeAgreed: boolean;
    recruitmentStatus: { applicationCount: number; approvedCount: number };
  } | null;
  ad: { region: string; startDate: string; weeks: number; endDate: string } | null;
  /** 지금 기준 재계산 (광고는 빈 배열) */
  checks: { code: string; passed: boolean; detail: { checkedDate?: string | null; daysSince?: number | null; reason?: string } | null }[];
  checkedAt: string | null;
  /** 참여 신청만: 신청 때 결과 */
  eligibilityAtSubmit: { code: string; passed: boolean }[];
  /** 참여 신청만: 한 줄 소개 40자 검사 */
  introCheck: { length: number; maxLength: number; passed: boolean } | null;
  /** 서버가 허용한 처리 — 빈 배열이면 아무 처리도 할 수 없어요 */
  allowedActions: ApplicationAction[];
  prevApplicationId: string | null;
  nextApplicationId: string | null;
  /** 서버 모드 — BE 가 주는 값만 담은 제목 · 신청 내용 (있으면 stampRoad · ad 대신 써요) */
  title?: string;
  details?: { label: string; value: string; href?: string }[];
  detailNote?: string;
}

/* ───────── 예방접종 증명서 (명세 F-OVAC) ───────── */

/** OPERATOR_REVIEW: 확인 대기 · VERIFIED: 확인 완료 · REUPLOAD: 재제출 요청 */
export type VaccineStatus = 'OPERATOR_REVIEW' | 'VERIFIED' | 'REUPLOAD';

/** 대조 항목 하나 — AI가 읽은 값 · 반영된 값 · 보호자가 고쳤는지 · 일치 여부 */
export interface VaccineField {
  key: 'dogName' | 'vaccinatedAt' | 'items' | 'hospital';
  label: string;
  aiValue: string | null;
  value: string | null;
  edited: boolean;
  match: boolean;
}

export interface VaccineSubmission {
  id: string;
  dogName: string;
  breed: string;
  weightKg: number;
  /** 가린 보호자 이름 (예: 김*희) */
  owner: string;
  vaccine: string;
  /** 프로필 반영 시각 */
  appliedAt: string;
  resubmitted?: boolean;
  status: VaccineStatus;
  fileName: string;
  /** 서류 파일 — 짧게 유효한 주소 (명세 F-OVAC-02 · 10분 [제안]) */
  files: { fileId: string; kind: 'CERTIFICATE' | 'RECEIPT' | 'UNKNOWN'; url: string; urlExpiresAt: string | null }[];
  fields: VaccineField[];
  /** 처리 결과 (완료 · 재제출 요청 뒤) */
  result?: string;
}

/** F-OVAC-01 목록 한 줄 (상세 F-OVAC-02 는 따로 불러요) */
export type VaccineListItem = Pick<VaccineSubmission, 'id' | 'dogName' | 'breed' | 'weightKg' | 'owner' | 'vaccine' | 'appliedAt' | 'resubmitted' | 'status'>;

/* ───────── 업체 (명세 F-OPLACE) ───────── */
// 화면 타입이에요. 서버 응답(DTO)은 api/stores.ts 에서 이 모양으로 바꿔요.

/** 정보 근거 — 값 목록은 명세 [확인 필요] (원본 20). 화면은 아는 값만 이름을 붙이고 나머지는 그대로 보여 줘요 */
export type InfoSource = string;

/** F-OPLACE-01 목록 한 줄 */
export interface PlaceListItem {
  id: string;
  name: string;
  /** 아래 값은 운영자 업체 목록 API 예시에 없어요 — 없으면 null 로 받아 '—' 로 보여 줘요 */
  category: string | null;
  /** 지역 — 값 목록 [확인 필요] (원본 8) */
  region: string | null;
  source: InfoSource | null;
  conditionCheckedAt: string | null;
  /** 확인일 30일 지남 (서버 계산) — 모르면 null */
  stale: boolean | null;
  qrVisitCount: number | null;
  recheckRequested: boolean;
  /** 지도 노출 중지 */
  hidden: boolean;
}

/** F-OPLACE-01 응답 */
export interface PlaceListPage {
  sourceRatio: { source: InfoSource | null; count: number }[];
  items: PlaceListItem[];
  nextCursor: string | null;
}

/** F-OPLACE-04 업체 상세 · 개요 */
export interface PlaceOverview {
  id: string;
  name: string;
  category: string | null;
  region: string | null;
  source: InfoSource | null;
  chips: { certification: string | null; checkMethod: string | null; eventParticipation: string | null; hidden: boolean };
  summary: { conditionCheckedAt: string | null; qrVisitCount: number | null; openRequestCount: number | null; inquiryCount: number | null };
  info: PlaceInfo;
  memo: PlaceMemo;
  /** 운영자 업체 상세 API 값 (있을 때만) */
  policyVersion?: number | null;
}

export interface PlaceInfo {
  address: string | null;
  phone: string | null;
  channels: string[];
}

export interface PlaceMemo {
  text: string;
  updatedAt: string | null;
  updatedBy: string | null;
}

/** F-OPLACE-09 입장 조건 */
export interface PlaceConditionsView {
  placeId: string;
  state: ConditionState;
  source: string | null;
  sourceUrl: string | null;
  checkedAt: string | null;
  /** F-OPLACE-10 의 baseVersion. 응답에 없으면 null — 그때는 저장하지 않아요 */
  conditionsVersion: number | null;
  pendingRequests: { requestId: string; status: string }[];
}

/** F-OPLACE-08 처리 이력 한 줄 — type · result · changes 의 모양은 명세 [확인 필요] (OR-27 · OPL-10) */
export interface PlaceHistoryItem {
  id: string;
  type: string;
  at: string;
  actorName: string | null;
  result: string | null;
  changes: string | null;
  requestId: string | null;
}

/** F-OPLACE-11 업체 계정 · QR */
export interface PlaceAccountView {
  placeId: string;
  account: { loginId: string; managerName: string | null; lastLoginAt: string | null; linkedPlaces: { placeId: string; name: string }[]; withdrawn: boolean } | null;
  /** status 값은 명세 [확인 필요] (원본 29) — 받은 값을 그대로 보여 줘요 */
  qr: { qrId: string; issuedAt: string | null; status: string | null } | null;
}

/* ───────── Q&A (명세 F-OQNA) ───────── */

export interface QnaItem {
  id: string;
  /** 작성자 구분 — API 문서 응답에는 없어 모르면 null */
  author: 'GUARDIAN' | 'BUSINESS' | null;
  authorName: string;
  createdAt: string;
  context?: string;
  title: string | null;
  body: string;
  /** 첨부 — 짧게 유효한 주소 (명세 F-OQNA-02 · 10분 [제안]) */
  attachments: { name: string; url: string }[];
  relatedStore?: { id: string; name: string; area: Area; note: string; queueId?: string; queueType?: QueueItemType };
  /** 관련 요청 — kind 로 이동할 화면을 정해요 (ID 모양으로 고르지 않아요) */
  relatedRequest?: { kind: 'CONDITION' | 'AI_CANDIDATE' | 'EVENT_AD'; id: string };
  answer?: { body: string; answeredAt: string };
}

/** F-OQNA-01 목록 한 줄 (본문 · 첨부는 상세에서) */
export type QnaListItem = Omit<QnaItem, 'body' | 'attachments' | 'answer'> & { attachmentCount: number; answered: boolean; preview: string };


/* ───────── 댕댕로드 추첨 (명세 F-ODRAW · 화면 UI-O-012 · UI-O-013) ───────── */

/** 분기 진행: UPCOMING 예정 · OPEN 응모 중 · CLOSED 마감 (날짜로 계산 · 제안) */
export type PeriodPhase = 'UPCOMING' | 'OPEN' | 'CLOSED';

/** 추첨 실행 상태 (제안) */
export type DrawStatus = 'RUNNING' | 'SUCCEEDED' | 'FAILED';

/** 응모 결과 — stamp_entries.result 기존 값 */
export type EntryResult = 'PENDING' | 'WON' | 'NOT_WON';

/** F-ODRAW-01 분기 기간 한 줄 */
export interface StampPeriod {
  /** YYYYQn (예: 2026Q4) */
  periodId: string;
  name: string;
  startDate: string;
  endDate: string;
  /** 보호자 안내 마감 (분기 마지막 날 23:59:59) */
  entryDeadline: string;
  /** 발표일 (다음 분기 첫날) */
  announceDate: string;
  phase: PeriodPhase;
  /** 취소되지 않은 응모 수 */
  entryCount: number;
  prizeCount: number;
  /** 마지막 추첨 상태, 없으면 null. F-ODRAW-01 응답에는 실행 ID 가 없어요 */
  drawStatus: DrawStatus | null;
  /** 결과 공개 시각, 없으면 null */
  publishedAt: string | null;
}

/** F-ODRAW-02 상품 */
export interface StampPrize {
  prizeId: string;
  name: string;
  brand: string | null;
  imageUrl: string | null;
  /** 미정이면 null */
  quantity: number | null;
}

/** F-ODRAW-03 응모 한 건 (연락처는 가린 값) */
export interface StampEntry {
  entryId: string;
  userId: string;
  enteredAt: string;
  result: EntryResult;
  canceled: boolean;
  canceledAt: string | null;
  contactPhoneMasked: string;
  /** 서버 응답에 없으면 null (화면 '—') */
  hasAddressSnapshot: boolean | null;
  /** 서버 모드: 당첨 취소(CANCEL_WIN)로 CANCELED 가 된 응모 — 탈퇴 등 응모 취소와 구분해요 */
  canceledKind?: 'WIN';
  /** WON 이 아니면 null */
  awardedPrize: { prizeId: string; name: string } | null;
  /** 추첨 전 null */
  drawRunId: string | null;
}

/** F-ODRAW-04 추첨 실행 기록 */
export interface DrawRun {
  drawRunId: string;
  periodId: string;
  status: DrawStatus;
  requestedAt: string;
  requestedBy: { type: 'OPERATOR' | 'SYSTEM'; operatorId: string | null };
  finishedAt: string | null;
  eligibleCount: number | null;
  wonCount: number | null;
  notWonCount: number | null;
  canceledDuringRunCount: number | null;
  /** 서버 모드: 당첨 뒤 취소된 건수 (draw-result winners 중 CANCELED) */
  canceledWinCount?: number | null;
  failure: { code: string; message: string } | null;
  publication: { publishedAt: string | null; notificationsQueued: number };
}

/** 연락 수단 · 결과 (제안) */
export type ContactChannel = 'PHONE_CALL' | 'SMS';
export type ContactOutcome = 'REACHED' | 'NO_ANSWER' | 'WRONG_NUMBER' | 'DECLINED';

/** 주소 객체 */
export interface Address {
  zip: string;
  line1: string;
  line2: string;
}

/** F-ODRAW-05 연락 기록 한 건 */
export interface WinnerContact {
  contactId: string;
  entryId: string;
  attemptedAt: string;
  channel: ContactChannel;
  outcome: ContactOutcome;
  memo: string | null;
  recordedBy: { operatorId: string };
  recordedAt: string;
}

/** F-ODRAW-05 당첨 연락 조회 (이 조회에서만 가리지 않은 번호를 줘요) */
export interface WinnerContactDetail {
  entryId: string;
  periodId: string;
  result: EntryResult;
  awardedPrize: { prizeId: string; name: string } | null;
  phoneSnapshot: string;
  /** 응모 때 받은 배송지, 없으면 null */
  addressSnapshot: Address | null;
  /** 따로 받은 배송 정보, 없으면 null */
  deliveryInfo: { address: Address; collectedAt: string; collectedVia: string; recordedBy: { operatorId: string } } | null;
  contacts: WinnerContact[];
}

export interface NewWinnerContact {
  attemptedAt: string;
  channel: ContactChannel;
  outcome: ContactOutcome;
  memo: string | null;
}
