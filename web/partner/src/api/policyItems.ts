import type { PartnerRequest, RequestPage } from '@/types';
import { USE_MOCK } from './client';
import { getStorePolicy, KNOWN_CODE_LABEL, toRuleSet, type AreaPolicy, type PolicyRule, type RuleSet, type StorePolicy } from './policy';
import { getPendingConditionRequests, getRequestDetail, getRequestPage } from './requests';

/**
 * 서버 입장 정책을 목업과 같은 '항목별 표'로 보여 주기 위한 변환이에요.
 * BE 정책에 있는 항목만 보여 줘요 (크기 제한은 BE 에 없어요).
 */
export type PolicyItem = 'pets' | 'weight' | 'breed' | 'area' | 'equipment' | 'vaccine' | 'effectiveFrom' | 'notice';
export type PolicyItemState = 'LIMITED' | 'UNRESTRICTED' | 'UNKNOWN' | 'INFO';

export const POLICY_ITEMS: { key: PolicyItem; label: string }[] = [
  { key: 'pets', label: '동반 가능 여부' },
  { key: 'weight', label: '체중 제한' },
  { key: 'breed', label: '견종 제한' },
  { key: 'area', label: '이용 구역' },
  { key: 'equipment', label: '준비물' },
  { key: 'vaccine', label: '예방접종' },
  { key: 'effectiveFrom', label: '적용 시작일' },
  { key: 'notice', label: '공지 문장' },
];

export const policyItemLabel = (item: PolicyItem) => POLICY_ITEMS.find((x) => x.key === item)?.label ?? item;

const UNKNOWN = { state: 'UNKNOWN' as const, text: '미확인' };
const required = (list: PolicyRule[]) => list.filter((r) => r.required).map((r) => r.code);
const codeName = (code: string) => KNOWN_CODE_LABEL[code] ?? code;

/** 구역 조건이 있으면 구역별 준비물을, 없으면 기존 공통 준비물을 써요 (서버 판정과 같은 기준) */
const areaEquipment = (policy: RuleSet, area?: AreaPolicy | null) => area?.equipmentCodes ?? required(policy.equipmentRules);

function weightText(name: string, area: AreaPolicy) {
  return `${name} ${area.maxWeightKg ? `${area.maxWeightKg}kg 이하` : '체중 제한 없음'}`;
}

/** 표 한 줄의 현재 값 */
export function describePolicyItem(policy: StorePolicy, item: PolicyItem, breeds: Map<string, string>): { state: PolicyItemState; text: string } {
  if (!policy.exists) return UNKNOWN;
  const c = policy.conditions;
  const indoor = c?.indoor;
  const outdoor = c?.outdoor;
  const hasAreas = Boolean(indoor || outdoor);

  switch (item) {
    case 'pets':
      if (typeof c?.petsAllowed !== 'boolean') return UNKNOWN;
      return { state: 'LIMITED', text: c.petsAllowed ? '동반 가능' : '동반 불가' };
    case 'weight': {
      if (!hasAreas) return UNKNOWN;
      const open = [indoor?.allowed ? weightText('실내', indoor) : null, outdoor?.allowed ? weightText('야외', outdoor) : null].filter(Boolean);
      if (open.length === 0) return { state: 'LIMITED', text: '이용 가능한 구역 없음' };
      const limited = Boolean((indoor?.allowed && indoor.maxWeightKg) || (outdoor?.allowed && outdoor.maxWeightKg));
      return { state: limited ? 'LIMITED' : 'UNRESTRICTED', text: open.join(' · ') };
    }
    case 'breed': {
      const codes = required(policy.breedRules);
      if (codes.length === 0) return { state: 'UNRESTRICTED', text: '견종 제한 없음' };
      return { state: 'LIMITED', text: `${codes.map((code) => breeds.get(code) ?? `견종 ${code}`).join(' · ')} 출입 제한` };
    }
    case 'area': {
      if (!hasAreas) return UNKNOWN;
      const inOpen = indoor?.allowed === true;
      const outOpen = outdoor?.allowed === true;
      if (inOpen && outOpen) {
        const overLimit = Boolean(indoor?.maxWeightKg && (!outdoor?.maxWeightKg || outdoor.maxWeightKg > indoor.maxWeightKg));
        return { state: 'LIMITED', text: overLimit ? '실내 · 야외 모두 (체중 초과 시 야외 테라스만)' : '실내 · 야외 모두' };
      }
      return { state: 'LIMITED', text: inOpen ? '실내만 (야외 이용 불가)' : outOpen ? '야외만 (실내 이용 불가)' : '이용 가능한 구역 없음' };
    }
    case 'equipment': {
      if (!hasAreas) {
        const codes = required(policy.equipmentRules);
        return codes.length ? { state: 'LIMITED', text: `${codes.map(codeName).join(' · ')} 필수` } : { state: 'UNRESTRICTED', text: '준비물 없음' };
      }
      const parts = [
        indoor?.allowed && indoor.equipmentCodes.length ? `실내 ${indoor.equipmentCodes.map(codeName).join(' · ')} 필수` : null,
        outdoor?.allowed && outdoor.equipmentCodes.length ? `야외 ${outdoor.equipmentCodes.map(codeName).join(' · ')} 필수` : null,
      ].filter(Boolean);
      return parts.length ? { state: 'LIMITED', text: parts.join(' · ') } : { state: 'UNRESTRICTED', text: '준비물 없음' };
    }
    case 'vaccine': {
      const codes = required(policy.vaccineRules);
      if (codes.length) return { state: 'LIMITED', text: `${codes.map(codeName).join(' · ')} 필수` };
      return c?.vaccinationConfirmed ? { state: 'UNRESTRICTED', text: '필수 예방접종 없음' } : UNKNOWN;
    }
    case 'effectiveFrom':
      return c?.effectiveFrom ? { state: 'INFO', text: c.effectiveFrom } : UNKNOWN;
    case 'notice':
      return { state: 'INFO', text: c?.notice?.trim() || '등록된 공지 없음' };
  }
}

const sorted = (list: string[]) => [...list].sort().join(',');

/** 값이 같으면 항상 같은 문자열 — 객체 키 순서와 상관없이 비교해요 */
function itemKey(policy: RuleSet, item: PolicyItem) {
  const c = policy.conditions;
  switch (item) {
    case 'pets':
      return String(c?.petsAllowed !== false);
    case 'weight':
      return [c?.indoor?.maxWeightKg ?? '', c?.outdoor?.maxWeightKg ?? ''].join('|');
    case 'breed':
      return sorted(required(policy.breedRules));
    case 'area':
      return [c?.indoor ? c.indoor.allowed !== false : '', c?.outdoor ? c.outdoor.allowed !== false : ''].join('|');
    case 'equipment':
      return [sorted(areaEquipment(policy, c?.indoor)), sorted(areaEquipment(policy, c?.outdoor))].join('|');
    case 'vaccine':
      return [sorted(required(policy.vaccineRules)), c?.vaccinationConfirmed === true].join('|');
    case 'effectiveFrom':
      return c?.effectiveFrom ?? '';
    case 'notice':
      return c?.notice?.trim() ?? '';
  }
}

/** 고친 정책으로 표 항목의 값을 다시 읽어요 */
export const draftPolicy = (base: StorePolicy, value: RuleSet): StorePolicy => ({ ...base, ...value, exists: true });

/** 표 항목 중 달라진 것 */
export function changedPolicyItems(before: RuleSet, after: RuleSet): PolicyItem[] {
  return POLICY_ITEMS.flatMap(({ key }) => (itemKey(before, key) !== itemKey(after, key) ? [key] : []));
}

/** 표 항목과 변경 사유까지 포함해 달라졌는지 */
export const policyChanged = (before: RuleSet, after: RuleSet) =>
  changedPolicyItems(before, after).length > 0 || (before.conditions?.changeReason?.trim() ?? '') !== (after.conditions?.changeReason?.trim() ?? '');

/** 요청 제목에 쓰는 항목 이름 — 표 이름에 '조건'을 붙여야 자연스러운 것만 바꿔요 */
const TITLE_LABEL: Partial<Record<PolicyItem, string>> = { equipment: '준비물 조건', vaccine: '예방접종 조건' };
const titleLabel = (item: PolicyItem) => TITLE_LABEL[item] ?? policyItemLabel(item);

/** 바뀐 항목으로 만든 제목 — 예: '체중 제한 · 이용 구역 외 2건 변경' */
function conditionTitle(items: PolicyItem[]) {
  const names = items.slice(0, 2).map(titleLabel).join(' · ');
  return items.length > 2 ? `${names} 외 ${items.length - 2}건 변경` : `${names} 변경`;
}

/**
 * 비교할 수 없을 때는 요청에 적힌 제목을 써요.
 * 처리 상태는 목록의 상태 표시로 보여 주니 끝의 상태 말은 빼고, 짧은 제목이면 '변경'을 붙여 형식을 맞춰요.
 * 문장처럼 긴 정책 원문은 그대로 둬요.
 */
function fallbackTitle(text: string) {
  const base = text.replace(/\s*(접수|검토 중|보완 요청|보완|승인|반려|취소)$/, '') || text;
  if (/(변경|추가|삭제|수정)$/.test(base) || base.length > 20 || /[,.…·]/.test(base)) return base;
  return `${base} 변경`;
}

/**
 * 요청 목록 — 입장 조건 요청의 제목을 '바꾸는 조건'으로 보여 줘요.
 * 기준 버전이 지금 정책과 같을 때만 비교할 수 있고, 비교할 수 없으면 요청에 적힌 원문으로 보여 줘요.
 */
export async function getTitledRequestPage(storeId: string, opts: Parameters<typeof getRequestPage>[1] = {}): Promise<RequestPage> {
  const page = await getRequestPage(storeId, opts);
  if (USE_MOCK) return page;
  const policy = await getStorePolicy(storeId).catch(() => null);
  const items = await Promise.all(
    page.items.map(async (request) => {
      if (request.kind !== 'CONDITION' || request.operatorLabel) return request;
      const detail = policy ? await getRequestDetail(request.id).catch(() => null) : null;
      const changed = policy && detail?.requestedPolicy && detail.baseVersion === policy.version ? changedPolicyItems(policy, toRuleSet(detail.requestedPolicy)) : [];
      const title = changed.length ? conditionTitle(changed) : request.sourcePreview ? fallbackTitle(request.sourcePreview) : null;
      return { ...request, sourcePreview: title };
    }),
  );
  return { ...page, items };
}

export type PendingLinkKind = 'LINKED' | 'NO_MATCH' | 'STALE' | 'DETAIL_FAILED';

export interface PendingRequestLink {
  request: PartnerRequest;
  kind: PendingLinkKind;
  /** LINKED 일 때 이 요청이 바꾸는 표 항목 */
  items: PolicyItem[];
  /** 접수 · 보완 요청 상태에서만 업체가 취소할 수 있어요 */
  canCancel: boolean;
}

/**
 * 진행 중 요청을 표 항목과 연결해요.
 * 요청의 기준 버전이 지금 정책 버전과 같을 때만 비교할 수 있고, 그 밖의 요청은 어느 행에도 붙이지 않아요.
 */
export async function getPendingRequestLinks(storeId: string, policy: StorePolicy): Promise<PendingRequestLink[]> {
  const requests = await getPendingConditionRequests(storeId);
  return Promise.all(
    requests.map(async (request): Promise<PendingRequestLink> => {
      try {
        const detail = await getRequestDetail(request.id);
        const base = { request: { ...request, status: detail.status }, canCancel: detail.canCancel };
        if (detail.baseVersion !== policy.version) return { ...base, kind: 'STALE', items: [] };
        const items = detail.requestedPolicy ? changedPolicyItems(policy, toRuleSet(detail.requestedPolicy)) : [];
        return { ...base, kind: items.length ? 'LINKED' : 'NO_MATCH', items };
      } catch {
        return { request, kind: 'DETAIL_FAILED', items: [], canCancel: false };
      }
    }),
  );
}
