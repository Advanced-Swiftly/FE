import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import styles from './KpiCard.module.css';

interface KpiCardProps {
  label: string;
  value: string | number;
  unit?: string;
  caption?: string;
  /** warning: 노란 카드 (할 일 · 30일 경과 등) */
  tone?: 'default' | 'warning';
  /** 설명 글자 색 (증가 등) */
  captionTone?: 'muted' | 'success' | 'danger';
  /** 카드 전체를 링크로 */
  to?: string;
  /** 카드 아래쪽 링크 · 버튼 (to 와 같이 쓰지 않아요) */
  action?: ReactNode;
}

/** 요약 지표 카드: 라벨 · 값 · 단위 · 설명 */
export function KpiCard({ label, value, unit, caption, tone = 'default', captionTone = 'muted', to, action }: KpiCardProps) {
  const cls = `${styles.card} ${tone === 'warning' ? styles.warning : ''} ${to ? styles.link : ''}`;
  const body = (
    <>
      <span className={styles.label}>{label}</span>
      <span className={styles.value}>
        {value}
        {unit && <span className={styles.unit}> {unit}</span>}
      </span>
      {caption && <span className={`${styles.caption} ${styles[captionTone]}`}>{caption}</span>}
      {action && <span className={styles.action}>{action}</span>}
    </>
  );
  return to ? (
    <Link to={to} className={cls}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  );
}
