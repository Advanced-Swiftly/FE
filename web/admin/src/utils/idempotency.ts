/**
 * 멱등 키 (Idempotency-Key).
 * - 같은 동작을 다시 보낼 때(네트워크 오류 · 시간 초과로 재시도)는 같은 키를 써요 → 서버가 두 번 처리하지 않아요.
 * - 새 동작(내용이 바뀌었거나, 성공한 뒤 다시 하는 처리)에는 새 키를 만들어요.
 *
 * 쓰는 법: const key = idemKeys.get(`answer:${id}`, body) → 요청 → 성공하면 idemKeys.done(`answer:${id}`)
 */
const keys = new Map<string, { fingerprint: string; key: string }>();

function newKey() {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export const idemKeys = {
  /** scope: 어떤 동작인지 (예: 'answer:Q-0310') · payload: 보낼 내용 (바뀌면 새 키) */
  get(scope: string, payload: unknown = null): string {
    const fingerprint = JSON.stringify(payload);
    const saved = keys.get(scope);
    if (saved && saved.fingerprint === fingerprint) return saved.key;
    const key = newKey();
    keys.set(scope, { fingerprint, key });
    return key;
  },
  /** 성공했거나 서버가 처리 결과를 확정해 준 뒤 — 다음 동작은 새 키를 써요 */
  done(scope: string) {
    keys.delete(scope);
  },
};
