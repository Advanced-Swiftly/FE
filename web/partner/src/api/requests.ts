import { MOCK_CONDITIONS } from '@/mocks/conditions';
import { MOCK_REQUEST_DETAILS } from '@/mocks/requestDetails';
import { MOCK_AVG_PROCESSING_DAYS, MOCK_REQUESTS } from '@/mocks/requests';
import type { Attachment, ConditionField, ConditionRequestDetail, PartnerRequest, RequestChange, RequestHistory, RequestPage, RequestStatus } from '@/types';
import { apiClient, mockResponse, USE_MOCK } from './client';
import { mockError } from './errors';
import { toId, toStoreId, type RawId } from './ids';

// 명세 F-WREQ-01 · 04 · 05 (제출본 6.1.3절). 서버 응답(DTO) → 화면 타입 변환은 이 파일에서만 해요.

const enc = encodeURIComponent;

// ─── F-WREQ-01 요청 처리 현황 ────────────────────────

export interface RequestItemDto {
  type: 'CONDITION' | 'EVENT_AD';
  /** 목업 전용 — 신청 종류 (서버 목록은 API 경로로 알아요) */
  appKind?: 'EVENT' | 'AD';
  /** 종류에 따라 하나만 있어요 (문자 · 숫자) */
  requestId?: RawId;
  applicationId?: RawId;
  status: RequestStatus;
  group: 'IN_PROGRESS' | 'DONE';
  summaryText: string | null;
  submittedAt: string;
}
interface RequestListDto {
  summary: { inProgress: number; needsAction: number; done: number; avgProcessingDays: number | null };
  items: RequestItemDto[];
  nextCursor: string | null;
}

export type RequestTypeFilter = 'ALL' | 'CONDITION' | 'EVENT_AD';
export type RequestStatusFilter = 'ALL' | 'IN_PROGRESS' | 'DONE';

export function toRequestItem(d: RequestItemDto, storeId: string): PartnerRequest {
  return {
    id: toId(d.type === 'CONDITION' ? d.requestId : d.applicationId) ?? '',
    storeId,
    kind: d.type,
    appKind: d.appKind,
    status: d.status,
    group: d.group,
    summaryText: d.summaryText,
    submittedAt: d.submittedAt,
  };
}

type ListItemDto = { requestId?: RawId; applicationId?: RawId; status?: RequestStatus; kind?: string; eventId?: RawId; adType?: string; submittedAt?: string | null; createdAt?: string | null };

/**
 * 요청 처리 현황 — 세 목록 API 를 각각 불러요 (현재 매장 기준)
 * - 입장 조건 요청 목록: GET /business/stores/{storeId}/condition-requests
 * - 이벤트 신청 목록: GET /business/event-applications?storeId
 * - 광고 신청 목록: GET /business/ad-applications?storeId
 * 세 목록을 합친 전체 건수 · 정렬 · 다음 페이지 기준이 없어 첫 페이지만, 받은 순서대로 보여 주고 요약은 null 이에요.
 * 진행 중 · 완료 필터는 각 목록의 첫 페이지 안에서만 걸러요.
 */
async function getSplitRequestPage(storeId: string, type: RequestTypeFilter, status: RequestStatusFilter, cursor: string | null): Promise<RequestPage> {
  if (cursor) return { summary: null, items: [], nextCursor: null };
  const want = (k: 'CONDITION' | 'EVENT_AD') => type === 'ALL' || type === k;
  const [cond, events, ads] = await Promise.all([
    want('CONDITION') ? apiClient.get<{ items?: ListItemDto[] | null }>(`/business/stores/${enc(storeId)}/condition-requests`).then((r) => r.data?.items ?? []) : Promise.resolve([]),
    want('EVENT_AD') ? apiClient.get<{ items?: ListItemDto[] | null }>('/business/event-applications', { params: { storeId } }).then((r) => r.data?.items ?? []) : Promise.resolve([]),
    want('EVENT_AD') ? apiClient.get<{ items?: ListItemDto[] | null }>('/business/ad-applications', { params: { storeId } }).then((r) => r.data?.items ?? []) : Promise.resolve([]),
  ]);
  const IN_PROGRESS: RequestStatus[] = ['RECEIVED', 'IN_REVIEW', 'NEEDS_INFO'];
  const row = (d: ListItemDto, kind: 'CONDITION' | 'EVENT_AD', appKind?: 'EVENT' | 'AD'): PartnerRequest | null => {
    const id = toId(kind === 'CONDITION' ? d.requestId : d.applicationId);
    if (!id || !d.status) return null;
    const summaryText = appKind === 'EVENT' ? `댕댕로드 참여 신청${toId(d.eventId) ? ` · 이벤트 ${toId(d.eventId)}` : ''}` : appKind === 'AD' ? `광고 신청${d.adType ? ` · ${d.adType}` : ''}` : '입장 조건 변경 요청';
    return { id, storeId, kind, appKind, status: d.status, group: IN_PROGRESS.includes(d.status) ? 'IN_PROGRESS' : 'DONE', summaryText, submittedAt: d.submittedAt ?? d.createdAt ?? '' };
  };
  const items = [
    ...cond.map((d) => row(d, 'CONDITION')),
    ...events.map((d) => row(d, 'EVENT_AD', 'EVENT')),
    ...ads.map((d) => row(d, 'EVENT_AD', 'AD')),
  ].filter((x): x is PartnerRequest => x !== null && (status === 'ALL' || x.group === status));
  return { summary: null, items, nextCursor: null };
}

/** F-WREQ-01 한 페이지. 대시보드 최근 요청은 limit=3 (명세) */
export async function getRequestPage(storeId: string, opts: { type?: RequestTypeFilter; status?: RequestStatusFilter; cursor?: string | null; limit?: number } = {}): Promise<RequestPage> {
  const type = opts.type ?? 'ALL';
  const status = opts.status ?? 'ALL';
  const limit = opts.limit ?? 20;
  let dto: RequestListDto;
  if (USE_MOCK) {
    const mine = MOCK_REQUESTS.filter((r) => r.placeId === storeId);
    const rows = mine.filter((r) => (type === 'ALL' || r.type === type) && (status === 'ALL' || r.group === status));
    const start = opts.cursor ? Number(opts.cursor) : 0;
    const done = mine.filter((r) => r.group === 'DONE').length;
    dto = await mockResponse({
      summary: {
        inProgress: mine.filter((r) => r.group === 'IN_PROGRESS').length,
        needsAction: mine.filter((r) => r.status === 'NEEDS_INFO').length,
        done,
        avgProcessingDays: done ? MOCK_AVG_PROCESSING_DAYS : null,
      },
      items: rows.slice(start, start + limit).map(({ placeId: _p, ...item }) => item),
      nextCursor: start + limit < rows.length ? String(start + limit) : null,
    });
  } else {
    return getSplitRequestPage(storeId, type, status, opts.cursor ?? null);
  }
  return { summary: dto.summary, items: dto.items.map((d) => toRequestItem(d, storeId)), nextCursor: dto.nextCursor };
}

// ─── F-WREQ-04 요청 상세 ─────────────────────────────

export interface ConditionRequestDetailDto {
  /** 문자('REQ-0131') · 숫자(1301) 모두 받아요 */
  requestId: RawId;
  /** 매장 ID — 이전 명세 placeId · API 문서 storeId */
  placeId?: RawId;
  storeId?: RawId;
  status: RequestStatus;
  submittedAt?: string | null;
  lastSubmittedAt?: string | null;
  baseVersion?: number | null;
  latestConditionsVersion?: number | null;
  baseChanged?: boolean;
  changes?: (Omit<RequestChange, 'field'> & { field: string })[] | null;
  evidences?: { kind: 'LINK' | 'FILE'; url: string; fileName?: string | null }[] | null;
  reason?: string | null;
  /** 백엔드 API 문서의 보완 · 반려 사유 */
  reviewComment?: string | null;
  history?: RequestHistory[] | null;
  canCancel?: boolean;
  canResubmit?: boolean;
}

/** LINK · FILE 근거 → 화면 첨부 (링크는 주소, 파일은 파일명으로 보여 주고 둘 다 url 로 열어요) */
function toAttachment(e: NonNullable<ConditionRequestDetailDto['evidences']>[number]): Attachment {
  if (e.kind === 'FILE') return { kind: 'file', name: e.fileName || '첨부 파일', href: e.url };
  return { kind: 'link', name: e.url.replace(/^https?:\/\//, ''), href: e.url };
}

export function toRequestDetail(d: ConditionRequestDetailDto): ConditionRequestDetail {
  return {
    id: toId(d.requestId) ?? '',
    storeId: toStoreId(d) ?? '',
    status: d.status,
    // 상세 응답 예시에 없는 값은 빈 값으로 받아요 (화면이 멈추지 않게)
    submittedAt: d.submittedAt ?? '',
    lastSubmittedAt: d.lastSubmittedAt ?? d.submittedAt ?? '',
    // 버전이 없으면 0 으로 채우지 않아요 — '조건이 바뀜'과 '비교할 수 없음'을 구분해요
    baseVersion: typeof d.baseVersion === 'number' ? d.baseVersion : null,
    latestConditionsVersion: typeof d.latestConditionsVersion === 'number' ? d.latestConditionsVersion : null,
    baseChanged: d.baseChanged === true,
    // 상세 응답 예시는 { requestId, status, reviewComment } 뿐이라 없는 목록은 빈 값, 가능 여부는 열지 않는 쪽으로 받아요
    changes: (d.changes ?? []).map((c) => ({ ...c, field: c.field as ConditionField })),
    evidences: (d.evidences ?? []).map(toAttachment),
    reason: d.reason ?? d.reviewComment ?? null,
    history: d.history ?? [],
    canCancel: d.canCancel === true,
    canResubmit: d.canResubmit === true,
  };
}

/** F-WREQ-04 입장 조건 변경 요청 상세 */
export async function getRequestDetail(id: string): Promise<ConditionRequestDetail> {
  if (USE_MOCK) {
    const detail = MOCK_REQUEST_DETAILS[id];
    if (!detail) throw mockError('NOT_FOUND');
    return toRequestDetail(await mockResponse(detail));
  }
  const { data } = await apiClient.get<ConditionRequestDetailDto>(`/business/condition-requests/${enc(id)}`);
  return toRequestDetail(data);
}

/** F-WREQ-05 요청 취소 — 접수 · 보완 요청 상태에서만 돼요 */
export async function cancelRequest(id: string): Promise<void> {
  if (USE_MOCK) {
    const detail = MOCK_REQUEST_DETAILS[id];
    if (!detail || !detail.canCancel) throw mockError('REQUEST_NOT_CANCELLABLE');
    const at = new Date().toISOString();
    Object.assign(detail, { status: 'CANCELED', canCancel: false, canResubmit: false, history: [...(detail.history ?? []), { action: 'CANCEL', status: 'CANCELED', at, by: 'BUSINESS', reason: null }] });
    const row = MOCK_REQUESTS.find((r) => r.requestId === id);
    if (row) Object.assign(row, { status: 'CANCELED', group: 'DONE' });
    Object.values(MOCK_CONDITIONS).forEach((c) => {
      c.pendingItems = (c.pendingItems ?? []).filter((p) => p.requestId !== id);
    });
    await mockResponse({ requestId: id, status: 'CANCELED', canceledAt: at });
    return;
  }
  // 입장 조건 요청 취소 — PATCH /business/condition-requests/{requestId} { action: "CANCEL" }
  await apiClient.patch(`/business/condition-requests/${enc(id)}`, { action: "CANCEL" });
}
