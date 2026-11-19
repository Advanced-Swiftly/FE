import { useEffect } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { getQueueSummary } from '@/api/queue';
import { Icon } from '@/components/common/Icon';
import { adminLogout } from '@/api/auth';
import { useFetch } from '@/hooks/useFetch';
import { useSession } from '@/hooks/useSession';
import { onCountsChanged } from '@/utils/counts';
import styles from './AdminSidebar.module.css';

// 배지는 명세가 주는 검토 대기열 badgeCount(F-OREV-01)만 써요. 증명서 · Q&A 건수는 명세에 없어 보이지 않아요 (백엔드 확인 사항).
const MENU: { to: string; label: string; badge?: boolean; icon: string }[] = [
  { to: '/queue', label: '검토 대기열', badge: true, icon: 'M4 6h16M4 12h16M4 18h10' },
  { to: '/vaccines', label: '증명서 확인', icon: 'M6 3h9l4 4v14H6zM9 13l2 2 4-4' },
  { to: '/stores', label: '업체 목록', icon: 'M4 10h16v10H4zM3 10l2-6h14l2 6M9 20v-5h6v5' },
  { to: '/stamp-road', label: '댕댕로드 추첨', icon: 'M4 9h16v11H4zM3 9h18M12 9v11M12 9c-2-4-6-4-6-1.5S9 9 12 9c3 0 6-1 6-1.5S14 5 12 9z' },
  { to: '/qna', label: 'Q&A', icon: 'M4 5h16v11H9l-5 4z' },
];

function MenuIcon({ d }: { d: string }) {
  return (
    <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d={d} />
    </svg>
  );
}

export function AdminSidebar() {
  const navigate = useNavigate();
  const session = useSession();
  const counts = useFetch('queue-summary:badge', getQueueSummary);

  // F-OAUTH-03: 서버에 로그아웃을 알리고(리프레시 토큰 무효), 실패해도 이 브라우저의 로그인은 지워요.
  const onLogout = async () => {
    await adminLogout().catch(() => undefined);
    navigate('/login', { replace: true });
  };
  const { reload } = counts;

  useEffect(() => onCountsChanged(reload), [reload]);

  return (
    <nav aria-label="운영자 메뉴" className={styles.sidebar}>
      <div className={styles.logo}>
        <span className={styles.logoText}>PawFit</span>
        <span className={styles.badgeLabel}>운영자</span>
      </div>
      {MENU.map((m) => {
        const n = m.badge ? (counts.data?.badgeCount ?? undefined) : undefined;
        return (
          <NavLink key={m.to} to={m.to} className={({ isActive }) => `${styles.link} ${isActive ? styles.active : ''}`}>
            <MenuIcon d={m.icon} />
            <span className={styles.label}>{m.label}</span>
            {n !== undefined && n > 0 && (
              <span className={styles.count} aria-label={`처리 대기 ${n}건`}>
                {n}
              </span>
            )}
          </NavLink>
        );
      })}
      <div className={styles.spacer} />
      <div className={styles.user}>
        <strong>운영팀</strong>
        <span>{session?.loginId}</span>
      </div>
      <button type="button" className={styles.link} onClick={onLogout}>
        <Icon name="logout" size={20} strokeWidth={1.8} />
        로그아웃
      </button>
    </nav>
  );
}
