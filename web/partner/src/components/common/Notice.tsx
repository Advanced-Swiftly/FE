import type { ReactNode } from 'react';
import { Icon, type IconName } from './Icon';
import styles from './Notice.module.css';

type Tone = 'info' | 'warning' | 'danger' | 'success';

const ICON: Record<Tone, IconName> = { info: 'info', warning: 'warning', danger: 'warning', success: 'checkCircle' };

interface NoticeProps {
  tone?: Tone;
  /** status: 방금 한 일의 결과 알림 (스크린리더가 읽어 줘요) */
  role?: 'note' | 'status' | 'alert';
  onClose?: () => void;
  /** 오른쪽 링크 · 버튼 */
  action?: ReactNode;
  children: ReactNode;
}

/** 안내 · 경고 · 결과 알림 상자 */
export function Notice({ tone = 'info', role = 'note', onClose, action, children }: NoticeProps) {
  return (
    <div role={role} className={`${styles.notice} ${styles[tone]}`}>
      <Icon name={ICON[tone]} size={20} className={styles.icon} />
      <div className={styles.body}>{children}</div>
      {action && <div className={styles.action}>{action}</div>}
      {onClose && (
        <button type="button" className={styles.close} aria-label="알림 닫기" onClick={onClose}>
          <Icon name="close" size={18} />
        </button>
      )}
    </div>
  );
}
