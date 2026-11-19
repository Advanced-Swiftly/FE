import type { ReactNode } from 'react';
import styles from './Card.module.css';

interface CardProps {
  title?: ReactNode;
  /** 제목 오른쪽 (버튼 · 보조 글자) */
  aside?: ReactNode;
  /** none: 표처럼 안쪽 여백 없이 꽉 채울 때 */
  padding?: 'md' | 'none';
  tone?: 'default' | 'warning' | 'subtle';
  id?: string;
  className?: string;
  children?: ReactNode;
}

/** 흰 배경 카드 섹션 */
export function Card({ title, aside, padding = 'md', tone = 'default', id, className, children }: CardProps) {
  return (
    <section id={id} className={[styles.card, styles[padding], styles[tone], className ?? ''].join(' ')}>
      {(title || aside) && (
        <div className={styles.head}>
          {title && <h2 className={styles.title}>{title}</h2>}
          {aside && <div className={styles.aside}>{aside}</div>}
        </div>
      )}
      {children}
    </section>
  );
}
