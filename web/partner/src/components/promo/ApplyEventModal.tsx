import { USE_MOCK } from '@/api/client';
import { useState } from 'react';
import { applyEvent, getEligibility, getEvent } from '@/api/promo';
import { Button } from '@/components/common/Button';
import { Choice, Field, Select, TextInput } from '@/components/common/Field';
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

const INTRO_MAX = 40;

interface Props {
  eventId: string;
  onClose: () => void;
  onBack: () => void;
  onDone: (applicationId: string) => void;
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
  // 참여 자격 조회는 백엔드 API 문서에 없어 서버 모드에서는 부르지 않아요 (신청할 때 서버가 확인)
  const elig = useFetch(`elig:${eventId}:${selectedId ?? 'none'}:${USE_MOCK}`, () => (!USE_MOCK ? Promise.resolve(null) : selectedId ? getEligibility(eventId, selectedId) : Promise.reject(new Error('신청할 수 있는 매장이 없어요.'))));
  // 참여 희망 지역 (이벤트 상세의 regions) — 처음엔 모두 고른 상태
  const regionOptions = ev.data?.regionOptions ?? [];
  const [regionPick, setRegionPick] = useState<string[] | null>(null);
  const pickedRegions = regionPick ?? regionOptions.map((r) => r.id);
  const [intro, setIntro] = useState('');
  const [pledge, setPledge] = useState(false);
  const submit = useAction(applyEvent);

  const e = elig.data;
  const introOk = intro.trim().length >= 1 && intro.length <= INTRO_MAX;
  const allowed = USE_MOCK ? e?.canApply === true : ev.data?.canApply === true && pickedRegions.length > 0;
  const canSubmit = Boolean(selectedId) && allowed && introOk && pledge && !submit.pending;

  const onSubmit = async () => {
    if (!canSubmit || !selectedId) return;
    const res = await submit.run({ eventId, storeId: selectedId, intro: intro.trim(), qrPledgeAgreed: true, regionIds: pickedRegions });
    if (res.ok) onDone(res.data.id);
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
            <Button onClick={onSubmit} disabled={!canSubmit}>
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

          {e && (
            <div className={styles.checkBox}>
              <strong>참여 조건 확인 · {formatDate(e.baseDate)} 기준</strong>
              {e.checks.map((c) => (
                <span key={c.code} className={c.passed ? styles.checkOk : styles.checkWarn}>
                  <Icon name={c.passed ? 'check' : 'warning'} size={16} />
                  {checkText(c)}
                </span>
              ))}
              <span className={pledge ? styles.checkOk : styles.checkTodo}>
                <Icon name={pledge ? 'check' : 'info'} size={16} />
                QR 비치 약속 동의 (아래에서 체크)
              </span>
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
          {!USE_MOCK && <Notice tone="info">참여 조건은 신청할 때 서버가 확인해요.</Notice>}
          {!USE_MOCK && ev.data.applyBlockedReason === 'ALREADY_APPLIED' && <Notice tone="warning">이미 이 이벤트에 신청한 매장이에요.</Notice>}
          {!USE_MOCK && ev.data.applyBlockedReason === 'NOT_RECRUITING' && <Notice tone="warning">지금은 참여 신청 기간이 아니에요.</Notice>}
          {e && !e.recruitmentOpen && <Notice tone="warning">지금은 참여 신청 기간이 아니에요.</Notice>}
          {e?.existingApplication && <Notice tone="warning">이미 이 분기에 신청한 매장이에요.</Notice>}
          {e && e.recruitmentOpen && !e.existingApplication && !e.allPassed && <Notice tone="warning">참여 조건을 확인해 주세요. 조건이 맞아야 신청할 수 있어요.</Notice>}

          <Field
            label="한 줄 소개"
            htmlFor="ap-intro"
            hint={`${intro.length} / ${INTRO_MAX}자 · 입장 조건과 다른 내용은 쓸 수 없어요.`}
            message={intro.length > INTRO_MAX ? { tone: 'error', text: `${INTRO_MAX}자 이내로 줄여 주세요` } : null}
          >
            <TextInput id="ap-intro" placeholder="예: 성수 산책길 끝 반려견 동반 카페예요" value={intro} aria-invalid={intro.length > INTRO_MAX} onChange={(ev2) => setIntro(ev2.target.value)} />
          </Field>

          <Choice type="checkbox" label="분기 동안 매장 QR을 보호자가 볼 수 있는 곳에 둘게요." checked={pledge} onChange={(ev2) => setPledge(ev2.target.checked)} />
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
