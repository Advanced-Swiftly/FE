import { USE_MOCK } from '@/api/client';
import { useState } from 'react';
import { applyEvent, getEligibility, getEvent } from '@/api/promo';
import { Button } from '@/components/common/Button';
import { Choice, Field, Select, TextArea } from '@/components/common/Field';
import { Icon } from '@/components/common/Icon';
import { LoadState } from '@/components/common/LoadState';
import { Modal } from '@/components/common/Modal';
import { Notice } from '@/components/common/Notice';
import { useAction } from '@/hooks/useAction';
import { useCurrentStore } from '@/hooks/useCurrentStore';
import { useFetch } from '@/hooks/useFetch';
import type { EligibilityCheck } from '@/types';
import { formatDate } from '@/utils/format';
import { ELIGIBILITY_LABEL, recruitmentText } from '@/utils/promo';
import styles from './Promo.module.css';

/** BE 전달사항(message) 최대 길이 */
const MESSAGE_MAX = 500;

interface Props {
  eventId: string;
  onClose: () => void;
  onBack: () => void;
  onDone: (applicationId: string, storeId: string) => void;
}

/** 확인일 30일 조건 설명 (없음 · 미래 날짜는 미충족) — 명세 7.6.2 UI-W-015 ② */
function checkText(c: EligibilityCheck) {
  if (c.code !== 'CONDITION_CHECKED_RECENT') return ELIGIBILITY_LABEL[c.code];
  const d = c.detail;
  if (!d?.checkedDate || d.reason === 'NO_DATE') return '입장 조건 확인일 없음 · 운영자 확인이 필요해요';
  if (d.reason === 'FUTURE_DATE') return `확인일 ${formatDate(d.checkedDate)} · 미래 날짜라 인정되지 않아요`;
  if (d.reason === 'OVER_30_DAYS') return `확인일 ${formatDate(d.checkedDate)} · ${d.daysSince}일 지났어요 (30일 이내여야 해요)`;
  return `확인일 ${formatDate(d.checkedDate)} · ${d.daysSince}일 전 (30일 이내)`;
}

/** UI-W-015 이벤트 참여 신청 (F-WAD-03 · 04) */
export function ApplyEventModal({ eventId, onClose, onBack, onDone }: Props) {
  const { store: current, stores } = useCurrentStore();
  const ev = useFetch(`event:${eventId}:${current.id}`, () => getEvent(eventId, current.id));
  const regions = ev.data?.regions ?? [];
  // 신청 가능한 매장: 서버가 준 applicablePlaces (지역 안 · 인증 승인 매장, F-WAD-02)
  const applicable = (ev.data?.applicablePlaces ?? []).map((p) => ({ id: p.placeId, name: stores.find((s) => s.id === p.placeId)?.name ?? p.name }));
  const [storeId, setStoreId] = useState(current.id);
  const selectedId = applicable.some((s) => s.id === storeId) ? storeId : applicable[0]?.id;
  // 참여 조건 사전 확인 — 조회에 실패하면 조건을 알 수 없으니 신청 버튼을 열지 않아요 (신청 때 서버가 한 번 더 검사해요)
  const elig = useFetch(`elig:${eventId}:${selectedId ?? 'none'}`, () => (selectedId ? getEligibility(eventId, selectedId) : Promise.resolve(null)));
  // 참여 희망 지역 (이벤트 상세의 regions) — 처음엔 모두 고른 상태
  const regionOptions = ev.data?.regionOptions ?? [];
  const [regionPick, setRegionPick] = useState<string[] | null>(null);
  const pickedRegions = regionPick ?? regionOptions.map((r) => r.id);
  const [intro, setIntro] = useState('');
  const [tried, setTried] = useState(false);
  const submit = useAction(applyEvent);

  const e = elig.data;
  const conditionsOk = e?.canApply === true;
  // 신청 버튼을 눌렀을 때 아직 입력하지 않은 항목을 알려 줘요
  const formBlockers = [
    !USE_MOCK && pickedRegions.length === 0 ? '참여 희망 지역을 하나 이상 골라 주세요.' : null,
    intro.length > MESSAGE_MAX ? `전달사항을 ${MESSAGE_MAX}자 이내로 줄여 주세요.` : null,
  ].filter((x): x is string => x !== null);
  const canSubmit = Boolean(selectedId) && conditionsOk && formBlockers.length === 0 && !submit.pending;

  const onSubmit = async () => {
    setTried(true);
    if (!canSubmit || !selectedId) return;
    const res = await submit.run({ eventId, storeId: selectedId, intro: intro.trim(), qrPledgeAgreed: true, regionIds: pickedRegions });
    if (res.ok) onDone(res.data.id, selectedId);
    // 그사이 조건이 바뀌었을 수 있어 다시 확인해요
    else elig.reload();
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={ev.data?.title ?? '참여 신청'}
      kicker={ev.data ? `참여 신청 · 신청 기간 ${recruitmentText(ev.data)}` : '참여 신청'}
      footer={
        <div className={styles.footerBetween}>
          <span className={styles.muted}>결과는 신청 내역에서 확인할 수 있어요</span>
          <div className={styles.footerButtons}>
            <Button variant="secondary" onClick={onBack}>
              이전
            </Button>
            <Button onClick={onSubmit} disabled={!conditionsOk || submit.pending}>
              {submit.pending ? '보내는 중…' : '신청하기'}
            </Button>
          </div>
        </div>
      }
    >
      <LoadState status={ev.status} />
      {ev.data && (
        <>
          <Field label="참여할 매장" htmlFor="ap-store" hint={`행사 대상 지역(${regions.join(' · ')})에 있는 인증 완료 매장만 보여요.`}>
            {applicable.length === 0 ? (
              <p className={styles.muted}>행사 대상 지역에 인증 완료된 매장이 없어요.</p>
            ) : (
              <Select id="ap-store" value={selectedId} onChange={(ev2) => setStoreId(ev2.target.value)}>
                {applicable.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </Select>
            )}
          </Field>

          {selectedId && elig.status === 'loading' && <p className={styles.muted}>참여 조건을 확인하고 있어요…</p>}
          {elig.status === 'error' && (
            <Notice
              tone="danger"
              role="alert"
              action={
                <Button variant="secondary" size="sm" onClick={elig.reload}>
                  다시 확인
                </Button>
              }
            >
              참여 조건을 확인하지 못해 지금은 신청할 수 없어요.
            </Notice>
          )}
          {e && (
            <div className={styles.checkBox}>
              <strong>참여 조건 확인 · {formatDate(e.baseDate)} 기준</strong>
              {e.checks.map((c) => (
                <span key={c.code} className={c.passed ? styles.checkOk : styles.checkWarn}>
                  <Icon name={c.passed ? 'check' : 'warning'} size={16} />
                  {checkText(c)}
                </span>
              ))}
            </div>
          )}
          {!USE_MOCK && regionOptions.length > 0 && (
            <fieldset className={styles.checkBox}>
              <legend>
                <strong>참여 희망 지역</strong>
              </legend>
              {regionOptions.map((r) => (
                <Choice
                  key={r.id}
                  type="checkbox"
                  label={r.name}
                  checked={pickedRegions.includes(r.id)}
                  onChange={(ev2) => setRegionPick(ev2.target.checked ? [...pickedRegions, r.id] : pickedRegions.filter((x) => x !== r.id))}
                />
              ))}
            </fieldset>
          )}
          {e?.canApply && <Notice tone="success">참여 조건을 모두 충족했어요. 내용을 적고 신청해 주세요.</Notice>}
          {e && !e.recruitmentOpen && <Notice tone="warning">지금은 참여 신청 기간이 아니에요.</Notice>}
          {e?.existingApplication && <Notice tone="warning">이미 이 분기에 신청한 매장이에요.</Notice>}
          {e && e.recruitmentOpen && !e.existingApplication && !e.allPassed && <Notice tone="warning">참여 조건을 확인해 주세요. 조건이 맞아야 신청할 수 있어요.</Notice>}

          <Field
            label="전달사항 (선택)"
            htmlFor="ap-message"
            hint={`${intro.length} / ${MESSAGE_MAX}자 · 운영자에게 전달할 내용이 있으면 적어 주세요.`}
            message={intro.length > MESSAGE_MAX ? { tone: 'error', text: `${MESSAGE_MAX}자 이내로 줄여 주세요` } : null}
          >
            <TextArea id="ap-message" rows={3} maxLength={MESSAGE_MAX} placeholder="예: 주말에도 운영하는 매장이에요" value={intro} onChange={(ev2) => setIntro(ev2.target.value)} />
          </Field>

          <Notice tone="info">참여가 승인되면 행사 기간 동안 매장 QR을 보호자가 볼 수 있는 곳에 비치해 주세요.</Notice>
          {tried && conditionsOk && formBlockers.length > 0 && (
            <Notice tone="warning" role="alert">
              {formBlockers.map((b) => (
                <span key={b} style={{ display: 'block' }}>
                  {b}
                </span>
              ))}
            </Notice>
          )}
          {submit.error && (
            <Notice tone="danger" role="alert">
              {submit.error}
            </Notice>
          )}
        </>
      )}
    </Modal>
  );
}
