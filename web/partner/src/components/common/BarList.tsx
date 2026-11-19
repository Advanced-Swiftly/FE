import styles from './BarList.module.css';

export interface BarItem {
  label: string;
  value: number;
  /** 오른쪽에 보여줄 글자 (기본: value) */
  display?: string;
  /** 진한 색으로 강조 (주말 · 최댓값) */
  highlight?: boolean;
}

interface BarListProps {
  items: BarItem[];
  labelWidth?: number;
  /** 막대 길이 기준값 (기본: 가장 큰 값) */
  max?: number;
}

/** 가로 막대 목록 (요일별 · 시간대별) */
export function BarList({ items, labelWidth = 20, max }: BarListProps) {
  const top = max ?? Math.max(1, ...items.map((i) => i.value));
  return (
    <ul className={styles.list}>
      {items.map((it) => (
        <li key={it.label} className={styles.row}>
          <span className={styles.label} style={{ width: labelWidth }}>
            {it.label}
          </span>
          <span className={styles.track} aria-hidden="true">
            <span className={`${styles.bar} ${it.highlight ? styles.strong : ''}`} style={{ width: `${(it.value / top) * 100}%` }} />
          </span>
          <span className={styles.value}>{it.display ?? it.value}</span>
        </li>
      ))}
    </ul>
  );
}
