import { apiClient } from './client';
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

// ─── 운영자 입장 조건 요청 심사 (실제 BE AdminConditionController) ───

export interface PolicyChange {
  ruleType: 'BREED' | 'EQUIPMENT' | 'VACCINE' | string;
  code: string;
  /** ADDED · REMOVED · CHANGED 등 BE 값 그대로 */
  change: string;
  beforeRequired: boolean | null;
  afterRequired: boolean | null;
}
export interface AdminConditionReview {
  id: string;
  storeId: string;
  kind: string;
  /** BE 상태 그대로 (RECEIVED · IN_REVIEW · NEEDS_SUPPLEMENT · APPROVED · REJECTED · CANCELED) */
  status: string;
  baseVersion: number | null;
  sourceText: string;
  currentVersion: number | null;
  current: RuleSet;
  requested: RuleSet;
  changes: PolicyChange[];
  evidenceUrls: string[];
  reviewNote: string | null;
  reviewedAt: string | null;
  createdAt: string;
}

type AdminDetailDto = {
  requestId: RawId;
  storeId?: RawId;
  kind?: string | null;
  status?: string;
  baseVersion?: number | null;
  sourceText?: string | null;
  currentPolicy?: (Partial<{ breedRules: unknown; equipmentRules: unknown; vaccineRules: unknown }> & { version?: number | null }) | null;
  requestedPolicy?: Partial<{ breedRules: unknown; equipmentRules: unknown; vaccineRules: unknown }> | null;
  changes?: PolicyChange[] | null;
  evidenceUrls?: string[] | null;
  reviewNote?: string | null;
  reviewedAt?: string | null;
  createdAt?: string | null;
};

/** 입장 조건 요청 상세 — GET /admin/condition-requests/{requestId} */
export async function getAdminConditionReview(id: string): Promise<AdminConditionReview> {
  const { data: d } = await apiClient.get<AdminDetailDto>(`/admin/condition-requests/${encodeURIComponent(id)}`);
  return {
    id: toId(d.requestId) ?? id,
    storeId: toId(d.storeId) ?? '',
    kind: d.kind ?? 'CONDITION_REQUEST',
    status: d.status ?? '',
    baseVersion: typeof d.baseVersion === 'number' ? d.baseVersion : null,
    sourceText: d.sourceText ?? '',
    currentVersion: typeof d.currentPolicy?.version === 'number' ? d.currentPolicy.version : null,
    current: toRuleSet(d.currentPolicy as never),
    requested: toRuleSet(d.requestedPolicy as never),
    changes: d.changes ?? [],
    evidenceUrls: d.evidenceUrls ?? [],
    reviewNote: d.reviewNote ?? null,
    reviewedAt: d.reviewedAt ?? null,
    createdAt: d.createdAt ?? '',
  };
}

export type ConditionReviewAction = 'START_REVIEW' | 'NEEDS_INFO' | 'APPROVE' | 'REJECT';

/** BE 규칙(ConditionRequestStatus.afterReview)대로 할 수 있는 처리 */
export function conditionActions(status: string): ConditionReviewAction[] {
  if (status === 'RECEIVED') return ['START_REVIEW'];
  if (status === 'IN_REVIEW') return ['APPROVE', 'NEEDS_INFO', 'REJECT'];
  return [];
}

/**
 * 입장 조건 심사 처리 — PATCH /admin/condition-requests/{requestId} { action, reviewComment?, approvedPolicy? }
 * 보완 요청 · 반려는 사유 필수. 승인 때 approvedPolicy 를 보내면 그 정책 '전체'로 새 버전이 돼요 (보내지 않으면 요청 정책 그대로).
 */
export async function reviewAdminCondition(id: string, action: ConditionReviewAction, comment: string, approvedPolicy: RuleSet | null): Promise<{ status: string; appliedPolicyVersion: number | null }> {
  const body: Record<string, unknown> = { action };
  if (comment.trim()) body.reviewComment = comment.trim();
  if (action === 'APPROVE' && approvedPolicy) body.approvedPolicy = toPolicyBody(approvedPolicy);
  const { data } = await apiClient.patch<{ status?: string; appliedPolicyVersion?: number | null }>(`/admin/condition-requests/${encodeURIComponent(id)}`, body);
  return { status: data?.status ?? '', appliedPolicyVersion: data?.appliedPolicyVersion ?? null };
}
