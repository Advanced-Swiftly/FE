import { MOCK_CONDITIONS, SAMPLE_DOGS } from '@/mocks/conditions';
import { MOCK_REQUEST_DETAILS } from '@/mocks/requestDetails';
import { MOCK_REQUESTS } from '@/mocks/requests';
import type { ConditionChangeRequest, ConditionField, ConditionState, PendingItem, PlaceConditions, StoreConditions, UnrestrictableField, VerdictPreview } from '@/types';
import { CONDITION_LABEL, changedFields, describeValue, fieldState, isUnrestrictable, judge } from '@/utils/conditions';
import { apiClient, mockResponse, USE_MOCK } from './client';
import { mockError } from './errors';
import { toId, toStoreId, type RawId } from './ids';
import { toRequestDetail, type ConditionRequestDetailDto } from './requests';

// 명세 F-WREQ-02 · 03 · 06 · 07 (제출본 6.1.3절). 서버 응답(DTO) → 화면 타입 변환은 이 파일과 requests.ts 에서만 해요.

const enc = encodeURIComponent;
const EMPTY: PlaceConditions = { petAllowed: null, weightLimitKg: null, sizeLimit: null, restrictedBreeds: null, area: null, requiredItems: null, vaccinationRequired: null };

/** F-WREQ-02 응답 */
export interface PlaceConditionsDto {
  /** 매장 ID — 이전 명세 placeId · API 문서 storeId (문자 · 숫자 모두 받아요) */
  placeId?: RawId;
  storeId?: RawId;
  conditionCheckedAt: string | null;
  conditionsVersion: number;
  unrestrictedFields: string[] | null;
  source: string | null;
  checkMethod: string | null;
  conditions: Partial<PlaceConditions> & { sourceUrl?: string | null };
  pendingItems: { field: string; requestId: RawId; status: PendingItem['status'] }[] | null;
}

const isField = (f: string): f is ConditionField => (Object.keys(EMPTY) as string[]).includes(f);

export function toStoreConditions(d: PlaceConditionsDto): StoreConditions {
  const { sourceUrl, ...values } = d.conditions;
  return {
    storeId: toStoreId(d) ?? '',
    conditionCheckedAt: d.conditionCheckedAt,
    conditionsVersion: d.conditionsVersion,
    source: d.source,
    sourceUrl: sourceUrl ?? null,
    checkMethod: d.checkMethod,
    conditions: { ...EMPTY, ...values },
    unrestrictedFields: (d.unrestrictedFields ?? []).filter((f): f is UnrestrictableField => isField(f) && isUnrestrictable(f)),
    pendingItems: (d.pendingItems ?? []).filter((p) => isField(p.field)).map((p) => ({ field: p.field as ConditionField, requestId: toId(p.requestId), status: p.status })),
  };
}

/** F-WREQ-02 매장의 승인된 입장 조건 */
export async function getConditions(storeId: string): Promise<StoreConditions> {
  if (USE_MOCK) {
    const dto = MOCK_CONDITIONS[storeId];
    if (!dto) throw mockError('NOT_FOUND');
    return toStoreConditions(await mockResponse(dto));
  }
  const { data } = await apiClient.get<PlaceConditionsDto>(`/business/places/${enc(storeId)}/conditions`);
  return toStoreConditions(data);
}

/**
 * 지금 조건과 고친 조건을 비교해 서버에 보낼 모양으로 (F-WREQ-03 · 06 · 07 공용, 5.2절 규칙 3)
 * - changes: 구체적인 값으로 바꾼 항목 (null 불가)
 * - unrestrictedFields: 제한 없음으로 바꾼 항목
 * 업체는 '미확인'(null)으로 보낼 수 없어요. 화면이 미리 막아요.
 */
export function buildChanges(original: ConditionState, draft: ConditionState) {
  const changes: Partial<PlaceConditions> = {};
  const unrestrictedFields: UnrestrictableField[] = [];
  changedFields(original, draft).forEach((f) => {
    const st = fieldState(draft, f);
    if (st === 'UNRESTRICTED' && isUnrestrictable(f)) unrestrictedFields.push(f);
    else if (st === 'LIMITED') (changes as Record<string, unknown>)[f] = draft.conditions[f];
  });
  return { changes, unrestrictedFields };
}

/**
 * multipart 본문. 명세는 multipart 라고만 정해서 JSON 부분(body)과 파일 부분(evidenceFiles)의 이름은 백엔드 확인 사항이에요.
 */
function toForm(json: Record<string, unknown>, files: File[]) {
  const form = new FormData();
  form.append('body', new Blob([JSON.stringify(json)], { type: 'application/json' }));
  files.forEach((f) => form.append('evidenceFiles', f));
  return form;
}

/** 요청 내용을 줄 요약으로 (목업 목록용) */
function summarize(req: ConditionChangeRequest) {
  const fields = [...(Object.keys(req.changes) as ConditionField[]), ...req.unrestrictedFields];
  const first = fields[0];
  if (!first) return '입장 조건 수정';
  const text = describeValue(first, req.changes[first] ?? null, req.unrestrictedFields.includes(first as UnrestrictableField));
  return `${CONDITION_LABEL[first]} · ${text}${fields.length > 1 ? ` 외 ${fields.length - 1}건` : ''}`;
}

function nowIso() {
  return new Date().toISOString();
}

/** 목업 서버: 기준 버전 · 진행 중 항목 검사 (서버와 같은 규칙) */
function mockCheck(placeId: string, baseVersion: number, req: ConditionChangeRequest, selfId: string | null) {
  const state = MOCK_CONDITIONS[placeId];
  if (!state) throw mockError('NOT_FOUND');
  if (baseVersion !== state.conditionsVersion) throw mockError('CONDITIONS_OUTDATED', { currentVersion: state.conditionsVersion });
  const fields = [...(Object.keys(req.changes) as ConditionField[]), ...req.unrestrictedFields];
  if (fields.length === 0) throw mockError('VALIDATION_ERROR', { field: 'changes' });
  if (fields.some((f) => (state.pendingItems ?? []).some((p) => p.field === f && p.requestId !== selfId))) throw mockError('CONDITION_UNDER_REVIEW');
  state.pendingItems = [...(state.pendingItems ?? []).filter((p) => p.requestId !== selfId), ...fields.map((field) => ({ field, requestId: selfId ?? '', status: 'RECEIVED' as const }))];
  return { state, fields };
}

/** F-WREQ-03 조건 변경 요청 보내기 → 요청 ID */
export async function requestConditionChange(req: ConditionChangeRequest, files: File[] = []): Promise<{ id: string }> {
  const json = { placeId: req.storeId, baseVersion: req.baseVersion, changes: req.changes, unrestrictedFields: req.unrestrictedFields, evidenceLinks: req.evidenceLinks };
  if (USE_MOCK) {
    const id = `REQ-${String(143 + MOCK_REQUESTS.length).padStart(4, '0')}`;
    const { state, fields } = mockCheck(req.storeId, req.baseVersion, req, null);
    state.pendingItems = (state.pendingItems ?? []).map((p) => (p.requestId === '' ? { ...p, requestId: id } : p));
    const at = nowIso();
    MOCK_REQUESTS.unshift({ placeId: req.storeId, type: 'CONDITION', requestId: id, status: 'RECEIVED', group: 'IN_PROGRESS', summaryText: summarize(req), submittedAt: at });
    const unr = state.unrestrictedFields ?? [];
    MOCK_REQUEST_DETAILS[id] = {
      requestId: id,
      placeId: req.storeId,
      status: 'RECEIVED',
      submittedAt: at,
      lastSubmittedAt: at,
      baseVersion: req.baseVersion,
      latestConditionsVersion: state.conditionsVersion,
      baseChanged: false,
      changes: fields.map((field) => ({
        field,
        currentValue: state.conditions[field] ?? null,
        currentUnrestricted: unr.includes(field),
        latestValue: state.conditions[field] ?? null,
        latestUnrestricted: unr.includes(field),
        requestedValue: req.changes[field] ?? null,
        requestedUnrestricted: req.unrestrictedFields.includes(field as UnrestrictableField),
      })),
      evidences: [...files.map((f) => ({ kind: 'FILE' as const, fileName: f.name, url: URL.createObjectURL(f) })), ...req.evidenceLinks.map((l) => ({ kind: 'LINK' as const, url: l }))],
      reason: null,
      history: [{ action: 'SUBMIT', status: 'RECEIVED', at, by: 'BUSINESS', reason: null }],
      canCancel: true,
      canResubmit: false,
    };
    return mockResponse({ id });
  }
  const { data } = await apiClient.post<{ requestId: RawId; status: string; submittedAt: string }>('/business/condition-requests', toForm(json, files));
  return { id: toId(data.requestId) ?? '' };
}

/**
 * F-WREQ-06 보완 내용 다시 보내기 (같은 요청이 접수로 돌아가요).
 * baseVersion 은 F-WREQ-04 의 latestConditionsVersion, changes · unrestrictedFields 는 요청 내용 전체예요.
 */
export async function resubmitConditionRequest(requestId: string, req: ConditionChangeRequest, files: File[] = []): Promise<{ id: string }> {
  const json = { baseVersion: req.baseVersion, changes: req.changes, unrestrictedFields: req.unrestrictedFields, evidenceLinks: req.evidenceLinks };
  if (USE_MOCK) {
    const detail = MOCK_REQUEST_DETAILS[requestId];
    if (!detail || detail.placeId !== req.storeId) throw mockError('NOT_FOUND');
    if (detail.status !== 'NEEDS_INFO') throw mockError('REQUEST_NOT_EDITABLE');
    const { state } = mockCheck(req.storeId, req.baseVersion, req, requestId);
    const at = nowIso();
    const unr = state.unrestrictedFields ?? [];
    const fields = [...(Object.keys(req.changes) as ConditionField[]), ...req.unrestrictedFields];
    Object.assign(detail, {
      status: 'RECEIVED',
      lastSubmittedAt: at,
      baseVersion: req.baseVersion,
      latestConditionsVersion: state.conditionsVersion,
      baseChanged: false,
      canResubmit: false,
      changes: fields.map((field) => ({
        field,
        currentValue: state.conditions[field] ?? null,
        currentUnrestricted: unr.includes(field),
        latestValue: state.conditions[field] ?? null,
        latestUnrestricted: unr.includes(field),
        requestedValue: req.changes[field] ?? null,
        requestedUnrestricted: req.unrestrictedFields.includes(field as UnrestrictableField),
      })),
      history: [...(detail.history ?? []), { action: 'RESUBMIT', status: 'RECEIVED', at, by: 'BUSINESS', reason: null }],
      evidences: [...(detail.evidences ?? []), ...files.map((f) => ({ kind: 'FILE' as const, fileName: f.name, url: URL.createObjectURL(f) })), ...req.evidenceLinks.map((l) => ({ kind: 'LINK' as const, url: l }))],
    } satisfies Partial<ConditionRequestDetailDto>);
    const row = MOCK_REQUESTS.find((r) => r.requestId === requestId);
    if (row) Object.assign(row, { status: 'RECEIVED', group: 'IN_PROGRESS' });
    return { id: toRequestDetail(await mockResponse(detail)).id };
  }
  const { data } = await apiClient.patch<ConditionRequestDetailDto>(`/business/condition-requests/${enc(requestId)}`, toForm(json, files));
  return { id: toRequestDetail(data).id };
}

/** F-WREQ-07 응답 한 줄 */
interface PreviewDogDto {
  testDogId: string;
  label: string;
  before: VerdictPreview['before'];
  after: VerdictPreview['after'];
}

/** F-WREQ-07 판정 미리보기 (저장하지 않아요). 본문은 { placeId, changes, unrestrictedFields } */
export async function previewVerdicts(before: ConditionState, after: ConditionState, storeId: string): Promise<VerdictPreview[]> {
  const { changes, unrestrictedFields } = buildChanges(before, after);
  let dogs: PreviewDogDto[];
  if (USE_MOCK) {
    if (!MOCK_CONDITIONS[storeId]) throw mockError('NOT_FOUND');
    dogs = (await mockResponse({ dogs: SAMPLE_DOGS.map((dog) => ({ testDogId: dog.id, label: dog.label, before: judge(before, dog), after: judge(after, dog) })) }, 150)).dogs;
  } else {
    dogs = (await apiClient.post<{ dogs: PreviewDogDto[] }>('/business/condition-requests/preview', { placeId: storeId, changes, unrestrictedFields })).data.dogs;
  }
  return dogs.map((d) => ({ dogId: d.testDogId, label: d.label, before: d.before, after: d.after }));
}
