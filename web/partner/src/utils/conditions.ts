import { JUDGMENT, type Judgment } from '@/constants/status';
import type { AreaRule, ConditionField, ConditionState, Item, PlaceConditions, SampleDog, SizeLimit, UnrestrictableField } from '@/types';

/** 화면에 보여줄 순서 */
export const CONDITION_FIELDS: ConditionField[] = ['petAllowed', 'weightLimitKg', 'sizeLimit', 'restrictedBreeds', 'area', 'requiredItems', 'vaccinationRequired'];

export const UNRESTRICTABLE: UnrestrictableField[] = ['weightLimitKg', 'sizeLimit', 'restrictedBreeds', 'area', 'requiredItems'];

export const CONDITION_LABEL: Record<ConditionField, string> = {
  petAllowed: '동반 가능 여부',
  weightLimitKg: '체중 제한',
  sizeLimit: '크기 제한',
  restrictedBreeds: '견종 제한',
  area: '이용 구역',
  requiredItems: '준비물',
  vaccinationRequired: '예방접종',
};

export const SIZE_LABEL: Record<SizeLimit, string> = { SMALL: '소형견까지', MEDIUM: '중형견까지', LARGE: '대형견까지' };
export const AREA_LABEL: Record<AreaRule, string> = { INDOOR_OK: '실내 · 야외 모두', OUTDOOR_ONLY: '야외만' };
export const ITEM_LABEL: Record<Item, string> = { STROLLER: '유모차', CARRIER: '이동장', MANNER_BELT: '매너벨트', MUZZLE: '입마개' };

/** '제한 없음' 일 때 문구 */
const UNRESTRICTED_LABEL: Record<UnrestrictableField, string> = {
  weightLimitKg: '체중 제한 없음',
  sizeLimit: '크기 제한 없음',
  restrictedBreeds: '견종 제한 없음',
  area: '구역 제한 없음',
  requiredItems: '준비물 없음',
};

export type FieldState = 'LIMITED' | 'UNRESTRICTED' | 'UNKNOWN';

export const isUnrestrictable = (f: ConditionField): f is UnrestrictableField => (UNRESTRICTABLE as string[]).includes(f);

/** 필드 하나의 상태: 제한 있음 · 제한 없음 · 미확인 (명세 5.2절) */
export function fieldState(state: ConditionState, field: ConditionField): FieldState {
  if (isUnrestrictable(field) && state.unrestrictedFields.includes(field)) return 'UNRESTRICTED';
  return state.conditions[field] === null ? 'UNKNOWN' : 'LIMITED';
}

/** 값 하나를 문장으로 (unrestricted 면 '제한 없음' 문구, null 이면 '미확인') */
export function describeValue(field: ConditionField, value: PlaceConditions[ConditionField], unrestricted = false): string {
  if (unrestricted && isUnrestrictable(field)) return UNRESTRICTED_LABEL[field];
  if (value === null || value === undefined) return '미확인';
  switch (field) {
    case 'petAllowed':
      return value ? '동반 가능' : '동반 불가';
    case 'weightLimitKg':
      return `${value}kg 이하`;
    case 'sizeLimit':
      return SIZE_LABEL[value as SizeLimit];
    case 'restrictedBreeds':
      return `${(value as string[]).join(' · ')} 출입 제한`;
    case 'area':
      return AREA_LABEL[value as AreaRule];
    case 'requiredItems':
      return `${(value as Item[]).map((i) => ITEM_LABEL[i]).join(' · ')} 필수`;
    case 'vaccinationRequired':
      return value ? '종합백신 접종 증빙 필요' : '접종 확인하지 않음';
  }
}

export function describeField(state: ConditionState, field: ConditionField): string {
  return describeValue(field, state.conditions[field], fieldState(state, field) === 'UNRESTRICTED');
}

function sameValue(a: unknown, b: unknown) {
  if (Array.isArray(a) && Array.isArray(b)) return a.length === b.length && [...a].sort().join() === [...b].sort().join();
  return a === b;
}

/** 원래 조건과 비교해서 바뀐 필드 (값 또는 제한 없음 여부) */
export function changedFields(before: ConditionState, after: ConditionState): ConditionField[] {
  return CONDITION_FIELDS.filter((f) => fieldState(before, f) !== fieldState(after, f) || !sameValue(before.conditions[f], after.conditions[f]));
}

/**
 * 판정 미리보기 (서버 F-WREQ-07 이 오기 전까지 쓰는 단순 규칙).
 * 순서: 입장 불가 → 조건 확인 필요 → 준비 필요 → 입장 가능. 제한 없음은 '충족', 목록에 없는 null 은 '조건 확인 필요'.
 */
export function judge(state: ConditionState, dog: SampleDog): Judgment {
  const c = state.conditions;
  const st = (f: ConditionField) => fieldState(state, f);
  const SIZE_RANK: Record<SizeLimit, number> = { SMALL: 1, MEDIUM: 2, LARGE: 3 };

  if (c.petAllowed === false) return JUDGMENT.NO_ENTRY;
  if (st('weightLimitKg') === 'LIMITED' && dog.weightKg > (c.weightLimitKg as number)) return JUDGMENT.NO_ENTRY;
  if (st('sizeLimit') === 'LIMITED' && SIZE_RANK[dog.size] > SIZE_RANK[c.sizeLimit as SizeLimit]) return JUDGMENT.NO_ENTRY;
  if (st('restrictedBreeds') === 'LIMITED' && (c.restrictedBreeds as string[]).includes(dog.breed)) return JUDGMENT.NO_ENTRY;

  const unknown = CONDITION_FIELDS.some((f) => f !== 'area' && st(f) === 'UNKNOWN');
  if (unknown) return JUDGMENT.UNKNOWN;

  const missingItems = st('requiredItems') === 'LIMITED' && (c.requiredItems as Item[]).some((i) => !dog.items.includes(i));
  if (missingItems || (c.vaccinationRequired && !dog.vaccinated)) return JUDGMENT.PREPARE;
  return JUDGMENT.ENTRY_OK;
}
