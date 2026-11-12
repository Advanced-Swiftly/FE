import type { Area, Judgment, RequestStatus } from '@/constants/status';
export type { RequestStatus };

/** 업체 관리자가 관리하는 매장 */
export interface Store {
  id: string;
  name: string;
  /** 지역 · 업종 — F-WDASH-01 응답에는 없어서 서버 연동 때는 null 일 수 있어요 (명세 WD-3) */
  area: Area | null;
  category: string | null;
  /** 운영자 인증 상태 — PENDING이면 업체 전환 불가 */
  verification: 'APPROVED' | 'PENDING';
  /** 매장 전용 QR 코드 ID */
  qrId?: string;
  /** 지도 노출 상태 (서버 visibility 값 그대로, 예: VISIBLE · HIDDEN). 승인 · 선택 가능 여부와는 상관없어요 */
  visibility?: string | null;
}

/* ───────── 입장 조건 (사용자 앱 place_conditions 와 같은 필드) ───────── */

// TODO: Size · Area · Item 값 목록은 사용자 앱 명세서 값으로 맞춰 주세요.
export type SizeLimit = 'SMALL' | 'MEDIUM' | 'LARGE';
export type AreaRule = 'INDOOR_OK' | 'OUTDOOR_ONLY';
export type Item = 'STROLLER' | 'CARRIER' | 'MANNER_BELT' | 'MUZZLE';

/** 조건 값. null 은 '미확인' (단, unrestrictedFields 에 든 필드는 '제한 없음') */
export interface PlaceConditions {
  petAllowed: boolean | null;
  weightLimitKg: number | null;
  sizeLimit: SizeLimit | null;
  restrictedBreeds: string[] | null;
  area: AreaRule | null;
  requiredItems: Item[] | null;
  vaccinationRequired: boolean | null;
}

export type ConditionField = keyof PlaceConditions;

/** '제한 없음' 으로 둘 수 있는 필드 (명세 5.2절) */
export type UnrestrictableField = 'weightLimitKg' | 'sizeLimit' | 'restrictedBreeds' | 'area' | 'requiredItems';

/** 조건 값 + 제한 없음 필드 목록 */
export interface ConditionState {
  conditions: PlaceConditions;
  unrestrictedFields: UnrestrictableField[];
}

/** 진행 중 요청에 든 항목 — 결과가 나올 때까지 다시 요청할 수 없어요 */
export interface PendingItem {
  field: ConditionField;
  /** 진행 중 요청 ID (api/ids.ts toId 결과). 서버가 주지 않았거나 비어 있으면 null — 잠금은 그대로, 링크만 숨겨요 */
  requestId: string | null;
  status: RequestStatus;
}

/** F-WREQ-02 입장 조건 현황 */
export interface StoreConditions extends ConditionState {
  storeId: string;
  conditionCheckedAt: string | null;
  /** 조건 버전 — 변경 요청 때 baseVersion 으로 보내요 */
  conditionsVersion: number;
  source: string | null;
  /** 출처 원문 주소 (응답의 conditions.sourceUrl) */
  sourceUrl: string | null;
  checkMethod: string | null;
  pendingItems: PendingItem[];
}

/** F-WREQ-03 조건 변경 요청 · F-WREQ-06 보완 다시 보내기 */
export interface ConditionChangeRequest {
  storeId: string;
  baseVersion: number;
  /** 구체적인 제한으로 바꾼 항목만 (null 불가) */
  changes: Partial<PlaceConditions>;
  /** 이번에 제한 없음으로 바꿀 필드 */
  unrestrictedFields: UnrestrictableField[];
  evidenceLinks: string[];
  evidenceFiles: { name: string; size: number }[];
}

/** 판정 미리보기용 테스트 반려견 */
export interface SampleDog {
  id: string;
  label: string;
  weightKg: number;
  size: SizeLimit;
  breed: string;
  items: Item[];
  vaccinated: boolean;
}

/** 판정 미리보기 한 줄 (F-WREQ-07 dogs[]: testDogId · label · before · after) */
export interface VerdictPreview {
  dogId: string;
  label: string;
  before: Judgment;
  after: Judgment;
}

/* ───────── 요청 처리 현황 ───────── */

export type PartnerRequestType = 'CONDITION' | 'EVENT' | 'AD';

/** 요청 처리 현황에 보이는 한 건 (입장 조건 변경 · 이벤트 · 광고) */
/** F-WDASH-02 대시보드 요약 */
export interface DashboardSummary {
  placeId: string;
  /** 응답(또는 방문 통계)에 없으면 null — 화면은 '–' 로 보여 줘요 (0 으로 채우지 않아요) */
  qrVisitCount: number | null;
  stampCount: number | null;
  inProgressRequestCount: number | null;
  conditionCheckedAt: string | null;
}

/** F-WDASH-03 매장 QR */
/** 업체 QR 조회 (GET /business/stores/{storeId}/qr) 화면용 */
export interface PlaceQr {
  storeId: string;
  /** 서버 QR ID (숫자도 문자열로 맞춰요). 없으면 null */
  qrId: string | null;
  /** 서버 상태 값 그대로 (ACTIVE 등) */
  status: string | null;
  /** 서버가 만든 QR 이미지 주소. 없으면 null — 화면이 QR 을 새로 그리지 않아요 */
  imageUrl: string | null;
}

/** F-WREQ-01 목록 한 줄 (조건 변경 요청 · 이벤트·광고 신청) */
export interface PartnerRequest {
  /** 조건 변경은 requestId, 신청은 applicationId */
  id: string;
  /** 어느 매장의 요청인지 */
  storeId: string;
  /** 서버 type. 신청이 광고인지 참여 신청인지는 목록에 없어서 상세(F-WAD-06)에서 알아요 */
  kind: 'CONDITION' | 'EVENT_AD';
  /** 신청 종류 — 이벤트 참여(EVENT) · 광고(AD). 같은 숫자 ID 여도 상세 · 취소 경로가 섞이지 않게 함께 들고 다녀요 */
  appKind?: 'EVENT' | 'AD';
  status: RequestStatus;
  group: 'IN_PROGRESS' | 'DONE';
  /** 줄 요약 — 서버가 만든 글 (명세 WR-4) */
  summaryText: string | null;
  submittedAt: string;
}

/** F-WREQ-01 응답 */
export interface RequestPage {
  /** 전체 건수 요약 — 새 목록 API 에는 없어 null (첫 페이지 개수로 만들지 않아요) */
  summary: { inProgress: number; needsAction: number; done: number; avgProcessingDays: number | null } | null;
  items: PartnerRequest[];
  nextCursor: string | null;
}

export interface Attachment {
  name: string;
  href?: string;
  kind: 'file' | 'link';
}

export interface TimelineStep {
  title: string;
  meta?: string;
  state: 'done' | 'current' | 'todo' | 'danger';
}

/** 요청 한 항목의 값 비교 (제출 때 · 지금 확정 · 요청) */
export interface RequestChange {
  field: ConditionField;
  currentValue: PlaceConditions[ConditionField];
  currentUnrestricted: boolean;
  latestValue: PlaceConditions[ConditionField];
  latestUnrestricted: boolean;
  requestedValue: PlaceConditions[ConditionField];
  requestedUnrestricted: boolean;
}

export interface RequestHistory {
  action: 'SUBMIT' | 'START_REVIEW' | 'REQUEST_SUPPLEMENT' | 'RESUBMIT' | 'APPROVE' | 'REJECT' | 'CANCEL';
  status: RequestStatus;
  at: string;
  by: 'BUSINESS' | 'OPERATOR';
  reason: string | null;
}

/** F-WREQ-04 조건 변경 요청 상세 (요청 상세 팝업) */
export interface ConditionRequestDetail {
  id: string;
  storeId: string;
  status: RequestStatus;
  submittedAt: string;
  lastSubmittedAt: string;
  /** 요청 때 기준 버전 · 지금 최신 버전 — 응답에 없으면 null (비교할 수 없음) */
  baseVersion: number | null;
  latestConditionsVersion: number | null;
  /** 요청 뒤 확정 조건이 바뀌었는지 */
  baseChanged: boolean;
  changes: RequestChange[];
  evidences: Attachment[];
  /** 마지막 보완 · 반려 사유 */
  reason: string | null;
  history: RequestHistory[];
  canCancel: boolean;
  canResubmit: boolean;
}

/* ───────── 광고 · 이벤트 (댕댕로드 분기 행사) ───────── */

/** 행사 단계 — 서버가 시각으로 계산 (명세 5.3절) */
export type EventPhase = 'UPCOMING' | 'RECRUITING' | 'IN_PROGRESS' | 'ENDED';

/** 참여 조건 코드 */
export type EligibilityCode = 'REGION' | 'BUSINESS_VERIFIED' | 'QR_ACTIVE' | 'CONDITION_CHECKED_RECENT' | 'QR_PLEDGE';

export type ApplyBlockedReason = 'NOT_RECRUITING' | 'OUT_OF_REGION' | 'ALREADY_APPLIED' | 'ALREADY_PARTICIPATING';

export interface DateRange {
  startDate: string;
  endDate: string;
}

/** F-WAD-01 모집 중 행사 한 줄 */
export interface RecruitingEvent {
  id: string;
  periodId: string;
  title: string;
  phase: EventPhase;
  period: DateRange;
  /** 모집: 시작 이상 ~ 끝 미만 */
  recruitment: { startAt: string; endAt: string };
  regions: Area[];
  placeInRegion: boolean;
  myApplication: { applicationId: string; status: RequestStatus; displayStatus: RequestStatus } | null;
  canApply: boolean;
}

/** F-WAD-01 이 매장이 참여 승인된 행사 한 줄 */
export interface ParticipatingEvent {
  id: string;
  periodId: string;
  title: string;
  phase: EventPhase;
  period: DateRange;
  participationId: string;
  approvedAt: string;
}

/** F-WAD-02 행사 상세 (선택한 매장 기준) */
export interface StampRoadEvent {
  /** 이벤트 상세 API 의 지역 (ID · 이름) — 참여 신청 regionIds 고를 때 써요 */
  regionOptions?: { id: string; name: string }[];
  /** 경품 (이벤트 상세 API) */
  prizes?: { name: string; quantity: number | null; rank: number | null }[];
  id: string;
  /** 분기 ID (예: 2027Q1) */
  periodId: string;
  title: string;
  phase: EventPhase;
  period: DateRange;
  recruitment: { startAt: string; endAt: string };
  regions: Area[];
  description: string | null;
  conditions: EligibilityCode[];
  /** 지역 안 · 인증 승인 매장 — 참여 신청 때 고를 수 있는 매장 */
  applicablePlaces: { placeId: string; name: string }[];
  /** 이 응답이 기준으로 삼은 매장 */
  placeId: string;
  myApplication: { applicationId: string; status: RequestStatus; displayStatus: RequestStatus; rejectReason: string | null } | null;
  participation: { participationId: string; approvedAt: string } | null;
  canApply: boolean;
  applyBlockedReason: ApplyBlockedReason | null;
}

export interface EligibilityCheck {
  code: EligibilityCode;
  passed: boolean;
  detail?: { checkedDate: string | null; daysSince: number | null; reason?: 'NO_DATE' | 'FUTURE_DATE' | 'OVER_30_DAYS' } | null;
}

/** F-WAD-03 참여 조건 자동 확인 */
export interface Eligibility {
  eventId: string;
  placeId: string;
  baseDate: string;
  recruitmentOpen: boolean;
  existingApplication: { applicationId: string; status: RequestStatus } | null;
  checks: EligibilityCheck[];
  allPassed: boolean;
  canApply: boolean;
}

/** F-WAD-06 신청 내역 상세 (광고 · 참여 신청 공용) */
export interface Application {
  /** 광고 소재 주소 (광고 신청 상세 API) */
  creativeUrl?: string | null;
  id: string;
  type: 'AD' | 'STAMP_ROAD';
  storeId: string;
  storeName: string;
  /** 저장 상태 */
  status: RequestStatus;
  /** 참여 신청만: 모집 종료 · 미승인 포함 */
  displayStatus?: RequestStatus;
  submittedAt: string;
  ad?: { region: Area; startDate: string; weeks: number; endDate: string };
  stampRoad?: {
    eventId: string;
    periodId: string;
    title: string;
    period: DateRange;
    recruitment: { startAt: string; endAt: string };
    intro: string;
    qrPledgeAgreed: boolean;
    /** 신청 때 조건 결과 */
    eligibilityAtSubmit: { code: EligibilityCode; passed: boolean }[];
    participation: { participationId: string; approvedAt: string } | null;
  };
  history: { at: string; status: RequestStatus; by: 'BUSINESS' | 'OPERATOR' }[];
  rejectReason: string | null;
  canCancel: boolean;
  canEditPeriod: boolean;
  /** 참여 신청만 (광고 응답에는 없어서 false) */
  canReapply: boolean;
}

/** F-WAD-01 응답 */
export interface PromoOverview {
  placeId: string;
  /** 서버가 판단에 쓴 지금 시각 */
  serverTime: string;
  recruiting: RecruitingEvent[];
  participating: ParticipatingEvent[];
  /** 서버 모드에서 현재 이벤트를 불러오지 못한 이유 (권한 · 연결). 없으면 null */
  eventsUnavailable?: string | null;
}

export interface EventApplyForm {
  eventId: string;
  storeId: string;
  intro: string;
  qrPledgeAgreed: boolean;
  /** 참여 희망 지역 ID (이벤트 참여 신청 regionIds) — 서버 모드에서 필수 */
  regionIds?: (string | number)[];
}

export interface AdApplyForm {
  storeId: string;
  /** 목업 화면만 써요 (BE 광고 신청에는 지역이 없어요) */
  region: Area | '';
  startDate: string;
  weeks: number;
  /** 서버 모드 — BE 광고 신청 필수값: 광고 종류 · 광고 소재 URL(https) */
  adType?: 'BANNER' | 'RECOMMENDED';
  creativeUrl?: string;
  message?: string;
}

/** F-WAD-09 이벤트 통계 — 분기 세 달의 월별 스탬프 · 완주 */
export interface EventStats {
  eventId: string;
  periodId: string;
  placeId: string;
  phase: EventPhase;
  /** 서버가 고른 달 (month 를 안 보내면 기본 월) */
  selectedMonth: string;
  /** 업체 이벤트 통계 API 총계 (visits · stampAwards · drawConversions). 이전 명세의 월별 값만 오면 null */
  totals: { visits: number | null; stampAwards: number | null; drawConversions: number | null } | null;
  months: {
    month: string;
    state: 'CLOSED' | 'IN_PROGRESS' | 'SCHEDULED';
    stampCount: number | null;
    /** 여기서 완주 (10번째 스탬프를 이 매장에서) */
    completionCount: number | null;
    aggregatedUntil: string | null;
  }[];
}

/* ───────── QR 인증 통계 ───────── */

export type StatsPeriod = '7' | '30' | '90';

export interface DailyVisit {
  date: string;
  count: number;
}

/** 응답에 없는 지표는 null (0 으로 채우지 않아요) */
export interface VisitSummary {
  qrVisitCount: number | null;
  /** 인증한 보호자 수 */
  guardianCount: number | null;
  dailyAverage: number | null;
  stampCount: number | null;
}

export interface VisitStats {
  from: string;
  to: string;
  daily: DailyVisit[];
  /** 선택 기간 요약 */
  summary: VisitSummary;
  /** 같은 길이의 직전 기간 (불러오지 못하면 null) */
  previous: (VisitSummary & { from: string; to: string }) | null;
  /** 직전 같은 기간 대비 증감률 (%) */
  /** 0~23시 QR 인증 수 (기록이 없어도 0) */
  byHour: { hour: number; count: number }[] | null;
}

/* ───────── 문의 ───────── */

export const INQUIRY_TYPES = ['입장 조건', '이벤트 · 광고', 'QR · 방문 인증', '가입 · 계정', '기타'] as const;
export type InquiryType = (typeof INQUIRY_TYPES)[number];

/** 관련 신청 — F-WREQ-01 items[] 의 종류와 ID */
export interface RelatedRequest {
  kind: 'CONDITION' | 'EVENT_AD';
  /** 신청 종류 — 같은 숫자 ID 의 이벤트 · 광고 신청을 구분해요 */
  appKind?: 'EVENT' | 'AD';
  id: string;
}

/** F-WQNA-02 내 문의 한 건 */
export interface Inquiry {
  id: string;
  /** 문의 유형 — 값 목록은 명세 [확인 필요] (원본 34) */
  type: string;
  title: string | null;
  content: string;
  relatedRequest: RelatedRequest | null;
  status: 'WAITING' | 'ANSWERED';
  submittedAt: string;
  /** 답변 0~1개 (answers[0]) */
  answer: { content: string; answeredAt: string } | null;
}

/** F-WQNA-01 문의 보내기 */
export interface NewInquiry {
  type: InquiryType;
  relatedRequest: RelatedRequest | null;
  title: string;
  content: string;
  /** 관련 매장 — 승인 전 계정은 매장이 없어 null */
  placeId: string | null;
}

/** F-WQNA-03 자주 묻는 질문 */
export interface Faq {
  question: string;
  answer: string;
}

/* ───────── 계정 · 가입 ───────── */

export interface Account {
  name: string;
  /** 로그인 아이디 (서버 F-WACC-01 응답에는 없어서 로그인 세션 값을 써요) */
  loginId: string;
  phone: string;
  /** 연결된 업체 수. 내 프로필 조회 응답에 없으면 null (0 으로 채우지 않아요) */
  stores: { total: number; approved: number; pending: number } | null;
}

export interface SignupStatus {
  /** 업체 인증 요청 ID — 수정(F-WAUTH-12)에 써요 */
  verificationId: string;
  status: RequestStatus;
  submittedAt: string;
  approvedAt: string | null;
  lastSubmittedAt: string;
  /** [수정하기] · [보완하기] · [다시 신청하기] 표시 (서버가 정해요, F-WAUTH-11) */
  canEdit: boolean;
  canResubmit: boolean;
  canReapply: boolean;
  info: { label: string; value: string }[];
  /** 보완 요청 · 반려 사유 */
  reason?: string;
  licenseFile: { fileName: string; url: string } | null;
  /** 업종 — 서버 값 CAFE · RESTAURANT. 예전 데이터처럼 값이 없으면 null */
  category: BusinessCategory | null;
  /** 수정 · 보완 화면에 채워 둘 값 */
  form: { bizNo: string; name: string; area: string; category: BusinessCategory | ''; zip: string; line1: string; line2: string };
}

/** 업종 (업체 인증 F-WAUTH-10 · 운영자 매장 등록 F-OPLACE-02 와 같은 값) */
export type BusinessCategory = 'CAFE' | 'RESTAURANT';
export const BUSINESS_CATEGORY_LABEL: Record<BusinessCategory, string> = { CAFE: '카페', RESTAURANT: '음식점' };

/** F-WAUTH-01 업체용 약관 */
export interface Term {
  /** 화면용 약관 ID (서버 termId 를 문자열로) */
  code: string;
  /** 서버로 보낼 약관 ID — 서버가 준 값 그대로 (숫자면 숫자) */
  termId?: string | number;
  title: string;
  required: boolean;
  version: string;
  /** 약관 본문 주소. 응답에 없으면 null — [보기]를 숨겨요 */
  url: string | null;
}

export interface BusinessLookup {
  valid: boolean;
  message: string;
}
