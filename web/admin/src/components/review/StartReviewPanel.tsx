import { Button } from '@/components/common/Button';
import styles from './DecisionPanel.module.css';

interface Props {
  pending: boolean;
  error?: string | null;
  disabled?: boolean;
  disabledReason?: string;
  onStart: () => void;
}

/** 접수 상태일 때 '처리 결과' 자리에 보이는 [검토 시작] (명세 7.6.2 UI-O-003 ⑥ · UI-O-004) */
export function StartReviewPanel({ pending, error, disabled, disabledReason, onStart }: Props) {
  return (
    <section className={styles.panel} aria-labelledby="start-title">
      <h2 id="start-title" className={styles.title}>
        처리 결과
      </h2>
      <p className={styles.hint}>
        아직 접수 상태예요. <strong>검토 시작</strong>을 누르면 ‘검토 중’이 되고 승인 · 반려를 고를 수 있어요. 업체는 검토가 시작되면 요청을 취소할 수 없어요.
      </p>
      {disabledReason && (
        <p role="alert" className={styles.error}>
          {disabledReason}
        </p>
      )}
      {error && (
        <p role="alert" className={styles.error}>
          {error}
        </p>
      )}
      <Button variant="dark" size="lg" fullWidth disabled={pending || disabled} onClick={onStart}>
        {pending ? '처리 중…' : '검토 시작'}
      </Button>
    </section>
  );
}
