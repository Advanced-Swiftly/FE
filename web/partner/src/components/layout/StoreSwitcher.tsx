import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useCurrentStore } from '@/hooks/useCurrentStore';
import styles from './StoreSwitcher.module.css';

/** 사이드바 위 업체 이름 → 누르면 드롭다운으로 매장 전환. 고른 매장은 모든 화면이 같이 써요. */
export function StoreSwitcher() {
  const [open, setOpen] = useState(false);
  const { store: current, stores, selectStore } = useCurrentStore();

  return (
    <div className={styles.wrap}>
      <button type="button" className={`${styles.trigger} ${open ? styles.open : ''}`} aria-haspopup="listbox" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
        <span className={styles.text}>
          <span className={styles.name}>{current.name}</span>
          <span className={styles.sub}>{[current.area, current.category].filter(Boolean).join(' · ') || '인증 완료'}</span>
        </span>
        <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M7 10l5 5 5-5" /></svg>
      </button>

      {open && (
        <div role="listbox" aria-label="관리할 업체" className={styles.menu}>
          {stores.map((s) => {
            const disabled = s.verification !== 'APPROVED';
            const selected = s.id === current.id;
            return (
              <button
                key={s.id}
                type="button"
                role="option"
                aria-selected={selected}
                disabled={disabled}
                className={`${styles.option} ${selected ? styles.selected : ''}`}
                onClick={() => {
                  selectStore(s.id);
                  setOpen(false);
                }}
              >
                <span className={styles.text}>
                  <span className={styles.name}>{s.name}</span>
                  <span className={styles.sub}>{disabled ? '승인 대기 · 전환 불가' : [s.area, s.category].filter(Boolean).join(' · ') || '인증 완료'}</span>
                </span>
                {selected && <span aria-hidden="true">✓</span>}
              </button>
            );
          })}
          <Link to="/signup/business" className={styles.add} onClick={() => setOpen(false)}>
            + 업체 추가
          </Link>
        </div>
      )}
    </div>
  );
}
