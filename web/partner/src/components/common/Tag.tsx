import type { ReactNode } from 'react';
import styles from './Tag.module.css';

export type TagTone = 'gray' | 'blue' | 'orange' | 'green' | 'red' | 'yellow' | 'dark' | 'primary';

interface TagProps {
  tone?: TagTone;
  /** pill: 둥근 칩 / square: 모서리 6px 라벨 */
  shape?: 'pill' | 'square';
  children: ReactNode;
}

/** 종류 · 상태를 나타내는 작은 라벨 */
export function Tag({ tone = 'gray', shape = 'square', children }: TagProps) {
  return <span className={`${styles.tag} ${styles[tone]} ${styles[shape]}`}>{children}</span>;
}
