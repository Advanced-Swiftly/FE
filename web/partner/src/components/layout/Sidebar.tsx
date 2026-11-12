import { NavLink, useNavigate } from 'react-router-dom';
import { logout } from '@/api/account';
import { StoreSwitcher } from './StoreSwitcher';
import styles from './Sidebar.module.css';

const MAIN_MENU = [
  { to: '/dashboard', label: '대시보드', icon: 'M3 3h7v9H3zM14 3h7v5h-7zM14 12h7v9h-7zM3 16h7v5H3z' },
  { to: '/conditions', label: '입장 조건 현황', icon: 'M5 4h14v17H5zM9 3h6v3H9zM9 13l2 2 4-4' },
  { to: '/stats', label: 'QR 인증 통계', icon: 'M4 20V10M10 20V4M16 20v-7M2 20h20' },
  { to: '/promo', label: '광고 · 이벤트', icon: 'M3 11v2a1 1 0 0 0 1 1h3l6 4V6L7 10H4a1 1 0 0 0-1 1zM17 8a5 5 0 0 1 0 8' },
];

const SUB_MENU = [
  { to: '/inquiry', label: '문의하기', icon: 'M4 5h16v11H9l-5 4zM8 10h8' },
  { to: '/account', label: '계정 정보', icon: 'M12 4a4 4 0 1 0 0 8 4 4 0 0 0 0-8zM4 21c1-4 4-6 8-6s7 2 8 6' },
];

function Icon({ d }: { d: string }) {
  return (
    <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d={d} />
    </svg>
  );
}

function MenuLink({ to, label, icon }: { to: string; label: string; icon: string }) {
  return (
    <NavLink to={to} className={({ isActive }) => `${styles.link} ${isActive ? styles.active : ''}`}>
      <Icon d={icon} />
      {label}
    </NavLink>
  );
}

export function Sidebar() {
  const navigate = useNavigate();
  const onLogout = async () => {
    // 서버 요청이 실패해도 이 브라우저의 로그인은 지워요 (logout 안에서 처리)
    await logout().catch(() => undefined);
    navigate('/login', { replace: true });
  };
  return (
    <nav aria-label="업체 메뉴" className={styles.sidebar}>
      <div className={styles.logo}>
        <span className={styles.logoText}>PawFit</span>
        <span className={styles.badge}>업체 센터</span>
      </div>
      <StoreSwitcher />
      {MAIN_MENU.map((m) => (
        <MenuLink key={m.to} {...m} />
      ))}
      <div className={styles.spacer} />
      {SUB_MENU.map((m) => (
        <MenuLink key={m.to} {...m} />
      ))}
      <button type="button" className={`${styles.link} ${styles.muted} ${styles.logout}`} onClick={onLogout}>
        <Icon d="M15 4h4v16h-4M10 8l-4 4 4 4M6 12h10" />
        로그아웃
      </button>
    </nav>
  );
}
