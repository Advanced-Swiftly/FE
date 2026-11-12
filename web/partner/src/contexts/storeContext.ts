import { createContext } from 'react';
import type { Store } from '@/types';

export interface StoreContextValue {
  /** 지금 관리 중인 매장 */
  store: Store;
  /** 연결된 모든 매장 (승인 대기 포함) */
  stores: Store[];
  selectStore: (id: string) => void;
}

export const StoreContext = createContext<StoreContextValue | null>(null);
