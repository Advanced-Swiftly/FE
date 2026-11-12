import { useCallback, useState } from 'react';
import { type ApiError, toApiError } from '@/api/errors';

export type ActionResult<R> = { ok: true; data: R } | { ok: false; data?: undefined; error: ApiError };

/**
 * 저장 · 신청 같은 버튼 동작의 진행 중 · 실패 상태를 관리해요.
 * 실패하면 서버 오류 코드(CONDITIONS_OUTDATED 등)를 화면 문구로 바꿔 error 에 넣어요.
 * 예:
 *   const save = useAction(updateAccount);
 *   const res = await save.run(form);
 *   if (res.ok) ... else if (res.error.code === 'CONDITIONS_OUTDATED') ...
 */
export function useAction<A extends unknown[], R>(fn: (...args: A) => Promise<R>) {
  const [pending, setPending] = useState(false);
  const [apiError, setApiError] = useState<ApiError | null>(null);

  const run = useCallback(
    async (...args: A): Promise<ActionResult<R>> => {
      setPending(true);
      setApiError(null);
      try {
        return { ok: true, data: await fn(...args) };
      } catch (e) {
        const err = toApiError(e);
        setApiError(err);
        return { ok: false, error: err };
      } finally {
        setPending(false);
      }
    },
    [fn],
  );

  const reset = useCallback(() => setApiError(null), []);

  return { run, pending, error: apiError?.message ?? null, errorCode: apiError?.code ?? null, errorField: apiError?.field ?? null, reset };
}
