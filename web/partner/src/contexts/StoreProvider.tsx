import { useMemo, useState, type ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { getMyStores } from '@/api/stores';
import { LoadState } from '@/components/common/LoadState';
import { useFetch } from '@/hooks/useFetch';
import type { Store } from '@/types';
import { StoreContext } from './storeContext';

const STORAGE_KEY = 'pawfit.partner.storeId';

function readSavedId(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

/**
 * 사이드바에서 고른 매장을 모든 화면이 같이 쓰게 해 줘요.
 * 매장 목록은 F-WDASH-01 (getMyStores) 에서 받아요. 승인된 매장이 없으면 승인 대기 화면으로 보내요.
 */
export function StoreProvider({ children }: { children: ReactNode }) {
  const list = useFetch('my-stores', getMyStores);

  if (list.status !== 'success') {
    return (
      <div style={{ padding: 'var(--space-8)' }}>
        <LoadState status={list.status} errorText="매장 목록을 불러오지 못했어요." onRetry={list.reload} />
      </div>
    );
  }
  if (!list.data.some((s) => s.verification === 'APPROVED')) return <Navigate to="/signup/pending" replace />;
  return <StoreSelection stores={list.data}>{children}</StoreSelection>;
}

function StoreSelection({ stores, children }: { stores: Store[]; children: ReactNode }) {
  const approved = stores.filter((s) => s.verification === 'APPROVED');
  const [storeId, setStoreId] = useState(() => {
    const saved = readSavedId();
    return approved.some((s) => s.id === saved) ? (saved as string) : approved[0].id;
  });

  const value = useMemo(
    () => ({
      stores,
      store: approved.find((s) => s.id === storeId) ?? approved[0],
      selectStore: (id: string) => {
        if (!approved.some((s) => s.id === id)) return;
        setStoreId(id);
        try {
          localStorage.setItem(STORAGE_KEY, id);
        } catch {
          // 저장이 안 돼도 화면은 그대로 동작해요.
        }
      },
    }),
    // approved 는 stores 에서 만들어요.
    // oxlint-disable-next-line react-hooks/exhaustive-deps
    [stores, storeId],
  );

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}
