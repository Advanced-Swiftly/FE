import { useSyncExternalStore } from 'react';
import { getSession, subscribeSession } from '@/api/session';

/** 지금 로그인 세션 (없으면 null). 로그인 · 로그아웃 때 다시 그려져요. */
export function useSession() {
  return useSyncExternalStore(subscribeSession, getSession, getSession);
}
