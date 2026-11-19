import { Link } from 'react-router-dom';
import styles from './NotFoundPage.module.css';

export function NotFoundPage() {
  return (
    <div className={styles.page}>
      <strong className={styles.code}>404</strong>
      <p>페이지를 찾을 수 없어요.</p>
      <Link to="/">처음으로</Link>
    </div>
  );
}
