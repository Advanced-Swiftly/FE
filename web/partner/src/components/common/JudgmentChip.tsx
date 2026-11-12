import { JUDGMENT_LABEL, type Judgment } from '@/constants/status';
import styles from './Chip.module.css';

const TONE: Record<Judgment, string> = {
  ENTRY_OK: styles.ok,
  PREPARE: styles.prep,
  NO_ENTRY: styles.no,
  UNKNOWN: styles.unknown,
};

const ICON_PATH: Record<Judgment, string> = {
  ENTRY_OK: 'M8 12l3 3 5-6',
  PREPARE: 'M12 7v6M12 16.5v.01',
  NO_ENTRY: 'M9 9l6 6M15 9l-6 6',
  UNKNOWN: 'M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .8-1 1.5v.5M12 17v.01',
};

interface JudgmentChipProps {
  judgment: Judgment;
  label?: string;
}

/** 입장 판정 4단계 칩. 색만으로 구분하지 않도록 아이콘과 글자를 같이 보여줘요 (QUR-001). */
export function JudgmentChip({ judgment, label }: JudgmentChipProps) {
  return (
    <span className={`${styles.chip} ${styles.withIcon} ${TONE[judgment]}`}>
      <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
        <circle cx="12" cy="12" r="9" />
        <path d={ICON_PATH[judgment]} />
      </svg>
      {label ?? JUDGMENT_LABEL[judgment]}
    </span>
  );
}
