import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import styles from './PageHeader.module.css';

interface Crumb {
  label: string;
  to?: string;
}

interface PageHeaderProps {
  title: ReactNode;
  description?: ReactNode;
  /** 제목 위 경로 (예: 입장 조건 현황 / 수정 요청) */
  breadcrumb?: Crumb[];
  /** 제목 옆 칩 */
  titleAside?: ReactNode;
  /** 제목 아래 작은 정보 (접수일 · 담당 등) */
  meta?: ReactNode;
  /** 오른쪽 버튼 영역 */
  actions?: ReactNode;
}

/** 화면 맨 위 제목 영역 */
export function PageHeader({ title, description, breadcrumb, titleAside, meta, actions }: PageHeaderProps) {
  return (
    <div className={styles.wrap}>
      {breadcrumb && (
        <nav aria-label="현재 위치" className={styles.crumbs}>
          {breadcrumb.map((c, i) => (
            <span key={c.label} className={styles.crumb}>
              {i > 0 && <span aria-hidden="true">/</span>}
              {c.to ? <Link to={c.to}>{c.label}</Link> : <span aria-current="page">{c.label}</span>}
            </span>
          ))}
        </nav>
      )}
      <header className={styles.header}>
        <div className={styles.text}>
          <div className={styles.titleRow}>
            <h1 className={styles.title}>{title}</h1>
            {titleAside}
          </div>
          {description && <p className={styles.description}>{description}</p>}
          {meta && <div className={styles.meta}>{meta}</div>}
        </div>
        {actions && <div className={styles.actions}>{actions}</div>}
      </header>
    </div>
  );
}
