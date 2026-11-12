import { Icon } from '@/components/common/Icon';
import styles from './Signup.module.css';

const STEPS = ['계정 정보', '업체 인증', '운영자 승인'];

/** 가입 3단계 표시. current 는 1부터 시작해요. */
export function SignupSteps({ current }: { current: 1 | 2 | 3 }) {
  return (
    <ol aria-label="가입 단계" className={styles.steps}>
      {STEPS.map((label, i) => {
        const n = i + 1;
        const state = n < current ? 'done' : n === current ? 'current' : 'todo';
        return (
          <li key={label} aria-current={state === 'current' ? 'step' : undefined} className={`${styles.step} ${styles[state]}`}>
            <span className={styles.stepNum}>{state === 'done' ? <Icon name="check" size={16} strokeWidth={2.6} /> : n}</span>
            <span>
              {label}
              {state === 'done' && <span className="sr-only"> 완료</span>}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
