import type { ConditionField, ConditionState, PlaceConditions } from '@/types/conditions';
import { fieldState, isUnrestrictable } from './conditions';

/** 조건 한 항목을 바꾼 새 ConditionState (값 · 제한 없음 · 미확인) */
export function withField(state: ConditionState, field: ConditionField, value: PlaceConditions[ConditionField], unrestricted: boolean): ConditionState {
  const conditions = { ...state.conditions, [field]: unrestricted ? null : value } as PlaceConditions;
  const rest = state.unrestrictedFields.filter((f) => f !== field);
  return { conditions, unrestrictedFields: unrestricted && isUnrestrictable(field) ? [...rest, field] : rest };
}

/** 저장 전에 막을 값 (값 입력인데 비어 있음 · 체중이 0 이하) */
export function invalidField(state: ConditionState, field: ConditionField) {
  if (fieldState(state, field) !== 'LIMITED') return false;
  const v = state.conditions[field];
  if (field === 'weightLimitKg') return v === null || !(Number(v) > 0);
  if (field === 'requiredItems' || field === 'restrictedBreeds') return !Array.isArray(v) || v.length === 0;
  return v === null;
}
