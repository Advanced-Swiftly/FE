import { useContext } from 'react';
import { StoreContext } from '@/contexts/storeContext';

/** 사이드바에서 고른 매장. PartnerLayout 안의 화면에서만 써요. */
export function useCurrentStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useCurrentStore 는 StoreProvider 안에서만 쓸 수 있어요.');
  return ctx;
}

/** 매장 틀 밖(승인 대기 화면 등)에서도 쓸 수 있는 버전. 매장이 없으면 null */
export function useOptionalStore() {
  return useContext(StoreContext)?.store ?? null;
}
