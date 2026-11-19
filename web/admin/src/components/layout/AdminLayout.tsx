import { Outlet } from 'react-router-dom';
import { AdminSidebar } from './AdminSidebar';
import styles from './AdminLayout.module.css';

/** 로그인 후 화면 공통 틀: 왼쪽 어두운 사이드바 + 오른쪽 본문 */
export function AdminLayout() {
  return (
    <div className={styles.shell}>
      <AdminSidebar />
      <main className={styles.main}>
        <Outlet />
      </main>
    </div>
  );
}
