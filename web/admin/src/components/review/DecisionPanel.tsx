import type { ReactNode } from 'react';
import { Button } from '@/components/common/Button';
import { Field, TextArea } from '@/components/common/Field';
import { Icon, type IconName } from '@/components/common/Icon';
import type { Decision } from '@/types';
import styles from './DecisionPanel.module.css';

const OPTION: Record<Decision, { label: string; icon: IconName }> = {
  APPROVE: { label: '승인', icon: 'check' },
  REVISE: { label: '보완 요청', icon: 'warning' },
  REJECT: { label: '반려', icon: 'close' },
};

const SUBMIT: Record<Decision, { label: string; variant: 'success' | 'caution' | 'dangerSolid' }> = {
  APPROVE: { label: '승인하기', variant: 'success' },
  REVISE: { label: '보완 요청 보내기', variant: 'caution' },
  REJECT: { label: '반려하기', variant: 'dangerSolid' },
};

/** 사유 최대 글자 수 (명세 F-OREV-06 · F-OAPP-02 [제안]) */
export const REASON_MAX = 200;

interface DecisionPanelProps {
  /** 이 건에 쓸 수 있는 처리 (업체 요청: 승인 · 보완 요청 · 반려 / AI 후보 · 신청: 승인 · 반려) */
  actions: Decision[];
  decision: Decision;
  onDecision: (d: Decision) => void;
  /** 업체에 보이는 사유 (보완 요청 · 반려 때 필수) */
  reason: string;
  onReason: (reason: string) => void;
  /** 고른 결과에 따라 아래에 보여줄 설명 */
  hint: ReactNode;
  /** 승인 버튼 이름 (예: '승인 · 조건 반영') */
  approveLabel?: string;
  /** 승인할 수 없는 이유 (있으면 승인 버튼이 꺼져요) */
  approveBlock?: string;
  pending: boolean;
  error?: string | null;
  onSubmit: () => void;
}

/** 검토 화면 오른쪽 '처리 결과' 상자 — [검토 시작] 뒤에만 보여요 */
export function DecisionPanel({ actions, decision, onDecision, reason, onReason, hint, approveLabel, approveBlock, pending, error, onSubmit }: DecisionPanelProps) {
  const reasonRequired = decision !== 'APPROVE';
  const reasonError = reasonRequired && !reason.trim() ? '사유를 적어 주세요' : reason.length > REASON_MAX ? `${REASON_MAX}자 이내로 적어 주세요` : null;
  const blocked = decision === 'APPROVE' && Boolean(approveBlock);
  const canSubmit = !pending && !blocked && !(reasonRequired && reasonError);

  return (
    <section className={styles.panel} aria-labelledby="decide-title">
      <h2 id="decide-title" className={styles.title}>
        처리 결과
      </h2>
      <div role="radiogroup" aria-label="처리 결과 선택" className={styles.options}>
        {actions.map((a) => (
          <button
            key={a}
            type="button"
            role="radio"
            aria-checked={decision === a}
            className={`${styles.option} ${styles[a]} ${decision === a ? styles.on : ''}`}
            onClick={() => onDecision(a)}
          >
            <Icon name={OPTION[a].icon} size={18} />
            {a === 'APPROVE' && approveLabel ? approveLabel : OPTION[a].label}
          </button>
        ))}
      </div>
      {reasonRequired && (
        <Field label="업체에 보이는 사유" htmlFor="decision-reason" hint={`${reason.length} / ${REASON_MAX}자 · 내부 메모는 업체 상세의 운영 메모에 남겨 주세요`} message={reasonError ? { tone: 'error', text: reasonError } : null}>
          <TextArea id="decision-reason" rows={4} value={reason} aria-invalid={Boolean(reasonError)} onChange={(e) => onReason(e.target.value)} />
        </Field>
      )}
      <p className={styles.hint}>{hint}</p>
      {blocked && (
        <p role="alert" className={styles.error}>
          {approveBlock}
        </p>
      )}
      {error && (
        <p role="alert" className={styles.error}>
          {error}
        </p>
      )}
      <Button variant={SUBMIT[decision].variant} size="lg" fullWidth disabled={!canSubmit} onClick={onSubmit}>
        {pending ? '처리 중…' : SUBMIT[decision].label}
      </Button>
    </section>
  );
}
