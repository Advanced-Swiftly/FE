import { paginate, type Page } from '@/hooks/useCursorList';
import { MOCK_APPLY_REVIEWS, MOCK_POLICY_REVIEWS, MOCK_PROCESSED_TODAY, MOCK_QUEUE, MOCK_SOURCE_TEXT, MOCK_TODAY } from '@/mocks/queue';
import { MOCK_PLACE_CONDITIONS, MOCK_PLACES } from '@/mocks/stores';
import { SAMPLE_DOGS } from '@/mocks/testDogs';
import type {
  ApplicationAction,
  ApplyReview,
  ConditionAction,
  ConditionField,
  ConditionState,
  Decision,
  PlaceConditions,
  PolicyReview,
  ProposalField,
  QueueItem,
  QueueStatus,
  QueueSummary,
  UnrestrictableField,
  VerdictPreview,
} from '@/types';
import { CONDITION_FIELDS, changedFields, fieldState, isUnrestrictable, judge } from '@/utils/conditions';
import { daysSince, formatDate } from '@/utils/format';
import { apiClient, mockResponse, USE_MOCK } from './client';
import { mockError } from './errors';
import { toId, toStoreId, type RawId } from './ids';

// 명세 F-OREV-01 ~ 06 · F-OAPP-01 · 02 (제출본 6.2.2 · 6.2.3절).
// 정책 · 변경 요청과 이벤트 · 광고 신청은 API 가 달라서 함수를 나눴어요. ID 모양으로 고르지 않아요.
// 서버 응답(DTO) → 화면 타입 변환은 이 파일에서만 하고, 목업도 같은 DTO 를 만들어 같은 변환을 거쳐요.

const enc = encodeURIComponent;
let processedToday = MOCK_PROCESSED_TODAY;

// ─── 검토 대기열 목록 (F-OREV-02) ─────────────────────

/** 유형 탭 (명세 값 이름) */
export type QueueTab = 'AI_CANDIDATE' | 'BUSINESS_CHANGE' | 'EVENT_AD' | 'NEEDS_INFO';

export interface QueueItemDto {
  /** 명세 예시: CONDITION_REQUEST · AD_APPLICATION. AI 후보 · 참여 신청의 값 이름은 [확인 필요] */
  kind: 'CONDITION_REQUEST' | 'AI_CANDIDATE' | 'AD_APPLICATION' | 'EVENT_APPLICATION';
  /** 문자 · 숫자 모두 받아요 */
  requestId?: RawId;
  applicationId?: RawId;
  /** 매장 ID — 이전 명세 placeId · API 문서 storeId */
  placeId?: RawId;
  storeId?: RawId;
  placeName: string;
  status: QueueStatus;
  submittedAt: string;
  /** 아래는 명세 응답에 없어요 ([확인 필요]) — 오면 보여 주고, 없으면 빈 칸 */
  region?: string;
  category?: string;
  summary?: string;
  evidence?: string;
}

const KIND_TYPE: Record<QueueItemDto['kind'], QueueItem['type']> = {
  CONDITION_REQUEST: 'STORE_CHANGE',
  AI_CANDIDATE: 'AI_POLICY',
  AD_APPLICATION: 'AD',
  EVENT_APPLICATION: 'EVENT',
};
const TYPE_SUMMARY: Record<QueueItem['type'], string> = { STORE_CHANGE: '입장 조건 변경 요청', AI_POLICY: 'AI 정책 후보', AD: '지도 추천 노출 광고 신청', EVENT: '댕댕로드 참여 신청' };

function toQueueItem(d: QueueItemDto): QueueItem {
  const type = KIND_TYPE[d.kind];
  return {
    id: toId(d.requestId) ?? toId(d.applicationId) ?? '',
    type,
    storeId: toStoreId(d) ?? '',
    storeName: d.placeName,
    area: (d.region ?? '') as QueueItem['area'],
    category: d.category ?? '',
    summary: d.summary ?? TYPE_SUMMARY[type],
    evidence: d.evidence ?? '—',
    submittedAt: d.submittedAt,
    status: d.status,
  };
}

function mockMatches(q: QueueItemDto, tab: QueueTab) {
  if (tab === 'NEEDS_INFO') return q.status === 'NEEDS_INFO';
  if (q.status === 'NEEDS_INFO') return false;
  if (tab === 'EVENT_AD') return q.kind === 'AD_APPLICATION' || q.kind === 'EVENT_APPLICATION';
  return tab === 'AI_CANDIDATE' ? q.kind === 'AI_CANDIDATE' : q.kind === 'CONDITION_REQUEST';
}

/** F-OREV-02 검토 대기열 한 페이지 */
export async function getQueuePage(opts: { tab: QueueTab; q?: string; region?: string; cursor: string | null; limit?: number }): Promise<Page<QueueItem>> {
  const limit = opts.limit ?? 20;
  let dto: { items: QueueItemDto[]; nextCursor: string | null };
  if (USE_MOCK) {
    const rows = MOCK_QUEUE.filter((q) => mockMatches(q, opts.tab))
      .filter((q) => !opts.q?.trim() || q.placeName.includes(opts.q.trim()))
      .filter((q) => !opts.region || q.region === opts.region);
    dto = await mockResponse(paginate(rows, opts.cursor, limit));
  } else {
    return serverQueuePage(opts.tab, opts.q, opts.cursor);
  }
  return { items: dto.items.map(toQueueItem), nextCursor: dto.nextCursor };
}

// ─── 서버 모드 대기열 — 실제 BE 에는 통합 대기열 API 가 없어 종류별 목록을 합쳐요 ───
// - 입장 조건 요청: GET /admin/condition-requests?kind&status&page → { items: [{ requestId, storeId, kind, status, createdAt }] }
// - 이벤트 참여 신청: GET /admin/event-applications?status&page → { items: [{ applicationId, storeId, storeName, eventId, regionIds, status, createdAt }] }
// - 광고 신청: GET /admin/ad-applications?status&page → { items: [{ applicationId, storeId, storeName, adType, startDate, endDate, status, createdAt }] }
// 목록은 20건씩(page 1부터)이라 '더 보기'는 다음 page 를 불러요. 대기 상태(접수 · 검토 중)는 page 안에서 걸러요.

const BE_PAGE_SIZE = 20;
type CondListDto = { requestId: RawId; storeId?: RawId; kind?: string; status?: string; createdAt?: string | null };
type EventAppListDto = { applicationId: RawId; storeId?: RawId; storeName?: string | null; eventId?: RawId; regionIds?: RawId[] | null; status?: string; createdAt?: string | null };
type AdAppListDto = { applicationId: RawId; storeId?: RawId; storeName?: string | null; adType?: string | null; startDate?: string | null; endDate?: string | null; status?: string; createdAt?: string | null };

const AD_TYPE_LABEL: Record<string, string> = { RECOMMENDED: '지도 추천 노출', BANNER: '배너' };
/** BE 의 보완 요청 상태(조건 NEEDS_SUPPLEMENT · 신청 NEEDS_INFO)를 화면 상태 하나로 */
const toQueueStatus = (s: string | undefined): QueueStatus | null =>
  s === 'RECEIVED' || s === 'IN_REVIEW' ? s : s === 'NEEDS_SUPPLEMENT' || s === 'NEEDS_INFO' ? 'NEEDS_INFO' : null;

const storeNameCache = new Map<string, Promise<string | null>>();
/** 조건 요청 목록에는 업체명이 없어 업체 상세(GET /admin/stores/{storeId})에서 이름만 가져와요 (실패하면 null) */
export function adminStoreName(storeId: string): Promise<string | null> {
  let p = storeNameCache.get(storeId);
  if (!p) {
    p = apiClient
      .get<{ name?: string | null }>(`/admin/stores/${enc(storeId)}`)
      .then((r) => r.data?.name ?? null)
      .catch(() => {
        storeNameCache.delete(storeId);
        return null;
      });
    storeNameCache.set(storeId, p);
  }
  return p;
}

async function serverQueuePage(tab: QueueTab, q: string | undefined, cursor: string | null): Promise<Page<QueueItem>> {
  const pageNo = cursor ? Number(cursor) : 1;
  const needsInfo = tab === 'NEEDS_INFO';
  const wantCond = tab === 'BUSINESS_CHANGE' || tab === 'AI_CANDIDATE' || needsInfo;
  const wantApps = tab === 'EVENT_AD' || needsInfo;
  const condKind = tab === 'AI_CANDIDATE' ? 'AI_CANDIDATE' : tab === 'BUSINESS_CHANGE' ? 'CONDITION_REQUEST' : undefined;
  // 처리 끝난 건이 많아도 첫 페이지가 비지 않게, 대기 상태(접수 · 검토 중 / 보완 대기)별로 서버에서 걸러 받아요
  let full = false;
  const byStatus = async <T,>(path: string, statuses: string[], extra: Record<string, string | undefined> = {}): Promise<T[]> => {
    const lists = await Promise.all(statuses.map((status) => apiClient.get<{ items?: T[] | null }>(path, { params: { ...extra, status, page: pageNo } }).then((r) => r.data?.items ?? [])));
    if (lists.some((l) => l.length >= BE_PAGE_SIZE)) full = true;
    return lists.flat();
  };
  const waiting = ['RECEIVED', 'IN_REVIEW'];
  const [cond, events, ads] = await Promise.all([
    wantCond ? byStatus<CondListDto>('/admin/condition-requests', needsInfo ? ['NEEDS_SUPPLEMENT'] : waiting, { kind: condKind }) : Promise.resolve([] as CondListDto[]),
    wantApps ? byStatus<EventAppListDto>('/admin/event-applications', needsInfo ? ['NEEDS_INFO'] : waiting) : Promise.resolve([] as EventAppListDto[]),
    wantApps ? byStatus<AdAppListDto>('/admin/ad-applications', needsInfo ? ['NEEDS_INFO'] : waiting) : Promise.resolve([] as AdAppListDto[]),
  ]);
  const keep = (st: QueueStatus | null): st is QueueStatus => st !== null && (needsInfo ? st === 'NEEDS_INFO' : st !== 'NEEDS_INFO');
  const names = await Promise.all(cond.map((c) => (toId(c.storeId) ? adminStoreName(toId(c.storeId) as string) : Promise.resolve(null))));
  const rows: QueueItem[] = [];
  cond.forEach((c, i) => {
    const st = toQueueStatus(c.status);
    const id = toId(c.requestId);
    if (!id || !keep(st)) return;
    const ai = c.kind === 'AI_CANDIDATE';
    const storeId = toId(c.storeId) ?? '';
    rows.push({ id, type: ai ? 'AI_POLICY' : 'STORE_CHANGE', storeId, storeName: names[i] ?? (storeId ? `업체 ${storeId}` : ''), area: '' as QueueItem['area'], category: '', summary: c.kind === 'RECHECK' ? '조건 재확인 요청' : ai ? 'AI 정책 후보' : '입장 조건 변경 요청', evidence: '—', submittedAt: c.createdAt ?? '', status: st });
  });
  events.forEach((a) => {
    const st = toQueueStatus(a.status);
    const id = toId(a.applicationId);
    if (!id || !keep(st)) return;
    rows.push({ id, type: 'EVENT', storeId: toId(a.storeId) ?? '', storeName: a.storeName ?? '', area: '' as QueueItem['area'], category: '', summary: `댕댕로드 참여 신청${toId(a.eventId) ? ` · 이벤트 ${toId(a.eventId)}` : ''}`, evidence: '—', submittedAt: a.createdAt ?? '', status: st });
  });
  ads.forEach((a) => {
    const st = toQueueStatus(a.status);
    const id = toId(a.applicationId);
    if (!id || !keep(st)) return;
    rows.push({ id, type: 'AD', storeId: toId(a.storeId) ?? '', storeName: a.storeName ?? '', area: '' as QueueItem['area'], category: '', summary: `광고 신청 · ${AD_TYPE_LABEL[a.adType ?? ''] ?? a.adType ?? ''}`, evidence: a.startDate && a.endDate ? `${formatDate(a.startDate)} – ${formatDate(a.endDate)}` : '—', submittedAt: a.createdAt ?? '', status: st });
  });
  const word = q?.trim();
  const items = word ? rows.filter((r) => r.storeName.includes(word)) : rows;
  return { items, nextCursor: full ? String(pageNo + 1) : null };
}

/** F-OREV-01 대기열 요약 (badgeCount 는 사이드바가 따로 써요) */
export async function getQueueSummary(): Promise<QueueSummary> {
  let dto: { waiting: number; processedToday: number; avgProcessingDays: number | null; stalePlaces: number; badgeCount?: number };
  if (USE_MOCK) {
    const today = new Date(`${MOCK_TODAY}T12:00:00+09:00`);
    const waiting = MOCK_QUEUE.filter((q) => q.status !== 'NEEDS_INFO').length;
    dto = await mockResponse({
      waiting,
      processedToday,
      avgProcessingDays: 1.6,
      stalePlaces: MOCK_PLACES.filter((s) => s.stale || (s.conditionCheckedAt != null && daysSince(s.conditionCheckedAt, today) > 30)).length,
      badgeCount: waiting,
    });
  } else {
    // 운영자 대시보드 요약 — GET /admin/dashboard/summary → { pendingBusinessVerifications, pendingConditionRequests, activeStores, totalVisits }
    // 응답이 주는 지표만 써요: 검토 대기 = 조건 요청 대기. 오늘 처리 · 평균 처리 기간 · 확인일 지난 업체 · 배지는 없어 null
    const { data } = await apiClient.get<{ pendingConditionRequests?: number | null }>('/admin/dashboard/summary');
    const n = typeof data?.pendingConditionRequests === 'number' ? data.pendingConditionRequests : null;
    return { waiting: n, processedToday: null, avgDays: null, staleStores: null, badgeCount: null };
  }
  return { waiting: dto.waiting, processedToday: dto.processedToday, avgDays: dto.avgProcessingDays ?? null, staleStores: dto.stalePlaces, badgeCount: dto.badgeCount ?? null };
}

// ─── 정책 후보 · 업체 변경 요청 (F-OREV-03 ~ 06) ──────

type ProposalEntryDto = {
  originalValue: PlaceConditions[ConditionField];
  originalUnrestricted?: boolean;
  value: PlaceConditions[ConditionField];
  unrestricted?: boolean;
  edited: boolean;
};
export interface ConditionReviewDto {
  /** 문자 · 숫자 모두 받아요 */
  requestId: RawId;
  kind: 'CONDITION_REQUEST' | 'AI_CANDIDATE';
  /** 매장 ID — 이전 명세 placeId · API 문서 storeId */
  placeId?: RawId;
  storeId?: RawId;
  placeName: string;
  status: QueueStatus | 'APPROVED' | 'REJECTED' | 'CANCELED';
  submittedAt: string;
  baseChanged?: boolean;
  allowedActions?: ConditionAction[];
  source: { links: string[]; files: { fileName: string; url: string }[]; collectedAt: string | null };
  currentConditions: Partial<PlaceConditions>;
  currentUnrestrictedFields?: string[];
  proposal: Partial<Record<ConditionField, ProposalEntryDto>>;
  boundaryWarnings: string[];
  /** 백엔드 API 문서 상세 필드 — 근거 URL. requestedPolicy 는 구조가 확정되지 않아 화면 변경안으로 해석하지 않아요 */
  evidenceUrls?: string[] | null;
  requestedPolicy?: unknown;
  baseVersion?: number | null;
}

const EMPTY: PlaceConditions = { petAllowed: null, weightLimitKg: null, sizeLimit: null, restrictedBreeds: null, area: null, requiredItems: null, vaccinationRequired: null };
const toUnrestricted = (list: string[] | undefined) => (list ?? []).filter((f): f is UnrestrictableField => isUnrestrictable(f as ConditionField));

function toPolicyReview(d: ConditionReviewDto): PolicyReview {
  // 상세 응답에 source · proposal · 현재 조건이 없어도 화면이 멈추지 않게 빈 값으로 받아요 (빈 변경안은 승인 버튼이 막혀요)
  const src = d.source ?? { links: [], files: [], collectedAt: null };
  const files = Array.isArray(src.files) ? src.files : [];
  const links = [...(Array.isArray(src.links) ? src.links : []), ...(Array.isArray(d.evidenceUrls) ? d.evidenceUrls : [])];
  const current: ConditionState = { conditions: { ...EMPTY, ...(d.currentConditions ?? {}) }, unrestrictedFields: toUnrestricted(d.currentUnrestrictedFields) };
  const proposal: ConditionState = { conditions: { ...current.conditions }, unrestrictedFields: [...current.unrestrictedFields] };
  const fields: ProposalField[] = [];
  const proposalDto = d.proposal ?? {};
  (Object.keys(proposalDto) as ConditionField[]).forEach((f) => {
    const e = proposalDto[f];
    if (!e) return;
    const unrestricted = Boolean(e.unrestricted) && isUnrestrictable(f);
    (proposal.conditions as unknown as Record<string, unknown>)[f] = unrestricted ? null : e.value;
    proposal.unrestrictedFields = proposal.unrestrictedFields.filter((x) => x !== f);
    if (unrestricted) proposal.unrestrictedFields.push(f as UnrestrictableField);
    const same = !changedFields(current, proposal).includes(f);
    fields.push({
      field: f,
      status: e.value === null && !unrestricted ? 'KEEP_UNKNOWN' : same ? 'SAME' : current.conditions[f] === null ? 'NEW' : 'CHANGED',
      originalValue: e.originalValue,
      originalUnrestricted: Boolean(e.originalUnrestricted),
      edited: e.edited,
    });
  });
  const isAi = d.kind === 'AI_CANDIDATE';
  return {
    id: toId(d.requestId) ?? '',
    type: isAi ? 'AI_POLICY' : 'STORE_CHANGE',
    // 처리 끝난 건(APPROVED · REJECTED · CANCELED)도 서버 상태 그대로 보여 줘요
    status: d.status,
    storeId: toStoreId(d) ?? '',
    storeName: d.placeName ?? '',
    title: isAi ? 'AI 정책 후보' : '입장 조건 변경 요청',
    submittedAt: d.submittedAt ? formatDate(d.submittedAt) : '—',
    requester: isAi ? 'AI 정책 수집' : d.placeName ? `${d.placeName} 업체 관리자` : '업체 관리자',
    baseChanged: Boolean(d.baseChanged),
    // 서버가 허용 작업을 주지 않으면 아무 처리도 열지 않아요 (명세상 필수 응답)
    allowedActions: d.allowedActions ?? [],
    source: {
      fileName: files[0]?.fileName,
      fileUrl: files[0]?.url,
      files,
      text: [],
      links,
      meta: src.collectedAt ? `수집 ${formatDate(src.collectedAt)}` : '업체 제출',
    },
    warnings: [...(d.boundaryWarnings ?? [])],
    current,
    proposal,
    fields,
    checkedAt: '—',
    // 처리 이력은 업체 상세의 처리 이력(F-OPLACE-08)에서 봐요 (F-OREV-03 응답에 없음)
    history: [],
  };
}

function mockAllowedForCondition(d: ConditionReviewDto): ConditionAction[] {
  if (d.status === 'RECEIVED') return ['START_REVIEW'];
  if (d.status !== 'IN_REVIEW') return [];
  const base: ConditionAction[] = d.kind === 'AI_CANDIDATE' ? ['EDIT_PROPOSAL', 'APPROVE', 'REJECT'] : ['APPROVE', 'REQUEST_SUPPLEMENT', 'REJECT'];
  return d.baseChanged ? base.filter((a) => a !== 'APPROVE') : base;
}

function mockConditionDto(id: string): ConditionReviewDto {
  const full = MOCK_POLICY_REVIEWS[id];
  if (full) return full;
  // 상세 예시가 없는 건은 대기열 줄로 만들어요.
  const item = MOCK_QUEUE.find((q) => q.requestId === id);
  if (!item || (item.kind !== 'AI_CANDIDATE' && item.kind !== 'CONDITION_REQUEST')) throw mockError('NOT_FOUND');
  const dto: ConditionReviewDto = {
    requestId: id,
    kind: item.kind,
    placeId: item.placeId,
    placeName: item.placeName,
    status: item.status,
    submittedAt: item.submittedAt,
    baseChanged: false,
    source: { links: [], files: [], collectedAt: item.kind === 'AI_CANDIDATE' ? item.submittedAt.slice(0, 10) : null },
    currentConditions: {},
    currentUnrestrictedFields: [],
    proposal: {},
    boundaryWarnings: [],
  };
  dto.allowedActions = mockAllowedForCondition(dto);
  return (MOCK_POLICY_REVIEWS[id] = dto);
}

async function mockConditionResponse(id: string) {
  const dto = mockConditionDto(id);
  dto.allowedActions = mockAllowedForCondition(dto);
  const r = toPolicyReview(await mockResponse(dto));
  // 원문 강조는 명세 응답에 없어 목업에서만 덧붙여요 (OR-14)
  r.source.text = MOCK_SOURCE_TEXT[id] ?? [];
  return r;
}

/** F-OREV-03 정책 후보 · 변경 요청 상세 */
export async function getConditionReview(id: string): Promise<PolicyReview> {
  if (USE_MOCK) return mockConditionResponse(id);
  const { data } = await apiClient.get<ConditionReviewDto>(`/admin/condition-requests/${enc(id)}`);
  return toPolicyReview(data);
}

/**
 * 변경안에서 바뀐 항목만 서버 모양으로 (F-OREV-04 · 05, 5.2절 규칙 3 · 4)
 * - proposal[f] = 값 (제한 있음) 또는 null (미확인)
 * - unrestrictedFields = 이번에 제한 없음으로 바꾼 필드
 */
export function proposalBody(base: ConditionState, next: ConditionState) {
  const proposal: Partial<Record<ConditionField, PlaceConditions[ConditionField]>> = {};
  const unrestrictedFields: UnrestrictableField[] = [];
  changedFields(base, next).forEach((f) => {
    const st = fieldState(next, f);
    if (st === 'UNRESTRICTED' && isUnrestrictable(f)) unrestrictedFields.push(f);
    else proposal[f] = st === 'UNKNOWN' ? null : next.conditions[f];
  });
  return { proposal, unrestrictedFields };
}

/** F-OREV-04 AI 구조화 값 직접 수정 — 바꾼 항목만 보내요. 승인 전에는 입장 조건이 바뀌지 않아요. */
export async function saveProposal(id: string, saved: ConditionState, next: ConditionState): Promise<PolicyReview> {
  const body = proposalBody(saved, next);
  if (USE_MOCK) {
    const d = mockConditionDto(id);
    if (d.kind !== 'AI_CANDIDATE') throw mockError('OPERATOR_EDIT_NOT_ALLOWED');
    if (d.status !== 'IN_REVIEW') throw mockError('REQUEST_STATE_CONFLICT');
    (Object.keys(body.proposal) as ConditionField[]).forEach((f) => {
      const prev = d.proposal[f];
      d.proposal[f] = { originalValue: prev?.originalValue ?? null, originalUnrestricted: prev?.originalUnrestricted ?? false, value: body.proposal[f] ?? null, unrestricted: false, edited: true };
    });
    body.unrestrictedFields.forEach((f) => {
      const prev = d.proposal[f];
      d.proposal[f] = { originalValue: prev?.originalValue ?? null, originalUnrestricted: prev?.originalUnrestricted ?? false, value: null, unrestricted: true, edited: true };
    });
    return mockConditionResponse(id);
  }
  const { data } = await apiClient.patch<ConditionReviewDto>(`/admin/condition-requests/${enc(id)}/proposal`, body);
  return toPolicyReview(data);
}

/**
 * F-OREV-05 판정 영향 미리보기. draft 를 주면 저장하지 않은 변경안으로 계산해요.
 * 응답은 F-WREQ-07 과 같은 모양 (testDogId · label · before · after)
 */
export async function previewConditionReview(id: string, current: ConditionState, saved: ConditionState, draft?: ConditionState): Promise<VerdictPreview[]> {
  const body = draft ? proposalBody(saved, draft) : {};
  let dogs: { testDogId: string; label: string; before: VerdictPreview['before']; after: VerdictPreview['after'] }[];
  if (USE_MOCK) {
    mockConditionDto(id);
    const after = draft ?? saved;
    dogs = (await mockResponse({ dogs: SAMPLE_DOGS.map((dog) => ({ testDogId: dog.id, label: dog.label, before: judge(current, dog), after: judge(after, dog) })) }, 250)).dogs;
  } else {
    dogs = (await apiClient.post<{ dogs: typeof dogs }>(`/admin/condition-requests/${enc(id)}/preview`, body)).data.dogs;
  }
  return dogs.map((d) => ({ dogId: d.testDogId, label: d.label, before: d.before, after: d.after }));
}

const CONDITION_RESULT: Record<Decision, 'APPROVE' | 'REQUEST_SUPPLEMENT' | 'REJECT'> = { APPROVE: 'APPROVE', REVISE: 'REQUEST_SUPPLEMENT', REJECT: 'REJECT' };

function mockQueueAfterDecision(id: string, nextStatus: 'IN_REVIEW' | 'NEEDS_INFO' | 'DONE') {
  const idx = MOCK_QUEUE.findIndex((q) => (q.requestId ?? q.applicationId) === id);
  if (idx < 0) return;
  if (nextStatus === 'DONE') {
    MOCK_QUEUE.splice(idx, 1);
    Object.values(MOCK_PLACE_CONDITIONS).forEach((c) => {
      c.pendingRequests = (c.pendingRequests ?? []).filter((p) => p.requestId !== id);
    });
    processedToday += 1;
  } else {
    MOCK_QUEUE[idx] = { ...MOCK_QUEUE[idx], status: nextStatus, ...(nextStatus === 'NEEDS_INFO' ? { evidence: `${MOCK_TODAY.slice(5).replace('-', '.')} 보완 요청함` } : {}) };
    if (nextStatus === 'NEEDS_INFO') processedToday += 1;
  }
}

/** [검토 시작] 정책 · 변경 요청 — F-OREV-06 result=START_REVIEW (상세를 여는 것만으로는 바뀌지 않아요) */
export async function startConditionReview(id: string): Promise<void> {
  if (USE_MOCK) {
    const d = mockConditionDto(id);
    if (d.status !== 'RECEIVED') throw mockError('REQUEST_STATE_CONFLICT', { status: d.status });
    d.status = 'IN_REVIEW';
    mockQueueAfterDecision(id, 'IN_REVIEW');
    await mockResponse(null, 300);
    return;
  }
  // 입장 조건 심사 처리 — PATCH /admin/condition-requests/{requestId} { action }
  await apiClient.patch(`/admin/condition-requests/${enc(id)}`, { action: 'START_REVIEW' });
}

/** 화면 처리 → 백엔드 API action (보완 요청은 NEEDS_INFO) */
const CONDITION_ACTION: Record<Decision, 'APPROVE' | 'NEEDS_INFO' | 'REJECT'> = { APPROVE: 'APPROVE', REVISE: 'NEEDS_INFO', REJECT: 'REJECT' };

/**
 * F-OREV-06 정책 · 변경 요청 처리 — 본문 { result, reason }.
 * reason 은 업체에 보이는 사유(보완 요청 · 반려 때 필수, 1~200자)예요. 내부 메모는 받지 않아요 (운영 메모는 F-OPLACE-06).
 */
/** F-OREV-06 응답 중 화면이 쓰는 값 — 승인일(conditionCheckedAt)은 승인 때만 와요 */
export interface ConditionDecisionResult {
  status: string;
  conditionCheckedAt: string | null;
}

export async function decideConditionRequest(id: string, decision: Decision, reason: string): Promise<ConditionDecisionResult> {
  const result = CONDITION_RESULT[decision];
  const body = result === 'APPROVE' ? { result } : { result, reason: reason.trim() };
  if (USE_MOCK) {
    const d = mockConditionDto(id);
    if (d.status !== 'IN_REVIEW') throw mockError('REQUEST_STATE_CONFLICT', { status: d.status });
    if (result === 'REQUEST_SUPPLEMENT' && d.kind === 'AI_CANDIDATE') throw mockError('ACTION_NOT_ALLOWED_FOR_KIND');
    if (result !== 'APPROVE' && !body.reason) throw mockError('VALIDATION_ERROR', { field: 'reason' });
    d.status = result === 'APPROVE' ? 'APPROVED' : result === 'REJECT' ? 'REJECTED' : 'NEEDS_INFO';
    mockQueueAfterDecision(id, result === 'REQUEST_SUPPLEMENT' ? 'NEEDS_INFO' : 'DONE');
    return mockResponse({ status: d.status, conditionCheckedAt: result === 'APPROVE' ? MOCK_TODAY : null }, 400);
  }
  // 입장 조건 심사 처리 — PATCH /admin/condition-requests/{requestId} { action, reviewComment? }
  // approvedPolicy(최종 승인 정책)는 정책 구조가 확정되지 않아 보내지 않아요 — 서버가 요청 정책 그대로 승인 (백엔드 확인 사항)
  const action = CONDITION_ACTION[decision];
  const patchBody = action === 'APPROVE' ? { action } : { action, reviewComment: reason.trim() };
  const { data } = await apiClient.patch<{ status?: string; conditionCheckedAt?: string | null; appliedPolicyVersion?: number | null }>(`/admin/condition-requests/${enc(id)}`, patchBody);
  return { status: data?.status ?? '', conditionCheckedAt: data?.conditionCheckedAt ?? null };
}

// ─── 이벤트 · 광고 신청 (F-OAPP-01 · 02) ──────────────

type CheckDto = { code: string; passed: boolean; detail?: { checkedDate?: string | null; daysSince?: number | null; reason?: string } | null };
export interface ApplicationReviewDto {
  applicationId: string | number;
  type?: 'STAMP_ROAD' | 'AD';
  placeId?: string | number;
  placeName?: string;
  /** API 문서: 이벤트 신청 상세 { applicationId, store: { storeId, name }, regionIds } · 광고 { applicationId, adType, creativeUrl } */
  store?: { storeId: string | number; name?: string } | null;
  regionIds?: (string | number)[] | null;
  adType?: string | null;
  creativeUrl?: string | null;
  status?: string;
  displayStatus?: string;
  submittedAt?: string;
  reviewStartedAt?: string | null;
  stampRoad?: {
    eventId: string;
    periodId: string;
    title: string;
    regions: string[];
    recruitment: { startAt: string; endAt: string };
    intro: string;
    qrPledgeAgreed: boolean;
    recruitmentStatus: { applicationCount: number; approvedCount: number };
  };
  ad?: { region: string; startDate: string; weeks: number; endDate: string };
  checks?: CheckDto[];
  checkedAt?: string | null;
  eligibilityAtSubmit?: { code: string; passed: boolean }[];
  introCheck?: { length: number; maxLength: number; passed: boolean };
  allowedActions?: ApplicationAction[];
  prevApplicationId?: string | null;
  nextApplicationId?: string | null;
}

/** 신청 종류 — 이벤트 참여(EVENT) · 광고(AD). 서버 경로를 고를 때 꼭 함께 써요 */
export type ApplicationKind = 'EVENT' | 'AD';
const appBase = (kind: ApplicationKind) => (kind === 'AD' ? '/admin/ad-applications' : '/admin/event-applications');

function toApplyReview(d: ApplicationReviewDto, kind?: ApplicationKind): ApplyReview {
  return {
    id: toId(d.applicationId) ?? '',
    type: d.type ?? (kind === 'AD' ? 'AD' : 'STAMP_ROAD'),
    storeId: toId(d.placeId) ?? toId(d.store?.storeId) ?? '',
    storeName: d.placeName ?? d.store?.name ?? '',
    status: d.status ?? '',
    displayStatus: d.displayStatus ?? null,
    submittedAt: d.submittedAt ?? '',
    reviewStartedAt: d.reviewStartedAt ?? null,
    stampRoad: d.stampRoad ?? null,
    ad: d.ad ?? null,
    checks: (d.checks ?? []).map((c) => ({ code: c.code, passed: c.passed, detail: c.detail ?? null })),
    checkedAt: d.checkedAt ?? null,
    eligibilityAtSubmit: d.eligibilityAtSubmit ?? [],
    introCheck: d.introCheck ?? null,
    // 서버가 허용 작업을 주지 않으면 아무 처리도 열지 않아요
    allowedActions: d.allowedActions ?? [],
    prevApplicationId: toId(d.prevApplicationId ?? null),
    nextApplicationId: toId(d.nextApplicationId ?? null),
  };
}

function mockApplicationDto(id: string): ApplicationReviewDto {
  const d = MOCK_APPLY_REVIEWS[id];
  if (!d) throw mockError('NOT_FOUND');
  return d;
}

/** 실제 BE 상태 → 운영자가 할 수 있는 처리 (ApplicationStatus.afterReview: 접수 → 검토 시작, 검토 중 → 승인 · 반려) */
function allowedByStatus(status: string | undefined): ApplicationAction[] {
  if (status === 'RECEIVED') return ['START_REVIEW'];
  if (status === 'IN_REVIEW') return ['APPROVE', 'REJECT'];
  return [];
}

let regionNames: Promise<Map<string, string>> | null = null;
/** 지역 이름 — GET /regions → { regions: [{ regionId, name }] } */
function getRegionNames() {
  regionNames ??= apiClient
    .get<{ regions?: { regionId: RawId; name: string }[] | null }>('/regions')
    .then((r) => new Map((r.data?.regions ?? []).flatMap((x) => (toId(x.regionId) ? [[toId(x.regionId) as string, x.name] as [string, string]] : []))))
    .catch(() => {
      regionNames = null;
      return new Map<string, string>();
    });
  return regionNames;
}

/**
 * 이벤트 참여 신청은 BE 에 운영자 상세 GET 이 없어서 목록(GET /admin/event-applications?page)에서 같은 신청 ID 를 찾아요.
 * 광고 신청 목록과 섞지 않아요 (경로가 달라 같은 숫자 ID 여도 다른 신청이에요).
 */
/** 이벤트 신청 목록을 마지막 페이지(20건 미만)까지 넘기며 같은 신청 ID 를 찾아요. 서버가 같은 페이지를 다시 주면 멈춰요 */
async function scanEventApplications(id: string, status?: string): Promise<EventAppListDto | null> {
  const seen = new Set<string>();
  for (let pageNo = 1; ; pageNo += 1) {
    const { data } = await apiClient.get<{ items?: EventAppListDto[] | null }>('/admin/event-applications', { params: { status, page: pageNo } });
    const items = data?.items ?? [];
    const hit = items.find((x) => toId(x.applicationId) === id);
    if (hit) return hit;
    const sig = items.map((x) => toId(x.applicationId)).join(',');
    if (items.length < BE_PAGE_SIZE || seen.has(sig)) return null;
    seen.add(sig);
  }
}

async function findEventApplication(id: string): Promise<EventAppListDto> {
  // 검토할 건은 대부분 대기 상태라 상태별 목록(짧아요)부터 찾고, 없으면 전체 목록을 끝까지 찾아요 (페이지 수 상한 없음).
  for (const status of ['RECEIVED', 'IN_REVIEW', 'NEEDS_INFO', undefined]) {
    const hit = await scanEventApplications(id, status);
    if (hit) return hit;
  }
  throw mockError('NOT_FOUND');
}

type AdAppDetailDto = AdAppListDto & { creativeUrl?: string | null; message?: string | null; reviewNote?: string | null; reviewedAt?: string | null };

async function serverApplicationReview(id: string, kind: ApplicationKind): Promise<ApplyReview> {
  const base = { prevApplicationId: null, nextApplicationId: null, checks: [], checkedAt: null, eligibilityAtSubmit: [], introCheck: null, stampRoad: null, ad: null, displayStatus: null, reviewStartedAt: null };
  if (kind === 'AD') {
    // 광고 신청 심사 상세 — GET /admin/ad-applications/{applicationId}
    const { data: d } = await apiClient.get<AdAppDetailDto>(`/admin/ad-applications/${enc(id)}`);
    return {
      ...base,
      id: toId(d.applicationId) ?? id,
      type: 'AD',
      storeId: toId(d.storeId) ?? '',
      storeName: d.storeName ?? '',
      status: d.status ?? '',
      submittedAt: d.createdAt ?? '',
      allowedActions: allowedByStatus(d.status),
      title: AD_TYPE_LABEL[d.adType ?? ''] ?? d.adType ?? '광고 신청',
      details: [
        { label: '광고 종류', value: AD_TYPE_LABEL[d.adType ?? ''] ?? d.adType ?? '—' },
        { label: '기간', value: d.startDate && d.endDate ? `${formatDate(d.startDate)} – ${formatDate(d.endDate)}` : '—' },
        { label: '광고 소재', value: d.creativeUrl ?? '—', href: d.creativeUrl ?? undefined },
        { label: '전달사항', value: d.message?.trim() || '—' },
        ...(d.reviewNote ? [{ label: '처리 사유', value: d.reviewNote }] : []),
      ],
    };
  }
  const [a, names] = await Promise.all([findEventApplication(id), getRegionNames()]);
  const regions = (a.regionIds ?? []).map((r) => toId(r)).filter((r): r is string => !!r);
  return {
    ...base,
    id: toId(a.applicationId) ?? id,
    type: 'STAMP_ROAD',
    storeId: toId(a.storeId) ?? '',
    storeName: a.storeName ?? '',
    status: a.status ?? '',
    submittedAt: a.createdAt ?? '',
    allowedActions: allowedByStatus(a.status),
    title: `이벤트 ${toId(a.eventId) ?? ''} 참여`,
    details: [
      { label: '이벤트', value: toId(a.eventId) ? `이벤트 ${toId(a.eventId)}` : '—' },
      { label: '참여 희망 지역', value: regions.length ? regions.map((r) => names.get(r) ?? `지역 ${r}`).join(' · ') : '—' },
    ],
    detailNote: '이벤트 참여 신청은 서버에 운영자 상세 조회가 없어 목록에 있는 값만 보여 줘요 (전달사항 · 이벤트 이름 없음).',
  };
}

/** F-OAPP-01 신청 상세 */
export async function getApplicationReview(id: string, kind?: ApplicationKind | null): Promise<ApplyReview> {
  if (USE_MOCK) return toApplyReview(await mockResponse(mockApplicationDto(id)));
  // 이벤트 · 광고 신청은 경로가 달라요 — 종류를 모르면 짐작하지 않아요
  if (!kind) throw mockError('FIELD_NOT_SUPPORTED', { field: 'type' });
  return serverApplicationReview(id, kind);
}

const APP_STATE_CONFLICT = 'APPLICATION_STATE_CONFLICT';

/**
 * F-OAPP-02 신청 처리 — 본문 { result, reason }. 참여 신청: START_REVIEW · APPROVE · REJECT, 광고: APPROVE · REJECT.
 * reason 은 반려 사유(업체에 보임)이고 반려 때만 보내요.
 */
export async function decideApplication(id: string, action: ApplicationAction, reason = '', kind?: ApplicationKind | null): Promise<{ nextApplicationId: string | null }> {
  const body = action === 'REJECT' ? { result: action, reason: reason.trim() } : { result: action };
  if (USE_MOCK) {
    const d = mockApplicationDto(id);
    if (!(d.allowedActions ?? []).includes(action)) throw mockError(APP_STATE_CONFLICT, { status: d.status });
    if (action === 'REJECT' && !body.reason) throw mockError('VALIDATION_ERROR', { field: 'reason' });
    if (action === 'START_REVIEW') {
      Object.assign(d, { status: 'IN_REVIEW', displayStatus: d.type === 'STAMP_ROAD' ? 'IN_REVIEW' : d.displayStatus, reviewStartedAt: new Date().toISOString(), allowedActions: ['APPROVE', 'REJECT'] });
      mockQueueAfterDecision(id, 'IN_REVIEW');
    } else {
      const status = action === 'APPROVE' ? 'APPROVED' : 'REJECTED';
      Object.assign(d, { status, displayStatus: d.type === 'STAMP_ROAD' ? status : d.displayStatus, allowedActions: [] });
      mockQueueAfterDecision(id, 'DONE');
    }
    return mockResponse({ nextApplicationId: d.nextApplicationId ?? null });
  }
  // 이벤트 · 광고 신청 심사 처리 — PATCH /admin/{event|ad}-applications/{applicationId} { action, comment? }
  if (!kind) throw mockError('FIELD_NOT_SUPPORTED', { field: 'type' });
  void body;
  const patchBody = action === 'REJECT' ? { action, comment: reason.trim() } : { action };
  // 응답은 { applicationId, status } 뿐이라 다음 신청 ID 는 없어요 (대기열로 돌아가요)
  await apiClient.patch<{ applicationId?: string | number; status?: string }>(`${appBase(kind)}/${enc(id)}`, patchBody);
  return { nextApplicationId: null };
}

/** 비교 표 행: 변경안이 다루는 항목 + 현재와 달라진 항목 */
export function reviewRows(r: Pick<PolicyReview, 'current' | 'fields'>, proposal: ConditionState) {
  const changed = changedFields(r.current, proposal);
  return CONDITION_FIELDS.filter((f) => changed.includes(f) || r.fields.some((x) => x.field === f));
}
