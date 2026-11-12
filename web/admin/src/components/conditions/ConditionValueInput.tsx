import { useState } from 'react';
import { Choice, Select, TextInput } from '@/components/common/Field';
import type { AreaRule, ConditionField, ConditionState, Item, PlaceConditions, SizeLimit } from '@/types/conditions';
import { withField } from '@/utils/conditionEdit';
import { AREA_LABEL, CONDITION_LABEL, fieldState, isUnrestrictable, ITEM_LABEL, SIZE_LABEL, type FieldState } from '@/utils/conditions';
import styles from './ConditionValueInput.module.css';

interface ConditionValueInputProps {
  field: ConditionField;
  state: ConditionState;
  onChange: (next: ConditionState) => void;
  /** 입력칸 id 앞부분 (한 화면에 여러 개일 때 겹치지 않게) */
  idPrefix: string;
  disabled?: boolean;
}

const MODE_LABEL: Record<FieldState, string> = { LIMITED: '값 입력', UNRESTRICTED: '제한 없음', UNKNOWN: '미확인' };

/** 값을 처음 입력할 때 넣어 둘 기본값 */
const DEFAULT_VALUE: { [K in ConditionField]: NonNullable<PlaceConditions[K]> } = {
  petAllowed: true,
  weightLimitKg: 10,
  sizeLimit: 'SMALL',
  restrictedBreeds: [],
  area: 'INDOOR_OK',
  requiredItems: [],
  vaccinationRequired: true,
};

/**
 * 입장 조건 한 항목 입력 — 값 입력 · 제한 없음 · 미확인 세 가지 상태 (명세 5.2절).
 * 값은 place_conditions 형식 그대로예요: 동반 · 예방접종은 예/아니오, 체중은 숫자(kg), 준비물은 고르기, 견종은 목록.
 * 미확인(null)은 '제한 없음'과 다르게 저장돼요.
 */
export function ConditionValueInput({ field, state, onChange, idPrefix, disabled }: ConditionValueInputProps) {
  const mode = fieldState(state, field);
  const id = `${idPrefix}-${field}`;
  const value = state.conditions[field];
  const modes: FieldState[] = isUnrestrictable(field) ? ['LIMITED', 'UNRESTRICTED', 'UNKNOWN'] : ['LIMITED', 'UNKNOWN'];
  // 견종 목록은 입력하는 동안 쉼표 그대로 보여 줘요
  const [breedText, setBreedText] = useState(() => (Array.isArray(value) && field === 'restrictedBreeds' ? (value as string[]).join(', ') : ''));

  const setMode = (m: FieldState) => {
    if (m === 'UNRESTRICTED') onChange(withField(state, field, null, true));
    else if (m === 'UNKNOWN') onChange(withField(state, field, null, false));
    else {
      const v = value ?? DEFAULT_VALUE[field];
      if (field === 'restrictedBreeds') setBreedText((v as string[]).join(', '));
      onChange(withField(state, field, v, false));
    }
  };
  const set = (v: PlaceConditions[ConditionField]) => onChange(withField(state, field, v, false));

  const valueInput = () => {
    switch (field) {
      case 'petAllowed':
      case 'vaccinationRequired':
        return (
          <Select id={id} value={value ? 'true' : 'false'} disabled={disabled} onChange={(e) => set(e.target.value === 'true')} aria-label={`${CONDITION_LABEL[field]} 값`}>
            <option value="true">{field === 'petAllowed' ? '동반 가능' : '종합백신 접종 증빙 필요'}</option>
            <option value="false">{field === 'petAllowed' ? '동반 불가' : '접종 확인하지 않음'}</option>
          </Select>
        );
      case 'weightLimitKg':
        return (
          <span className={styles.inline}>
            <TextInput
              id={id}
              type="number"
              inputMode="decimal"
              min={0.5}
              max={100}
              step={0.5}
              disabled={disabled}
              className={styles.number}
              value={value === null ? '' : String(value)}
              aria-invalid={value === null || Number(value) <= 0}
              aria-label="체중 제한 (kg 이하)"
              onChange={(e) => set(e.target.value === '' ? null : Number(e.target.value))}
            />
            kg 이하
          </span>
        );
      case 'sizeLimit':
        return (
          <Select id={id} value={(value as SizeLimit) ?? 'SMALL'} disabled={disabled} onChange={(e) => set(e.target.value as SizeLimit)} aria-label="크기 제한">
            {(Object.keys(SIZE_LABEL) as SizeLimit[]).map((k) => (
              <option key={k} value={k}>
                {SIZE_LABEL[k]}
              </option>
            ))}
          </Select>
        );
      case 'area':
        return (
          <Select id={id} value={(value as AreaRule) ?? 'INDOOR_OK'} disabled={disabled} onChange={(e) => set(e.target.value as AreaRule)} aria-label="이용 구역">
            {(Object.keys(AREA_LABEL) as AreaRule[]).map((k) => (
              <option key={k} value={k}>
                {AREA_LABEL[k]}
              </option>
            ))}
          </Select>
        );
      case 'requiredItems': {
        const items = (value as Item[] | null) ?? [];
        return (
          <fieldset className={styles.items} disabled={disabled}>
            <legend className="sr-only">필수 준비물</legend>
            {(Object.keys(ITEM_LABEL) as Item[]).map((k) => (
              <Choice
                key={k}
                type="checkbox"
                label={ITEM_LABEL[k]}
                checked={items.includes(k)}
                onChange={(e) => set(e.target.checked ? [...items, k] : items.filter((i) => i !== k))}
              />
            ))}
          </fieldset>
        );
      }
      case 'restrictedBreeds':
        return (
          <TextInput
            id={id}
            disabled={disabled}
            placeholder="쉼표로 구분 (예: 진돗개, 시베리안 허스키)"
            value={breedText}
            aria-label="출입 제한 견종"
            onChange={(e) => {
              setBreedText(e.target.value);
              set(
                e.target.value
                  .split(',')
                  .map((b) => b.trim())
                  .filter(Boolean),
              );
            }}
          />
        );
    }
  };

  return (
    <div className={styles.wrap}>
      <div className={styles.modes} role="radiogroup" aria-label={`${CONDITION_LABEL[field]} 상태`}>
        {modes.map((m) => (
          <label key={m} className={`${styles.mode} ${mode === m ? styles.modeOn : ''}`}>
            <input type="radio" name={`${id}-mode`} value={m} checked={mode === m} disabled={disabled} onChange={() => setMode(m)} />
            {MODE_LABEL[m]}
          </label>
        ))}
      </div>
      {mode === 'LIMITED' && valueInput()}
    </div>
  );
}
