import type { ReactNode } from 'react';
import styles from './InfoList.module.css';

interface InfoListProps {
  rows: { label: string; value: ReactNode }[];
  /** 왼쪽 이름 칸 너비 */
  labelWidth?: number;
  /** 줄 사이 구분선 */
  divided?: boolean;
}

/** '이름 : 값' 목록 */
export function InfoList({ rows, labelWidth = 110, divided = true }: InfoListProps) {
  return (
    <dl className={`${styles.list} ${divided ? styles.divided : ''}`}>
      {rows.map((r) => (
        <div key={r.label} className={styles.row}>
          <dt style={{ width: labelWidth }}>{r.label}</dt>
          <dd>{r.value}</dd>
        </div>
      ))}
    </dl>
  );
}
