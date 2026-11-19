import type { ReactNode } from 'react';
import styles from './StatGrid.module.css';

/** KpiCard 를 나란히 놓는 칸 */
export function StatGrid({ label, children }: { label: string; children: ReactNode }) {
  return (
    <section aria-label={label} className={styles.grid}>
      {children}
    </section>
  );
}
