/**
 * 로그인 세션 (토큰 · 역할) 보관.
 * - 운영자는 공용 PC 를 고려해 sessionStorage 에 둬요 (로그인 때 keep=false). '로그인 상태 유지'면 localStorage. 토큰을 갱신해도 처음 고른 곳을 그대로 써요.
 * - 로그아웃하면 세대(epoch)가 바뀌어서, 그 전에 시작된 토큰 갱신 응답이 늦게 와도 세션을 되살리지 않아요.
 * TODO: 토큰 저장 방식(쿠키 / 저장소)은 백엔드와 합의한 뒤 바꿔 주세요.
 */
export interface Session {
  accessToken: string;
  refreshToken: string;
  role: 'BUSINESS' | 'OPERATOR';
  loginId: string;
}

export type SessionStorageKind = 'local' | 'session';

const KEY = 'pawfit.admin.session';
const listeners = new Set<() => void>();
let cache: Session | null | undefined;
let kind: SessionStorageKind = 'local';
let epoch = 0;

const store = (k: SessionStorageKind) => (k === 'local' ? localStorage : sessionStorage);

function read(): Session | null {
  if (cache !== undefined) return cache;
  try {
    const local = localStorage.getItem(KEY);
    const session = local === null ? sessionStorage.getItem(KEY) : null;
    kind = local !== null ? 'local' : 'session';
    const raw = local ?? session;
    cache = raw ? (JSON.parse(raw) as Session) : null;
  } catch {
    cache = null;
  }
  return cache;
}

function write(session: Session) {
  cache = session;
  try {
    localStorage.removeItem(KEY);
    sessionStorage.removeItem(KEY);
    store(kind).setItem(KEY, JSON.stringify(session));
  } catch {
    // 저장이 안 돼도 이번 탭에서는 동작해요.
  }
  listeners.forEach((l) => l());
}

export function getSession(): Session | null {
  return read();
}

/** 지금 세션이 어디에 저장돼 있는지 (테스트 · 점검용) */
export function getSessionStorageKind(): SessionStorageKind {
  read();
  return kind;
}

/** 지금 세션의 세대. 로그인 · 로그아웃 때마다 바뀌어요 */
export function getSessionEpoch() {
  return epoch;
}

/** 새로 로그인할 때만 써요. keep: '로그인 상태 유지'면 브라우저를 닫아도 남아요 */
export function setSession(session: Session, keep = true) {
  epoch += 1;
  kind = keep ? 'local' : 'session';
  write(session);
}

/** 정보만 바꿔요 (저장 위치 · 세대는 그대로) */
export function updateSession(patch: Partial<Session>) {
  const cur = read();
  if (!cur) return;
  write({ ...cur, ...patch });
}

/**
 * 토큰 갱신 결과를 저장해요. 갱신을 시작할 때의 세대 · 리프레시 토큰과 지금 값이 같을 때만 저장하고,
 * 그 사이 로그아웃했거나 다른 계정으로 로그인했으면 버려요. 저장 위치는 바꾸지 않아요.
 */
export function replaceTokens(startedEpoch: number, usedRefreshToken: string, tokens: { accessToken: string; refreshToken: string }): boolean {
  const cur = read();
  if (!cur || epoch !== startedEpoch || cur.refreshToken !== usedRefreshToken) return false;
  write({ ...cur, accessToken: tokens.accessToken, refreshToken: tokens.refreshToken });
  return true;
}

export function clearSession() {
  epoch += 1;
  cache = null;
  try {
    localStorage.removeItem(KEY);
    sessionStorage.removeItem(KEY);
  } catch {
    // 무시
  }
  listeners.forEach((l) => l());
}

export function subscribeSession(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
