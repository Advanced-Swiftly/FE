import { useState } from 'react';
import { CODE_RE, KNOWN_CODE_LABEL, RULE_GROUP_LABEL, RULE_GROUPS, type PolicyRule, type RuleGroup, type RuleSet } from '@/api/policy';
import { Button } from '@/components/common/Button';
import { Choice, InputRow, Select, TextInput } from '@/components/common/Field';
import styles from './PolicyRules.module.css';

/** 조건 코드 → 화면 이름 (견종은 견종 ID → 이름, 나머지는 아는 코드만 이름) */
function ruleName(group: RuleGroup, code: string, breeds: Map<string, string>) {
  if (group === 'breedRules') return breeds.get(code) ?? `견종 ${code}`;
  return KNOWN_CODE_LABEL[code] ? `${KNOWN_CODE_LABEL[code]} · ${code}` : code;
}

const REQ_TEXT: Record<RuleGroup, [string, string]> = {
  // required 의 뜻은 BE 문서에 '필수 여부'로만 있어서 그대로 보여 줘요
  breedRules: ['필수', '선택'],
  equipmentRules: ['필수', '선택'],
  vaccineRules: ['필수', '선택'],
};

/** 읽기 전용 정책 표 */
export function PolicyRulesView({ rules, breeds, compareTo }: { rules: RuleSet; breeds: Map<string, string>; compareTo?: RuleSet }) {
  return (
    <dl className={styles.groups}>
      {RULE_GROUPS.map((g) => {
        const list = rules[g];
        const before = compareTo?.[g];
        const removed = before ? before.filter((b) => !list.some((x) => x.code === b.code)) : [];
        return (
          <div key={g} className={styles.group}>
            <dt>{RULE_GROUP_LABEL[g]}</dt>
            <dd>
              {list.length === 0 && removed.length === 0 ? (
                <span className={styles.muted}>조건 없음</span>
              ) : (
                <ul className={styles.list}>
                  {list.map((r) => {
                    const prev = before?.find((b) => b.code === r.code);
                    const mark = before ? (!prev ? '추가' : prev.required !== r.required ? '변경' : null) : null;
                    return (
                      <li key={r.code} className={mark ? styles.changed : undefined}>
                        {ruleName(g, r.code, breeds)} <span className={styles.muted}>({REQ_TEXT[g][r.required ? 0 : 1]})</span>
                        {mark && <strong className={styles.mark}> · {mark}</strong>}
                      </li>
                    );
                  })}
                  {removed.map((r) => (
                    <li key={`removed-${r.code}`} className={styles.removed}>
                      {ruleName(g, r.code, breeds)} <strong className={styles.mark}> · 삭제</strong>
                    </li>
                  ))}
                </ul>
              )}
            </dd>
          </div>
        );
      })}
    </dl>
  );
}

/** 정책 편집 — 지금 정책 전체를 받아서 고친 전체 정책을 돌려줘요 (빠진 조건이 지워지지 않게) */
export function PolicyRulesEditor({ value, onChange, breeds }: { value: RuleSet; onChange: (next: RuleSet) => void; breeds: Map<string, string> }) {
  return (
    <div className={styles.groups}>
      {RULE_GROUPS.map((g) => (
        <GroupEditor key={g} group={g} list={value[g]} breeds={breeds} onChange={(list) => onChange({ ...value, [g]: list })} />
      ))}
    </div>
  );
}

function GroupEditor({ group, list, breeds, onChange }: { group: RuleGroup; list: PolicyRule[]; breeds: Map<string, string>; onChange: (list: PolicyRule[]) => void }) {
  const [code, setCode] = useState('');
  const isBreed = group === 'breedRules';
  const normalized = isBreed ? code : code.trim().toUpperCase();
  const dup = list.some((r) => r.code === normalized);
  const valid = isBreed ? breeds.has(normalized) : CODE_RE.test(normalized);
  const add = () => {
    if (!valid || dup) return;
    onChange([...list, { code: normalized, required: true }]);
    setCode('');
  };
  const id = `rule-${group}`;
  return (
    <fieldset className={styles.group}>
      <legend>{RULE_GROUP_LABEL[group]}</legend>
      {list.length === 0 ? (
        <p className={styles.muted}>조건 없음</p>
      ) : (
        <ul className={styles.list}>
          {list.map((r) => (
            <li key={r.code} className={styles.row}>
              <span>{ruleName(group, r.code, breeds)}</span>
              <Choice type="checkbox" label="필수" checked={r.required} onChange={(e) => onChange(list.map((x) => (x.code === r.code ? { ...x, required: e.target.checked } : x)))} />
              <Button variant="secondary" size="sm" onClick={() => onChange(list.filter((x) => x.code !== r.code))}>
                빼기
              </Button>
            </li>
          ))}
        </ul>
      )}
      <InputRow>
        {isBreed ? (
          <Select id={id} aria-label={`${RULE_GROUP_LABEL[group]} 추가`} value={code} onChange={(e) => setCode(e.target.value)}>
            <option value="">견종 고르기</option>
            {[...breeds.entries()]
              .filter(([bid]) => !list.some((r) => r.code === bid))
              .map(([bid, name]) => (
                <option key={bid} value={bid}>
                  {name}
                </option>
              ))}
          </Select>
        ) : (
          <TextInput id={id} aria-label={`${RULE_GROUP_LABEL[group]} 코드 추가`} placeholder={group === 'equipmentRules' ? '예: CARRIER' : '예: RABIES'} value={code} maxLength={80} onChange={(e) => setCode(e.target.value)} />
        )}
        <Button variant="secondary" onClick={add} disabled={!valid || dup}>
          추가
        </Button>
      </InputRow>
      {!isBreed && code && !valid && <p className={styles.error}>영문 대문자로 시작하는 코드(대문자 · 숫자 · _)만 쓸 수 있어요.</p>}
      {dup && <p className={styles.error}>이미 있는 조건이에요.</p>}
    </fieldset>
  );
}
