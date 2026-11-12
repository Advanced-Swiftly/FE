import { apiClient } from './client';
import { toApiError } from './errors';
import { toId, type RawId } from './ids';

/**
 * 실제 BE 의 업체 입장 정책 (서버 모드 전용).
 * BE 정책은 '견종 · 준비물 · 예방접종' 세 목록뿐이고, 각 조건은 { code, required } 예요.
 * - 견종(BREED): code = 견종 ID (GET /breeds 의 breedId)
 * - 준비물(EQUIPMENT) · 예방접종(VACCINE): 영문 대문자 코드 (예: CARRIER · RABIES · DHPPL)
 * 동반 가능 · 체중 · 크기 · 이용 구역은 BE 정책에 없어요 (목업 화면에만 있어요).
 */

export type RuleGroup = 'breedRules' | 'equipmentRules' | 'vaccineRules';
export const RULE_GROUPS: RuleGroup[] = ['breedRules', 'equipmentRules', 'vaccineRules'];
export const RULE_GROUP_LABEL: Record<RuleGroup, string> = { breedRules: '견종', equipmentRules: '준비물', vaccineRules: '예방접종' };

export interface PolicyRule {
  code: string;
  required: boolean;
}
export interface RuleSet {
  breedRules: PolicyRule[];
  equipmentRules: PolicyRule[];
  vaccineRules: PolicyRule[];
}
export interface StorePolicy extends RuleSet {
  /** 아직 정책이 없으면 null (그때 변경 요청 기준 버전은 0) */
  policyId: string | null;
  version: number;
  exists: boolean;
}

/** BE 예시 · 코드에서 확인한 코드만 이름을 붙여요. 나머지는 코드 그대로 보여 줘요 */
export const KNOWN_CODE_LABEL: Record<string, string> = { CARRIER: '이동장', RABIES: '광견병', DHPPL: '종합백신(DHPPL)' };
export const CODE_RE = /^[A-Z][A-Z0-9_]{0,79}$/;

export const EMPTY_RULES: RuleSet = { breedRules: [], equipmentRules: [], vaccineRules: [] };

type RuleDto = { code?: string | null; required?: boolean | null };
type PolicyDto = { policyId?: RawId; version?: number | null; breedRules?: RuleDto[] | null; equipmentRules?: RuleDto[] | null; vaccineRules?: RuleDto[] | null };

const toRules = (list: RuleDto[] | null | undefined): PolicyRule[] =>
  (list ?? []).flatMap((r) => (typeof r.code === 'string' && r.code ? [{ code: r.code, required: r.required !== false }] : []));

export function toRuleSet(d: Partial<PolicyDto> | null | undefined): RuleSet {
  return { breedRules: toRules(d?.breedRules), equipmentRules: toRules(d?.equipmentRules), vaccineRules: toRules(d?.vaccineRules) };
}

/** 업체 현재 입장 정책 — GET /business/stores/{storeId}/policy. 아직 정책이 없으면(404) 빈 정책 · 버전 0 */
export async function getStorePolicy(storeId: string): Promise<StorePolicy> {
  try {
    const { data } = await apiClient.get<PolicyDto>(`/business/stores/${encodeURIComponent(storeId)}/policy`);
    return { ...toRuleSet(data), policyId: toId(data?.policyId), version: typeof data?.version === 'number' ? data.version : 0, exists: true };
  } catch (e) {
    const err = toApiError(e);
    if (err.status === 404) return { ...EMPTY_RULES, policyId: null, version: 0, exists: false };
    throw err;
  }
}

let breedCache: Promise<Map<string, string>> | null = null;
/** 견종 이름 — GET /breeds → { breeds: [{ breedId, name }] } */
export function getBreedNames(): Promise<Map<string, string>> {
  breedCache ??= apiClient
    .get<{ breeds?: { breedId: RawId; name: string }[] | null }>('/breeds')
    .then((r) => new Map((r.data?.breeds ?? []).flatMap((b) => (toId(b.breedId) ? [[toId(b.breedId) as string, b.name] as [string, string]] : []))))
    .catch((e) => {
      breedCache = null;
      throw e;
    });
  return breedCache;
}

/** 정책을 BE 에 보낼 모양으로 — 세 목록을 모두 담아요 (BE 는 받은 정책으로 전체를 바꾸고, 빠진 목록은 비운 것으로 봐요) */
export function toPolicyBody(r: RuleSet) {
  const clean = (list: PolicyRule[]) => list.map((x) => ({ code: x.code.trim(), required: x.required }));
  return { breedRules: clean(r.breedRules), equipmentRules: clean(r.equipmentRules), vaccineRules: clean(r.vaccineRules) };
}

const key = (r: RuleSet) => JSON.stringify(RULE_GROUPS.map((g) => [...r[g]].map((x) => `${x.code}:${x.required}`).sort()));
export const sameRules = (a: RuleSet, b: RuleSet) => key(a) === key(b);

/**
 * 입장 조건 변경 요청 — POST /business/stores/{storeId}/condition-requests
 * { baseVersion, requestedPolicy(전체), sourceText, evidenceUrls? } → { requestId, status }
 * requestedPolicy 는 지금 정책에서 고친 '전체' 정책이에요. 바꾸지 않은 조건도 함께 보내야 지워지지 않아요.
 * 기준 버전이 지금 버전과 다르면 409 POLICY_VERSION_CONFLICT.
 */
export async function createPolicyRequest(storeId: string, baseVersion: number, requested: RuleSet, sourceText: string, evidenceUrls: string[]): Promise<string> {
  const { data } = await apiClient.post<{ requestId: RawId; status?: string }>(`/business/stores/${encodeURIComponent(storeId)}/condition-requests`, {
    baseVersion,
    requestedPolicy: toPolicyBody(requested),
    sourceText: sourceText.trim(),
    evidenceUrls: evidenceUrls.length ? evidenceUrls : undefined,
  });
  return toId(data.requestId) ?? '';
}

/**
 * 보완 제출 — PATCH /business/condition-requests/{requestId} { action: RESUBMIT, requestedPolicy?, sourceText?, evidenceUrls? }
 * 보내지 않은 항목은 BE 가 그대로 둬요. 근거 주소는 기존 목록에 더해져요.
 * requestedPolicy 를 보내면 요청 정책 전체가 바뀌어요 (그래서 고쳤을 때만, 전체를 보내요).
 */
export async function resubmitPolicyRequest(requestId: string, requested: RuleSet | null, sourceText: string, evidenceUrls: string[]): Promise<void> {
  await apiClient.patch(`/business/condition-requests/${encodeURIComponent(requestId)}`, {
    action: 'RESUBMIT',
    ...(requested ? { requestedPolicy: toPolicyBody(requested) } : {}),
    ...(sourceText.trim() ? { sourceText: sourceText.trim() } : {}),
    ...(evidenceUrls.length ? { evidenceUrls } : {}),
  });
}
