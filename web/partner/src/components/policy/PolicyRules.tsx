import { useState, type ReactNode } from 'react';
import { CODE_RE, diffConditions, KNOWN_CODE_LABEL, RULE_GROUP_LABEL, RULE_GROUPS, type PolicyRule, type RuleGroup, type RuleSet, type EntryConditions, type AreaPolicy, type StorePolicy } from '@/api/policy';
import { changedPolicyItems, describePolicyItem, draftPolicy, policyItemLabel, type PolicyItem } from '@/api/policyItems';
import { Button } from '@/components/common/Button';
import { Choice, Field, InputRow, Select, TextArea, TextInput } from '@/components/common/Field';
import { Icon } from '@/components/common/Icon';
import { Tag } from '@/components/common/Tag';
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
export function PolicyRulesView({ rules, breeds, compareTo, hideConditions = false, indoorAction }: { rules: RuleSet; breeds: Map<string, string>; compareTo?: RuleSet; hideConditions?: boolean; indoorAction?: ReactNode }) {
  return (
    <dl className={styles.groups}>
      {rules.conditions && !hideConditions && <>
        <div className={styles.group}><dt>동반 여부</dt><dd>{rules.conditions.petsAllowed === false ? '동반 불가' : '동반 가능'}</dd></div>
        {(['indoor', 'outdoor'] as const).map(area => {
          const r = rules.conditions?.[area];
          return <div className={styles.group} key={area}><dt>{area === 'indoor' ? '실내' : '야외 테라스'}</dt><dd>
            {!r || r.allowed === false ? '이용 불가' : `${r.maxWeightKg ? `${r.maxWeightKg}kg 이하` : '체중 제한 없음'} · ${r.equipmentCodes.map(c => KNOWN_CODE_LABEL[c] ?? c).join(', ') || '준비물 제한 없음'}`}
            {area === 'indoor' && indoorAction && <div>{indoorAction}</div>}
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

interface SectionContext {
  base: StorePolicy;
  value: RuleSet;
  breeds: Map<string, string>;
}

/** 표 항목 하나의 입력 카드 — 지금 값과 바뀐 값을 함께 보여 줘요 */
function ItemSection({ item, base, value, breeds, children }: SectionContext & { item: PolicyItem; children: ReactNode }) {
  const titleId = `policy-title-${item}`;
  const isChanged = changedPolicyItems(base, value).includes(item);
  const before = describePolicyItem(base, item, breeds).text;
  const after = describePolicyItem(draftPolicy(base, value), item, breeds).text;
  return (
    <section id={`policy-item-${item}`} aria-labelledby={titleId} className={`${styles.section} ${isChanged ? styles.sectionChanged : ''}`}>
      <header className={styles.sectionHead}>
        <h3 id={titleId} className={styles.sectionTitle}>
          {policyItemLabel(item)}
          {isChanged && (
            <Tag tone="primary" shape="pill">
              변경됨
            </Tag>
          )}
        </h3>
        <span className={styles.current}>지금: {before}</span>
      </header>
      {children}
      {isChanged && before !== after && (
        <p className={styles.diff}>
          <del>{before}</del>
          <Icon name="arrowRight" size={16} />
          <ins>{after}</ins>
        </p>
      )}
    </section>
  );
}

const AREA_NAME = { indoor: '실내', outdoor: '야외 테라스' } as const;
const AREA_KEYS = ['indoor', 'outdoor'] as const;
const AREA_EQUIPMENT = ['STROLLER', 'CARRIER', 'BELLY_BAND', 'LEASH'];
const VACCINE_OPTIONS = ['RABIES', 'DHPPL'];

/** 정책 편집 — 지금 정책 전체를 받아서 고친 전체 정책을 돌려줘요 (빠진 조건이 지워지지 않게) */
export function PolicyRulesEditor({ base, value, onChange, breeds }: { base: StorePolicy; value: RuleSet; onChange: (next: RuleSet) => void; breeds: Map<string, string> }) {
  const requiredEquipment = value.equipmentRules.filter((r) => r.required).map((r) => r.code);
  // 구역을 지정하면 서버는 구역별 준비물만 판정해요. 처음 구역 조건을 만들 때 기존 필수 준비물이 빠지지 않게 이어받아요
  const c: EntryConditions = value.conditions ?? { petsAllowed: true, indoor: { allowed: true, maxWeightKg: null, equipmentCodes: requiredEquipment }, outdoor: { allowed: false, equipmentCodes: requiredEquipment } };
  const set = (patch: Partial<EntryConditions>) => onChange({ ...value, conditions: { ...c, ...patch } });
  const area = (key: 'indoor' | 'outdoor', patch: Partial<AreaPolicy>) => set({ [key]: { allowed: true, equipmentCodes: [], ...c[key], ...patch } });
  const setRules = (group: RuleGroup, list: PolicyRule[]) => onChange({ ...value, [group]: list });
  const openAreas = AREA_KEYS.filter((key) => c[key]?.allowed);
  // 실내 제한을 넘는 반려견이 야외를 쓸 수 있는지 — 별도 필드 없이 야외 구역 조건으로 저장해요
  const indoorLimit = c.indoor?.allowed ? c.indoor.maxWeightKg : null;
  const outdoorForOverLimit = c.outdoor?.allowed === true && (!c.outdoor.maxWeightKg || (indoorLimit != null && c.outdoor.maxWeightKg > indoorLimit));
  const section = { base, value, breeds };
  const noArea = <p className={styles.muted}>이용 구역을 먼저 골라 주세요.</p>;

  return (
    <div className={styles.sections}>
      <ItemSection item="pets" {...section}>
        <div className={styles.choices}>
          <Choice type="radio" name="policy-pets" boxed label="동반 가능" checked={c.petsAllowed !== false} onChange={() => set({ petsAllowed: true })} />
          <Choice type="radio" name="policy-pets" boxed label="동반 불가" checked={c.petsAllowed === false} onChange={() => set({ petsAllowed: false })} />
        </div>
      </ItemSection>

      <ItemSection item="area" {...section}>
        <div className={styles.choices}>
          {AREA_KEYS.map((key) => (
            <Choice key={key} type="checkbox" boxed label={`${AREA_NAME[key]} 이용 가능`} checked={c[key]?.allowed === true} onChange={(e) => area(key, { allowed: e.target.checked })} />
          ))}
        </div>
      </ItemSection>

      <ItemSection item="weight" {...section}>
        {openAreas.length === 0 ? (
          noArea
        ) : (
          <div className={styles.twoCol}>
            {openAreas.map((key) => (
              <Field key={key} label={`${AREA_NAME[key]} 최대 체중`} htmlFor={`area-${key}-weight`} hint="비우면 체중 제한 없음">
                <div className={styles.inline}>
                  <TextInput id={`area-${key}-weight`} className={styles.number} type="number" min="0.01" max="9999.99" step="0.01" value={c[key]?.maxWeightKg ?? ''} onChange={(e) => area(key, { maxWeightKg: e.target.value ? Number(e.target.value) : null })} />
                  <span>kg 이하</span>
                </div>
              </Field>
            ))}
          </div>
        )}
        {indoorLimit ? (
          <div role="radiogroup" aria-labelledby="policy-over-limit" className={styles.subGroup}>
            <span id="policy-over-limit" className={styles.subLabel}>
              실내 제한 체중을 넘는 반려견
            </span>
            <div className={styles.choices}>
              <Choice type="radio" name="over-limit" boxed label="입장 불가" checked={!outdoorForOverLimit} onChange={() => area('outdoor', { allowed: false })} />
              <Choice type="radio" name="over-limit" boxed label="야외 테라스만 이용 가능" checked={outdoorForOverLimit} onChange={() => area('outdoor', { allowed: true, maxWeightKg: null })} />
            </div>
          </div>
        ) : null}
      </ItemSection>

      <ItemSection item="breed" {...section}>
        <GroupEditor group="breedRules" list={value.breedRules} breeds={breeds} onChange={(list) => setRules('breedRules', list)} />
      </ItemSection>

      <ItemSection item="equipment" {...section}>
        {openAreas.length === 0
          ? noArea
          : openAreas.map((key) => (
              <div key={key} role="group" aria-label={`${AREA_NAME[key]} 필수 준비물`} className={styles.subGroup}>
                <span className={styles.subLabel}>{AREA_NAME[key]} 필수 준비물</span>
                <div className={styles.choices}>
                  {[...new Set([...AREA_EQUIPMENT, ...(c[key]?.equipmentCodes ?? [])])].map((code) => (
                    <Choice
                      key={code}
                      type="checkbox"
                      boxed
                      label={KNOWN_CODE_LABEL[code] ?? code}
                      checked={c[key]?.equipmentCodes.includes(code) ?? false}
                      onChange={(e) => area(key, { equipmentCodes: e.target.checked ? [...(c[key]?.equipmentCodes ?? []), code] : (c[key]?.equipmentCodes ?? []).filter((x) => x !== code) })}
                    />
                  ))}
                </div>
              </div>
            ))}
        {!value.conditions && <GroupEditor group="equipmentRules" list={value.equipmentRules} breeds={breeds} onChange={(list) => setRules('equipmentRules', list)} />}
      </ItemSection>

      <ItemSection item="vaccine" {...section}>
        <GroupEditor group="vaccineRules" list={value.vaccineRules} breeds={breeds} onChange={(list) => setRules('vaccineRules', list)} />
        <Choice type="checkbox" label="예방접종 확인 조건 검토 완료" checked={c.vaccinationConfirmed === true} onChange={(e) => set({ vaccinationConfirmed: e.target.checked })} />
      </ItemSection>

      <ItemSection item="effectiveFrom" {...section}>
        <Field label="적용 시작일" htmlFor="policy-effective-from" hideLabel>
          <TextInput id="policy-effective-from" className={styles.narrow} type="date" value={c.effectiveFrom ?? ''} onChange={(e) => set({ effectiveFrom: e.target.value || null })} />
        </Field>
      </ItemSection>

      <ItemSection item="notice" {...section}>
        <Field label="공지 문장" htmlFor="policy-notice" hideLabel hint={`${(c.notice ?? '').length}/500`}>
          <TextArea id="policy-notice" rows={2} maxLength={500} value={c.notice ?? ''} onChange={(e) => set({ notice: e.target.value })} />
        </Field>
      </ItemSection>

      <section aria-labelledby="policy-title-reason" className={styles.section}>
        <header className={styles.sectionHead}>
          <h3 id="policy-title-reason" className={styles.sectionTitle}>
            변경 사유
          </h3>
        </header>
        <Field label="변경 사유" htmlFor="policy-change-reason" hideLabel hint={`${(c.changeReason ?? '').length}/500`}>
          <TextInput id="policy-change-reason" maxLength={500} value={c.changeReason ?? ''} onChange={(e) => set({ changeReason: e.target.value })} />
        </Field>
      </section>
    </div>
  );
}

function GroupEditor({ group, list, breeds, onChange }: { group: RuleGroup; list: PolicyRule[]; breeds: Map<string, string>; onChange: (list: PolicyRule[]) => void }) {
  const [code, setCode] = useState('');
  const isBreed = group === 'breedRules';
  const isVaccine = group === 'vaccineRules';
  const normalized = isBreed ? code : code.trim().toUpperCase();
  const dup = list.some((r) => r.code === normalized);
  const valid = isBreed ? breeds.has(normalized) : isVaccine ? VACCINE_OPTIONS.includes(normalized) : CODE_RE.test(normalized);
  const add = () => {
    if (!valid || dup) return;
    onChange([...list, { code: normalized, required: true }]);
    setCode('');
  };
  const id = `rule-${group}`;
  return (
    <div className={styles.subGroup}>
      {list.length > 0 && (
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
        {isVaccine ? (
          <Select id={id} aria-label={`${RULE_GROUP_LABEL[group]} 추가`} value={code} onChange={(e) => setCode(e.target.value)}>
            <option value="">예방접종 고르기</option>
            {VACCINE_OPTIONS.filter((v) => !list.some((r) => r.code === v)).map((v) => (
              <option key={v} value={v}>
                {KNOWN_CODE_LABEL[v]}
              </option>
            ))}
          </Select>
        ) : isBreed ? (
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
          <TextInput id={id} aria-label={`${RULE_GROUP_LABEL[group]} 코드 추가`} placeholder="예: CARRIER" value={code} maxLength={80} onChange={(e) => setCode(e.target.value)} />
        )}
        <Button variant="secondary" onClick={add} disabled={!valid || dup}>
          추가
        </Button>
      </InputRow>
      {!isBreed && code && !valid && <p className={styles.error}>영문 대문자로 시작하는 코드(대문자 · 숫자 · _)만 쓸 수 있어요.</p>}
      {dup && <p className={styles.error}>이미 있는 조건이에요.</p>}
    </div>
  );
}
