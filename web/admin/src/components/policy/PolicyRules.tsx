import { useState } from 'react';
import { CODE_RE, diffConditions, KNOWN_CODE_LABEL, RULE_GROUP_LABEL, RULE_GROUPS, type PolicyRule, type RuleGroup, type RuleSet, type EntryConditions, type AreaPolicy } from '@/api/policy';
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
export function PolicyRulesView({ rules, breeds, compareTo, hideConditions = false }: { rules: RuleSet; breeds: Map<string, string>; compareTo?: RuleSet; hideConditions?: boolean }) {
  return (
    <dl className={styles.groups}>
      {rules.conditions && !hideConditions && <>
        <div className={styles.group}><dt>동반 여부</dt><dd>{rules.conditions.petsAllowed === false ? '동반 불가' : '동반 가능'}</dd></div>
        {(['indoor', 'outdoor'] as const).map(area => {
          const r = rules.conditions?.[area];
          return <div className={styles.group} key={area}><dt>{area === 'indoor' ? '실내' : '야외 테라스'}</dt><dd>
            {!r || r.allowed === false ? '이용 불가' : `${r.maxWeightKg ? `${r.maxWeightKg}kg 이하` : '체중 제한 없음'} · ${r.equipmentCodes.map(c => KNOWN_CODE_LABEL[c] ?? c).join(', ') || '준비물 제한 없음'}`}
          </dd></div>;
        })}
        <div className={styles.group}><dt>적용 시작일</dt><dd>{rules.conditions.effectiveFrom ?? '승인일부터'}</dd></div>
        <div className={styles.group}><dt>예방접종 조건 확인</dt><dd>{rules.conditions.vaccinationConfirmed ? '확인 완료' : '미확인'}</dd></div>
        <div className={styles.group}><dt>안내</dt><dd>{rules.conditions.notice || '등록된 공지 없음'}</dd></div>
      </>}
      {RULE_GROUPS.filter(g=>g!=='equipmentRules'||!rules.conditions).map((g) => {
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

/** 구역 · 체중 · 적용일 조건의 변경 전후 요약 */
export function ConditionChanges({ before, after }: { before?: EntryConditions | null; after?: EntryConditions | null }) {
  const rows = diffConditions(before, after);
  if (rows.length === 0) return <p className={styles.muted}>구역 · 체중 · 적용일 조건은 달라지지 않았어요.</p>;
  return (
    <dl className={styles.groups}>
      {rows.map((r) => (
        <div key={r.label} className={styles.group}>
          <dt>{r.label}</dt>
          <dd>
            <span className={styles.muted}>{r.before}</span> → <strong className={styles.changed}>{r.after}</strong>
          </dd>
        </div>
      ))}
    </dl>
  );
}

/** 정책 편집 — 지금 정책 전체를 받아서 고친 전체 정책을 돌려줘요 (빠진 조건이 지워지지 않게) */
export function PolicyRulesEditor({ value, onChange, breeds }: { value: RuleSet; onChange: (next: RuleSet) => void; breeds: Map<string, string> }) {
  return (
    <div className={styles.groups}>
      <AreaConditionsEditor value={value.conditions} requiredEquipment={value.equipmentRules.filter((r) => r.required).map((r) => r.code)} onChange={conditions => onChange({...value, conditions})} />
      {RULE_GROUPS.filter(g=>g!=='equipmentRules'||!value.conditions).map((g) => (
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

const AREA_EQUIPMENT = ['STROLLER', 'CARRIER', 'BELLY_BAND', 'LEASH'];

function AreaConditionsEditor({value,requiredEquipment,onChange}:{value?:EntryConditions|null;requiredEquipment:string[];onChange:(c:EntryConditions)=>void}) {
  // 구역을 지정하면 서버는 구역별 준비물만 판정해요. 처음 구역 조건을 만들 때 기존 필수 준비물이 빠지지 않게 이어받아요
  const c=value ?? {petsAllowed:true,indoor:{allowed:true,maxWeightKg:null,equipmentCodes:requiredEquipment},outdoor:{allowed:false,equipmentCodes:requiredEquipment}};
  const set=(patch:Partial<EntryConditions>)=>onChange({...c,...patch});
  const area=(key:'indoor'|'outdoor',patch:Partial<AreaPolicy>)=>set({[key]:{allowed:true,equipmentCodes:[],...c[key],...patch}});
  return <fieldset className={styles.group}>
    <legend>이용 구역·체중·적용일</legend>
    <Choice type="checkbox" label="반려견 동반 가능" checked={c.petsAllowed!==false} onChange={e=>set({petsAllowed:e.target.checked})}/>
    {(['indoor','outdoor'] as const).map(key=><div key={key}>
      <Choice type="checkbox" label={key==='indoor'?'실내 이용 가능':'야외 테라스 이용 가능'} checked={c[key]?.allowed===true} onChange={e=>area(key,{allowed:e.target.checked})}/>
      {c[key]?.allowed && <>
        <label>{key==='indoor'?'실내':'야외'} 최대 체중 (비우면 제한 없음)
          <TextInput type="number" min="0.01" max="9999.99" step="0.01" value={c[key]?.maxWeightKg ?? ''} onChange={e=>area(key,{maxWeightKg:e.target.value ? Number(e.target.value):null})}/>
        </label>
        {[...new Set([...AREA_EQUIPMENT,...(c[key]?.equipmentCodes ?? [])])].map(code=><Choice key={code} type="checkbox" label={`${KNOWN_CODE_LABEL[code] ?? code} 필수`} checked={c[key]?.equipmentCodes.includes(code) ?? false} onChange={e=>area(key,{equipmentCodes:e.target.checked ? [...(c[key]?.equipmentCodes ?? []),code]:(c[key]?.equipmentCodes ?? []).filter(x=>x!==code)})}/>)}
      </>}
    </div>)}
    <label>적용 시작일<TextInput type="date" value={c.effectiveFrom ?? ''} onChange={e=>set({effectiveFrom:e.target.value||null})}/></label>
    <label>공지 문장<TextInput maxLength={500} value={c.notice ?? ''} onChange={e=>set({notice:e.target.value})}/></label>
    <label>변경 사유<TextInput maxLength={500} value={c.changeReason ?? ''} onChange={e=>set({changeReason:e.target.value})}/></label>
    <Choice type="checkbox" label="예방접종 확인 조건 검토 완료" checked={c.vaccinationConfirmed===true} onChange={e=>set({vaccinationConfirmed:e.target.checked})}/>
  </fieldset>;
}
