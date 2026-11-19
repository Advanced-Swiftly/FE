import { Link, Outlet, useNavigate } from 'react-router-dom';
import { logout } from '@/api/account';
import { Icon } from '@/components/common/Icon';
import { useSession } from '@/hooks/useSession';
import styles from './SignupLayout.module.css';

/** 가입 · 승인 대기 화면의 틀: 위쪽 로고 막대 + 가운데 본문 */
export function SignupLayout() {
  const navigate = useNavigate();
  const session = useSession();
  // 로그인한 뒤(계정 만들기 이후)에는 로그아웃을, 그 전에는 로그인 링크를 보여 줘요.
  const signedIn = session !== null;

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <Link to="/login" className={styles.brand}>
          <Icon name="paw" size={26} />
          <span className={styles.logo}>PawFit</span>
          <span className={styles.badge}>업체 센터</span>
        </Link>
        {signedIn ? (
          <div className={styles.right}>
            <span>{session.loginId}</span>
            <button
              type="button"
              className={styles.linkButton}
              onClick={async () => {
                await logout().catch(() => undefined);
                navigate('/login', { replace: true });
              }}
            >
              로그아웃
            </button>
          </div>
        ) : (
          <span className={styles.right}>
            이미 계정이 있나요? <Link to="/login">로그인</Link>
          </span>
        )}
      </header>
      <main className={styles.main}>
        <Outlet />
      </main>
    </div>
  );
}
