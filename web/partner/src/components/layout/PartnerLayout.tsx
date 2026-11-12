import { Outlet } from 'react-router-dom';
import { StoreProvider } from '@/contexts/StoreProvider';
import { Sidebar } from './Sidebar';
import styles from './PartnerLayout.module.css';

/** 로그인 후 화면 공통 틀: 왼쪽 사이드바 + 오른쪽 본문 */
export function PartnerLayout() {
  return (
    <StoreProvider>
      <div className={styles.shell}>
        <Sidebar />
        <main className={styles.main}>
          <Outlet />
        </main>
      </div>
    </StoreProvider>
  );
}
