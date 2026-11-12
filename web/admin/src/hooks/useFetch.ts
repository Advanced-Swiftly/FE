import { useCallback, useEffect, useRef, useState } from 'react';
import { toApiError } from '@/api/errors';

type FetchState<T> =
  | { status: 'loading'; data: null; error: null }
  | { status: 'success'; data: T; error: null }
  | { status: 'error'; data: null; error: Error };

/**
 * api/ 함수를 불러서 로딩 · 성공 · 실패 상태를 관리해요.
 * - key 가 바뀌면 이전 데이터를 지우고 새로 불러와요 (다른 매장 · 다른 요청의 버튼이 남지 않게).
 * - 같은 key 로 reload() 하면 이전 데이터를 보여 준 채 다시 불러와요 (화면 깜빡임 방지).
 * 예: useFetch(`requests:${storeId}`, () => getRequests(storeId))
 */
export function useFetch<T>(key: string, fetcher: () => Promise<T>): FetchState<T> & { reload: () => void; refreshing: boolean } {
  const [state, setState] = useState<FetchState<T>>({ status: 'loading', data: null, error: null });
  const [tick, setTick] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const lastKey = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const keyChanged = lastKey.current !== key;
    lastKey.current = key;
    if (keyChanged) setState({ status: 'loading', data: null, error: null });
    else setRefreshing(true);
    fetcher()
      .then((data) => {
        if (!cancelled) setState({ status: 'success', data, error: null });
      })
      .catch((error: unknown) => {
        if (!cancelled) setState({ status: 'error', data: null, error: toApiError(error) });
      })
      .finally(() => {
        if (!cancelled) setRefreshing(false);
      });
    return () => {
      cancelled = true;
    };
    // fetcher 는 매 렌더마다 새로 만들어지므로 key 로만 다시 불러와요.
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [key, tick]);

  const reload = useCallback(() => setTick((t) => t + 1), []);
  return { ...state, reload, refreshing };
}
