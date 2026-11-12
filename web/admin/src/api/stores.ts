import { MOCK_PLACE_ACCOUNTS, MOCK_PLACE_CONDITIONS, MOCK_PLACE_DETAILS, MOCK_PLACE_HISTORY, MOCK_PLACES, MOCK_SOURCE_RATIO } from '@/mocks/stores';
import type {
  ConditionField,
  ConditionState,
  PlaceAccountView,
  PlaceConditions,
  PlaceConditionsView,
  PlaceHistoryItem,
  PlaceInfo,
  PlaceListItem,
  PlaceListPage,
  PlaceMemo,
  PlaceOverview,
  UnrestrictableField,
} from '@/types';
import { paginate } from '@/hooks/useCursorList';
import { changedFields, fieldState, isUnrestrictable } from '@/utils/conditions';
import { apiClient, mockResponse, USE_MOCK } from './client';
import { mockError } from './errors';
import { toId, toStoreId } from './ids';

// 명세 F-OPLACE-01 ~ 13 (제출본 6.2.5절). 서버 응답(DTO) → 화면 타입 변환은 이 파일에서만 해요.
// 목업도 같은 DTO 를 만들어 같은 변환 함수를 거쳐요.

const enc = encodeURIComponent;
const EMPTY_CONDITIONS: PlaceConditions = { petAllowed: null, weightLimitKg: null, sizeLimit: null, restrictedBreeds: null, area: null, requiredItems: null, vaccinationRequired: null };

// ─── 서버 응답 모양 (DTO) ─────────────────────────────

export interface PlaceListItemDto {
  /** 이전 명세 placeId · API 문서 storeId (숫자) */
  placeId?: string | number;
  storeId?: string | number;
  name: string;
  /** 아래부터는 운영자 업체 목록 API 예시에 없어요 */
  category?: string | null;
  region?: string | null;
  source?: string | null;
  conditionCheckedAt?: string | null;
  stale?: boolean | null;
  qrVisitCount?: number | null;
  recheckRequested?: boolean;
  hidden?: boolean;
  /** API 문서: VISIBLE · HIDDEN */
  visibility?: string | null;
}
interface PlaceListDto {
  sourceRatio: { source: string | null; count: number }[];
  items: PlaceListItemDto[];
  nextCursor: string | null;
}
export interface PlaceDetailDto {
  placeId?: string | number;
  storeId?: string | number;
  name?: string | null;
  /** 아래부터는 운영자 업체 상세 API 예시({ storeId, manager, policyVersion, pendingRequests })에 없어요 */
  category?: string | null;
  region?: string | null;
  source?: string | null;
  chips?: { certification: string | null; checkMethod: string | null; eventParticipation: string | null; hidden: boolean } | null;
  summary?: { conditionCheckedAt: string | null; qrVisitCount: number; openRequestCount: number; inquiryCount: number } | null;
  info?: { address: string | null; phone: string | null; channels: string[] | null } | null;
  memo?: { text: string | null; updatedAt: string | null; updatedBy: string | null } | null;
  visibility?: string | null;
  address?: string | null;
  policyVersion?: number | null;
  pendingRequests?: number | null;
}
export interface PlaceConditionsDto {
  placeId: string;
  conditions: Partial<PlaceConditions>;
  unrestrictedFields: string[] | null;
  source: string | null;
  sourceUrl: string | null;
  checkedAt: string | null;
  /** 명세상 필수지만 빠지면 null 로 받아 저장을 막아요 */
  conditionsVersion?: number | null;
  pendingRequests: { requestId: string; status: string }[] | null;
}
export interface PlaceHistoryDto {
  historyId: string;
  type: string;
  at: string;
  actor: { operatorId: string; name: string | null } | null;
  result: string | null;
  changes: unknown;
  requestId: string | null;
}
export interface PlaceAccountDto {
  placeId: string;
  account: { loginId: string; managerName: string | null; lastLoginAt: string | null; linkedPlaces: { placeId: string; name: string }[]; withdrawn?: boolean } | null;
  qr: { qrId: string; issuedAt: string | null; status: string | null } | null;
}

// ─── 변환 ─────────────────────────────────────────────

const toListItem = (d: PlaceListItemDto): PlaceListItem => ({
  id: toStoreId(d) ?? '',
  name: d.name ?? '',
  category: d.category ?? null,
  region: d.region ?? null,
  source: (d.source ?? null) as PlaceListItem['source'],
  conditionCheckedAt: d.conditionCheckedAt ?? null,
  stale: typeof d.stale === 'boolean' ? d.stale : null,
  qrVisitCount: typeof d.qrVisitCount === 'number' ? d.qrVisitCount : null,
  recheckRequested: d.recheckRequested === true,
  hidden: typeof d.hidden === 'boolean' ? d.hidden : d.visibility === 'HIDDEN',
});

const toInfo = (d: PlaceDetailDto['info']): PlaceInfo => ({ address: d?.address ?? null, phone: d?.phone ?? null, channels: d?.channels ?? [] });
const toMemo = (d: PlaceDetailDto['memo']): PlaceMemo => ({ text: d?.text ?? '', updatedAt: d?.updatedAt ?? null, updatedBy: d?.updatedBy ?? null });

const toOverview = (d: PlaceDetailDto): PlaceOverview => ({
  id: toStoreId(d) ?? '',
  name: d.name ?? '',
  category: d.category ?? null,
  region: d.region ?? null,
  source: (d.source ?? null) as PlaceOverview['source'],
  chips: d.chips ?? { certification: null, checkMethod: null, eventParticipation: null, hidden: d.visibility === 'HIDDEN' },
  summary: d.summary ?? { conditionCheckedAt: null, qrVisitCount: null, openRequestCount: typeof d.pendingRequests === 'number' ? d.pendingRequests : null, inquiryCount: null },
  info: d.info ? toInfo(d.info) : { address: d.address ?? null, phone: null, channels: [] },
  memo: toMemo(d.memo ?? null),
  policyVersion: typeof d.policyVersion === 'number' ? d.policyVersion : null,
});

/** 5.2절: 제한 없음 대상 필드만 목록으로 받아요 */
const toUnrestricted = (list: string[] | null): UnrestrictableField[] => (list ?? []).filter((f): f is UnrestrictableField => isUnrestrictable(f as ConditionField));

const toConditionsView = (d: PlaceConditionsDto): PlaceConditionsView => ({
  placeId: d.placeId,
  state: { conditions: { ...EMPTY_CONDITIONS, ...d.conditions }, unrestrictedFields: toUnrestricted(d.unrestrictedFields) },
  source: d.source,
  sourceUrl: d.sourceUrl,
  checkedAt: d.checkedAt,
  conditionsVersion: typeof d.conditionsVersion === 'number' ? d.conditionsVersion : null,
  pendingRequests: d.pendingRequests ?? [],
});

const toHistory = (d: PlaceHistoryDto): PlaceHistoryItem => ({
  id: d.historyId,
  type: d.type,
  at: d.at,
  actorName: d.actor?.name ?? null,
  result: d.result,
  // changes 모양은 [확인 필요] — 글자면 그대로, 아니면 JSON 으로 보여 줘요
  changes: d.changes === null || d.changes === undefined ? null : typeof d.changes === 'string' ? d.changes : JSON.stringify(d.changes),
  requestId: d.requestId,
});

const toAccount = (d: PlaceAccountDto): PlaceAccountView => ({
  placeId: d.placeId,
  account: d.account ? { ...d.account, withdrawn: Boolean(d.account.withdrawn) } : null,
  qr: d.qr,
});

// ─── 목업 서버 (DTO 를 돌려줘요) ──────────────────────

function mockDetailDto(id: string): PlaceDetailDto {
  const base = MOCK_PLACES.find((p) => p.placeId === id);
  if (!base) throw mockError('NOT_FOUND');
  return (MOCK_PLACE_DETAILS[id] ??= {
    placeId: id,
    name: base.name,
    category: base.category,
    region: base.region,
    source: base.source,
    chips: { certification: null, checkMethod: null, eventParticipation: null, hidden: base.hidden ?? false },
    summary: { conditionCheckedAt: base.conditionCheckedAt ?? null, qrVisitCount: base.qrVisitCount ?? 0, openRequestCount: 0, inquiryCount: 0 },
    info: { address: null, phone: null, channels: [] },
    memo: null,
  });
}

function mockConditionsDto(id: string): PlaceConditionsDto {
  const base = MOCK_PLACES.find((p) => p.placeId === id);
  if (!base) throw mockError('NOT_FOUND');
  return (MOCK_PLACE_CONDITIONS[id] ??= {
    placeId: id,
    conditions: { ...EMPTY_CONDITIONS },
    unrestrictedFields: [],
    source: null,
    sourceUrl: null,
    checkedAt: base.conditionCheckedAt ?? null,
    conditionsVersion: 1,
    pendingRequests: [],
  });
}

// ─── API ──────────────────────────────────────────────

/** F-OPLACE-01 업체 목록 한 페이지. sort 값은 명세에 정해지지 않아 보내지 않아요 (서버 기본 순서) */
export async function getPlacePage(opts: { q?: string; stale?: boolean; cursor: string | null; limit?: number }): Promise<PlaceListPage> {
  const limit = opts.limit ?? 20;
  let dto: PlaceListDto;
  if (USE_MOCK) {
    const rows = MOCK_PLACES.filter((p) => !opts.q?.trim() || p.name.includes(opts.q.trim())).filter((p) => !opts.stale || p.stale);
    const page = paginate(rows, opts.cursor, limit);
    dto = await mockResponse({ sourceRatio: MOCK_SOURCE_RATIO, items: page.items, nextCursor: page.nextCursor });
  } else {
    // 운영자 업체 목록 조회 — GET /admin/stores?keyword&regionId&visibility&page → { items: [{ storeId, name, visibility }] }
    // '확인일 30일 지남' 필터는 이 API 에 없어 보내지 않아요. page 시작값 · 다음 페이지 근거가 없어 첫 페이지만 보여 줘요 (백엔드 확인 사항).
    const { data } = await apiClient.get<{ items?: PlaceListItemDto[] | null }>('/admin/stores', { params: { keyword: opts.q?.trim() || undefined } });
    return { sourceRatio: [], items: (data?.items ?? []).map(toListItem).filter((x) => x.id !== ''), nextCursor: null };
  }
  return { sourceRatio: dto.sourceRatio ?? [], items: dto.items.map(toListItem), nextCursor: dto.nextCursor };
}

/** F-OPLACE-04 업체 상세 · 개요 */
export async function getPlaceOverview(id: string): Promise<PlaceOverview> {
  const dto = USE_MOCK ? await mockResponse(mockDetailDto(id)) : (await apiClient.get<PlaceDetailDto>(`/admin/stores/${enc(id)}`)).data;
  return toOverview(dto);
}

/** F-OPLACE-09 입장 조건 조회 */
export async function getPlaceConditions(id: string): Promise<PlaceConditionsView> {
  const dto = USE_MOCK ? await mockResponse(mockConditionsDto(id)) : (await apiClient.get<PlaceConditionsDto>(`/admin/places/${enc(id)}/conditions`)).data;
  return toConditionsView(dto);
}

/** F-OPLACE-08 처리 이력 한 페이지 */
export async function getPlaceHistoryPage(id: string, cursor: string | null): Promise<{ items: PlaceHistoryItem[]; nextCursor: string | null }> {
  let dto: { items: PlaceHistoryDto[]; nextCursor: string | null };
  if (USE_MOCK) {
    mockDetailDto(id);
    dto = await mockResponse(paginate(MOCK_PLACE_HISTORY[id] ?? [], cursor, 20));
  } else {
    // 업체 정책 변경 이력 — GET /admin/stores/{storeId}/policy-history → { items: [{ policyId, version, changedBy, requestId }] }
    // 정책 이력만이라 화면에서 '입장 정책 변경 이력'으로 구분해요. 다음 페이지 근거가 없어 첫 페이지만 보여 줘요.
    if (cursor) return { items: [], nextCursor: null };
    const { data } = await apiClient.get<{ items?: { policyId?: string | number; version?: number; changedBy?: string | null; requestId?: string | number | null; changedAt?: string | null }[] | null }>(`/admin/stores/${enc(id)}/policy-history`);
    const CHANGED_BY: Record<string, string> = { OPERATOR: '운영자 직접 변경', BUSINESS: '업체 요청 승인', AI: 'AI 후보 승인' };
    return {
      items: (data?.items ?? []).map((h, i) => ({
        id: toId(h.policyId) ?? `policy-${i}`,
        type: '입장 정책 변경',
        at: h.changedAt ?? '',
        actorName: null,
        result: [typeof h.version === 'number' ? `정책 버전 ${h.version}` : null, h.changedBy ? (CHANGED_BY[h.changedBy] ?? h.changedBy) : null].filter(Boolean).join(' · ') || null,
        changes: null,
        requestId: toId(h.requestId),
      })),
      nextCursor: null,
    };
  }
  return { items: dto.items.map(toHistory), nextCursor: dto.nextCursor };
}

/** F-OPLACE-11 업체 계정 · QR 조회 */
export async function getPlaceAccount(id: string): Promise<PlaceAccountView> {
  let dto: PlaceAccountDto;
  if (USE_MOCK) {
    mockDetailDto(id);
    dto = await mockResponse(MOCK_PLACE_ACCOUNTS[id] ?? { placeId: id, account: null, qr: null });
  } else {
    dto = (await apiClient.get<PlaceAccountDto>(`/admin/places/${enc(id)}/account`)).data;
  }
  return toAccount(dto);
}

/** F-OPLACE-03 재확인 요청 */
export async function requestRecheck(id: string, reason: string): Promise<void> {
  if (USE_MOCK) {
    const p = MOCK_PLACES.find((x) => x.placeId === id);
    if (!p) throw mockError('NOT_FOUND');
    p.recheckRequested = true;
    await mockResponse({ placeId: id, recheckRequested: true, requestedAt: new Date().toISOString() });
    return;
  }
  // 업체 조건 재검토 요청 생성 — POST /admin/stores/{storeId}/recheck { reason(필수) } → { requestId, kind: RECHECK, status }
  if (!reason.trim()) throw mockError('INVALID_REQUEST', { field: 'reason' });
  await apiClient.post(`/admin/stores/${enc(id)}/recheck`, { reason: reason.trim() });
}

/**
 * F-OPLACE-10 요청 본문 만들기 (5.2절 '제한 없음' 저장 규칙 3 · 4 · 5)
 * - 바뀐 항목만 보내요. 요청에 없는 필드는 서버가 그대로 둬요 (목록을 통째로 보내지 않아요).
 * - 제한 있음으로 바꿈 → conditions[f] = 값 (제한 없음에서 풀 때도 같음)
 * - 미확인으로 바꿈 → conditions[f] = null (제한 없음에서 미확인으로 풀 때도 같음)
 * - 제한 없음으로 바꿈 → unrestrictedFields 에 f
 */
export function buildConditionsBody(before: ConditionState, after: ConditionState) {
  const conditions: Partial<Record<ConditionField, PlaceConditions[ConditionField]>> = {};
  const unrestrictedFields: UnrestrictableField[] = [];
  changedFields(before, after).forEach((f) => {
    const st = fieldState(after, f);
    if (st === 'UNRESTRICTED' && isUnrestrictable(f)) unrestrictedFields.push(f);
    else conditions[f] = st === 'UNKNOWN' ? null : after.conditions[f];
  });
  return { conditions, unrestrictedFields };
}

/**
 * F-OPLACE-10 입장 조건 직접 수정 · 확인일 갱신.
 * baseVersion 은 수정을 시작할 때 F-OPLACE-09 에서 받은 conditionsVersion 이에요. 409(CONDITIONS_OUTDATED)면 다시 보내지 않아요.
 */
export async function updatePlaceConditions(id: string, baseVersion: number, before: ConditionState, after: ConditionState, checkMethod: string): Promise<PlaceConditionsView> {
  // 서버로 보내기 전에 막아요: 기준 버전 · 확인 방법은 필수 (확인 방법 필수는 명세 [제안], 값 목록은 OPL-2 [확인 필요])
  if (!Number.isInteger(baseVersion)) throw mockError('VALIDATION_ERROR', { field: 'baseVersion' });
  if (!checkMethod.trim()) throw mockError('VALIDATION_ERROR', { field: 'checkMethod' });
  const { conditions, unrestrictedFields } = buildConditionsBody(before, after);
  const body = { baseVersion, conditions, unrestrictedFields, checkMethod: checkMethod.trim() };
  if (USE_MOCK) {
    const cur = mockConditionsDto(id);
    if (cur.conditionsVersion !== baseVersion) throw mockError('CONDITIONS_OUTDATED', { currentVersion: cur.conditionsVersion });
    // 서버와 같은 규칙으로 반영해요 (요청에 나온 필드만)
    const next = toConditionsView(cur).state;
    (Object.keys(conditions) as ConditionField[]).forEach((f) => {
      (next.conditions as unknown as Record<string, unknown>)[f] = conditions[f];
      next.unrestrictedFields = next.unrestrictedFields.filter((x) => x !== f);
    });
    unrestrictedFields.forEach((f) => {
      (next.conditions as unknown as Record<string, unknown>)[f] = null;
      if (!next.unrestrictedFields.includes(f)) next.unrestrictedFields.push(f);
    });
    const changed = Object.keys(conditions).length + unrestrictedFields.length > 0;
    const today = new Date().toISOString().slice(0, 10);
    Object.assign(cur, {
      conditions: next.conditions,
      unrestrictedFields: next.unrestrictedFields,
      conditionsVersion: changed ? baseVersion + 1 : baseVersion,
      checkedAt: today,
      source: checkMethod,
    });
    const p = MOCK_PLACES.find((x) => x.placeId === id);
    if (p) Object.assign(p, { conditionCheckedAt: today, stale: false });
    (MOCK_PLACE_HISTORY[id] ??= []).unshift({
      historyId: `h_${Date.now() % 100000}`,
      type: 'DIRECT_EDIT',
      at: new Date().toISOString(),
      actor: { operatorId: 'u_ops', name: '운영팀' },
      result: 'CHECKED',
      changes: changed ? `직접 수정 ${Object.keys(conditions).length + unrestrictedFields.length}개 항목` : '확인일만 갱신',
      requestId: null,
    });
    return toConditionsView(await mockResponse(cur));
  }
  const { data } = await apiClient.put<PlaceConditionsDto>(`/admin/places/${enc(id)}/conditions`, body);
  return toConditionsView(data);
}

/** F-OPLACE-06 운영 메모 저장 — 본문은 { text } */
export async function updatePlaceMemo(id: string, text: string): Promise<PlaceMemo> {
  if (USE_MOCK) {
    const d = mockDetailDto(id);
    d.memo = { text, updatedAt: new Date().toISOString(), updatedBy: '운영팀' };
    return toMemo(await mockResponse(d.memo));
  }
  const { data } = await apiClient.put<PlaceDetailDto['memo']>(`/admin/places/${enc(id)}/memo`, { text });
  return toMemo(data);
}

/** F-OPLACE-05 업체 정보 수정 — 바꾼 항목만 { address?, phone?, channels? } */
export async function updatePlaceInfo(id: string, before: PlaceInfo, after: PlaceInfo): Promise<PlaceInfo> {
  const body: Partial<PlaceInfo> = {};
  if ((after.address ?? '') !== (before.address ?? '')) body.address = after.address;
  if ((after.phone ?? '') !== (before.phone ?? '')) body.phone = after.phone;
  if (after.channels.join('\n') !== before.channels.join('\n')) body.channels = after.channels;
  if (Object.keys(body).length === 0) throw mockError('VALIDATION_ERROR');
  if (USE_MOCK) {
    const d = mockDetailDto(id);
    d.info = { ...(d.info ?? { address: null, phone: null, channels: [] }), ...body } as NonNullable<PlaceDetailDto['info']>;
    return toInfo(await mockResponse(d.info));
  }
  // 운영자 업체 정보 수정 — PATCH /admin/stores/{storeId} { name?, address?, managerUserId?, description? }
  // 전화 · 채널은 이 API 에 없어 보내지 않아요 (바꾸려 하면 알려 줘요)
  if (body.phone !== undefined || body.channels !== undefined) throw mockError('FIELD_NOT_SUPPORTED');
  const { data } = await apiClient.patch<{ storeId?: string | number; name?: string; address?: string | null }>(`/admin/stores/${enc(id)}`, { address: body.address });
  return { ...after, address: data?.address ?? after.address };
}

/** F-OPLACE-12 QR 재발급 */
export async function reissuePlaceQr(id: string): Promise<PlaceAccountView['qr']> {
  if (USE_MOCK) {
    const acc = (MOCK_PLACE_ACCOUNTS[id] ??= { placeId: id, account: null, qr: null });
    if (!acc.qr) throw mockError('NOT_FOUND');
    acc.qr = { ...acc.qr, qrId: `${acc.qr.qrId.replace(/-R\d+$/, '')}-R${Math.floor(Math.random() * 90 + 10)}`, issuedAt: new Date().toISOString().slice(0, 10) };
    return (await mockResponse({ placeId: id, qr: acc.qr })).qr;
  }
  const { data } = await apiClient.post<{ placeId: string; qr: PlaceAccountDto['qr'] }>(`/admin/places/${enc(id)}/qr/reissue`);
  return data.qr;
}

/**
 * F-OPLACE-13 QR 사용 중지 · 다시 사용 — 본문 { status } 의 값 목록이 명세에 없어요 (원본 29).
 * 값이 정해지기 전에는 이 기능을 쓰지 않아요. 정해지면 아래 값을 채워 주세요.
 */
export const QR_STATUS_VALUES: { active: string; stopped: string } | null = null;

export async function setPlaceQrStatus(id: string, stop: boolean): Promise<PlaceAccountView['qr']> {
  if (!QR_STATUS_VALUES) throw mockError('VALIDATION_ERROR', { field: 'status' });
  const status = stop ? QR_STATUS_VALUES.stopped : QR_STATUS_VALUES.active;
  const { data } = await apiClient.put<PlaceAccountDto['qr']>(`/admin/places/${enc(id)}/qr/status`, { status });
  return data;
}

/** F-OPLACE-07 지도 노출 중지 · 재개 */
export async function setPlaceVisibility(id: string, visible: boolean, reason?: string): Promise<{ hidden: boolean }> {
  if (USE_MOCK) {
    const d = mockDetailDto(id);
    if (d.chips) d.chips.hidden = !visible;
    const p = MOCK_PLACES.find((x) => x.placeId === id);
    if (p) p.hidden = !visible;
    return mockResponse({ hidden: !visible });
  }
  // 업체 노출 상태 변경 — PATCH /admin/stores/{storeId}/visibility { visible, reason? } → { storeId, visibility }
  const { data } = await apiClient.patch<{ storeId?: string | number; visibility?: string; hidden?: boolean }>(`/admin/stores/${enc(id)}/visibility`, { visible, reason: visible ? undefined : reason });
  return { hidden: typeof data?.hidden === 'boolean' ? data.hidden : data?.visibility === 'HIDDEN' };
}

export interface NewPlace {
  name: string;
  category: string;
  region: string;
  source: string;
  channels: string[];
}

/** F-OPLACE-02 업체 등록 — { name, category, region, source, channels[] } */
export async function createPlace(input: NewPlace): Promise<PlaceListItem> {
  const body = { name: input.name.trim(), category: input.category, region: input.region, source: input.source, channels: input.channels.map((c) => c.trim()).filter(Boolean) };
  if (USE_MOCK) {
    const dto: PlaceListItemDto = {
      placeId: `store-new-${MOCK_PLACES.length + 1}`,
      name: body.name,
      category: body.category,
      region: body.region,
      source: body.source,
      conditionCheckedAt: null,
      stale: false,
      qrVisitCount: 0,
      recheckRequested: false,
      hidden: false,
    };
    MOCK_PLACES.unshift(dto);
    MOCK_PLACE_DETAILS[String(dto.placeId)] = { ...mockDetailDto(String(dto.placeId)), info: { address: null, phone: null, channels: body.channels } };
    return toListItem(await mockResponse(dto));
  }
  // 운영자 업체 직접 등록 — POST /admin/stores 는 address · latitude · longitude · regionId 가 필수인데
  // 지금 등록 화면에는 이 값이 없어 보내지 않아요 (백엔드 · 기획 확인 사항). 임의 값으로 채우지 않아요.
  void body;
  throw mockError('FIELD_NOT_SUPPORTED', { field: 'address,latitude,longitude,regionId' });
}
