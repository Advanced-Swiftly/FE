import { useCallback, useEffect, useRef, useState } from 'react';
import { toApiError } from '@/api/errors';

export interface Page<T> {
  items: T[];
  /** 다음 페이지 커서. 마지막이면 null (공통 규칙 · 커서 목록) */
  nextCursor: string | null;
}

/**
 * 커서 방식 목록 (?cursor=…&limit=…). 첫 페이지를 불러오고, loadMore() 로 다음 페이지를 이어 붙여요.
 * key 가 바뀌면 (탭 · 검색 · 필터) 이전 목록을 지우고 처음부터 불러와요.
 */
export function useCursorList<T>(key: string, fetchPage: (cursor: string | null) => Promise<Page<T>>) {
  const [state, setState] = useState<{ key: string; items: T[]; cursor: string | null; status: 'loading' | 'success' | 'error'; error: string | null }>({
    key,
    items: [],
    cursor: null,
    status: 'loading',
    error: null,
  });
  const [loadingMore, setLoadingMore] = useState(false);
  const [tick, setTick] = useState(0);
  const fetchRef = useRef(fetchPage);

  useEffect(() => {
    fetchRef.current = fetchPage;
  });

  useEffect(() => {
    let cancelled = false;
    fetchRef
      .current(null)
      .then((page) => !cancelled && setState({ key, items: page.items, cursor: page.nextCursor, status: 'success', error: null }))
      .catch((e: unknown) => !cancelled && setState({ key, items: [], cursor: null, status: 'error', error: toApiError(e).message }));
    return () => {
      cancelled = true;
    };
  }, [key, tick]);

  const loadMore = useCallback(async () => {
    const { cursor } = state;
    if (!cursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const page = await fetchRef.current(cursor);
      setState((s) => (s.key === key ? { ...s, items: [...s.items, ...page.items], cursor: page.nextCursor, error: null } : s));
    } catch (e) {
      setState((s) => ({ ...s, error: toApiError(e).message }));
    } finally {
      setLoadingMore(false);
    }
  }, [state, loadingMore, key]);

  const reload = useCallback(() => setTick((t) => t + 1), []);
  // key 가 막 바뀐 렌더에서는 이전 목록 대신 '불러오는 중'으로 보여 줘요
  const fresh = state.key === key;

  return {
    items: fresh ? state.items : [],
    status: fresh ? state.status : ('loading' as const),
    error: fresh ? state.error : null,
    hasMore: fresh && state.cursor !== null,
    loadMore,
    loadingMore,
    reload,
  };
}

/** 목업용: 배열을 커서 페이지로 잘라 줘요 (cursor = 시작 위치) */
export function paginate<T>(all: T[], cursor: string | null, limit = 20): Page<T> {
  const start = cursor ? Number(cursor) : 0;
  const end = start + limit;
  return { items: all.slice(start, end), nextCursor: end < all.length ? String(end) : null };
}
