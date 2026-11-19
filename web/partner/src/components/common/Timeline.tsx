import { Icon } from './Icon';
import styles from './Timeline.module.css';

export interface TimelineItem {
  title: string;
  meta?: string;
  /** done: 초록 ✓ / current: 지금 단계 / todo: 아직 / danger: 반려 등 */
  state: 'done' | 'current' | 'todo' | 'danger';
}

/** 처리 단계 · 이력 목록 */
export function Timeline({ items }: { items: TimelineItem[] }) {
  return (
    <ol className={styles.list}>
      {items.map((it, i) => (
        <li key={`${it.title}-${i}`} className={styles.item} aria-current={it.state === 'current' ? 'step' : undefined}>
          <span className={`${styles.dot} ${styles[it.state]}`}>
            {it.state === 'done' && <Icon name="check" size={14} strokeWidth={2.6} />}
            {it.state === 'danger' && <Icon name="close" size={14} strokeWidth={2.6} />}
            {it.state === 'current' && <span className={styles.inner} />}
          </span>
          <div className={styles.text}>
            <span className={styles[`title_${it.state}`]}>{it.title}</span>
            {it.meta && <span className={styles.meta}>{it.meta}</span>}
          </div>
        </li>
      ))}
    </ol>
  );
}
