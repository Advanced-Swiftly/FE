import axios, { type AxiosRequestConfig } from 'axios';
import { toApiError } from './errors';
import { clearSession, getSession, getSessionEpoch, replaceTokens } from './session';

/** 모든 API 호출이 쓰는 axios 인스턴스. 주소는 .env의 VITE_API_BASE_URL (예: http://localhost:8080/api/v1)에서 가져와요. */
/**
 * API 기본 주소. .env 의 VITE_API_BASE_URL 이 'http://localhost:8080' 이든 'http://localhost:8080/api/v1' 이든
 * 최종 주소에 /api/v1 이 정확히 한 번만 들어가게 맞춰요. 각 API 함수는 '/admin/…' 처럼 /api/v1 뒤 경로만 써요.
 */
export const API_BASE_URL = (() => {
  const raw = (import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/+$/, '');
  return /\/api\/v1$/.test(raw) ? raw : `${raw}/api/v1`;
})();

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10_000,
});

/** true면 서버 대신 src/mocks 데이터를 돌려줘요. API 연동 전까지 true로 개발해요. */
export const USE_MOCK = import.meta.env.VITE_USE_MOCK === 'true';

/** 가짜 데이터를 실제 요청처럼 조금 늦게 돌려줘요. */
export function mockResponse<T>(data: T, delayMs = 300): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(structuredClone(data)), delayMs));
}

/** 토큰 갱신 경로 — 백엔드 API '액세스 토큰 재발급' (업체 · 운영자 공통) */
const REFRESH_PATH = '/auth/token/refresh';
const LOGIN_PATH = '/login';

/** 요청을 보낸 세션의 세대를 함께 기억해요 (로그아웃 · 다른 계정 로그인 뒤 늦게 온 응답을 가려내요) */
type TrackedConfig = AxiosRequestConfig & { _retried?: boolean; _epoch?: number };

// 요청마다 액세스 토큰을 붙이고, 그때 세션 세대를 적어 둬요.
apiClient.interceptors.request.use((config) => {
  const token = getSession()?.accessToken;
  if (token && !config.headers.Authorization) config.headers.Authorization = `Bearer ${token}`;
  (config as TrackedConfig)._epoch ??= getSessionEpoch();
  return config;
});

/**
 * 동시에 여러 요청이 401 을 받아도 같은 세션에서는 갱신을 한 번만 해요.
 * 갱신은 시작한 세션 세대에 묶여 있어서, 그 사이 로그아웃하거나 다른 계정으로 로그인하면 결과를 새 세션에 쓰지 않아요.
 */
let refreshing: { epoch: number; promise: Promise<string | null> } | null = null;

async function refreshToken(): Promise<string | null> {
  const session = getSession();
  if (!session?.refreshToken) return null;
  // 갱신을 시작한 시점의 세대 · 리프레시 토큰을 기억해요. 응답이 오기 전에 세션이 바뀌면 결과를 버려요.
  const startedEpoch = getSessionEpoch();
  const used = session.refreshToken;
  try {
    const { data } = await axios.post<{ accessToken: string; refreshToken: string }>(`${API_BASE_URL}${REFRESH_PATH}`, { refreshToken: used });
    return replaceTokens(startedEpoch, used, data) ? data.accessToken : null;
  } catch {
    return null;
  }
}

function sharedRefresh(epoch: number): Promise<string | null> {
  if (refreshing && refreshing.epoch === epoch) return refreshing.promise;
  const entry = {
    epoch,
    promise: refreshToken().finally(() => {
      // 다른 세션이 새 갱신을 시작했으면 그 갱신은 지우지 않아요.
      if (refreshing === entry) refreshing = null;
    }),
  };
  refreshing = entry;
  return entry.promise;
}

/**
 * 401 중 토큰 문제로 볼 오류 코드. 비밀번호 틀림(INVALID_PASSWORD) · 로그인 실패(INVALID_CREDENTIALS) 같은
 * 업무 오류도 401 로 오기 때문에, 코드가 없거나 아래 코드일 때만 토큰을 갱신하고 다시 보내요.
 * 실제 서버의 토큰 만료 코드 이름은 백엔드 확인 사항이에요.
 */
// AUTH_001: 실제 BE 의 토큰 없음 · 만료 · 위조 응답 (JwtAuthenticationFilter → 401 AUTH_001)
const TOKEN_ERROR_CODES = new Set(['AUTH_001', 'UNAUTHORIZED', 'TOKEN_EXPIRED', 'EXPIRED_TOKEN', 'INVALID_TOKEN', 'INVALID_ACCESS_TOKEN']);
function isTokenError(data: unknown): boolean {
  const body = data as { code?: unknown; error?: { code?: unknown } } | null | undefined;
  const code = typeof body?.code === 'string' ? body.code : typeof body?.error?.code === 'string' ? body.error.code : null;
  return code === null || TOKEN_ERROR_CODES.has(code);
}

apiClient.interceptors.response.use(
  (res) => res,
  async (error) => {
    const config = error.config as TrackedConfig | undefined;
    // 401: 토큰 갱신 후 한 번만 다시 보내고, 실패하면 로그인 화면으로
    if (error.response?.status === 401 && isTokenError(error.response?.data) && config && !config._retried && !config.url?.includes('/auth/')) {
      const epoch = config._epoch ?? getSessionEpoch();
      // 요청을 보낸 뒤 세션이 바뀌었으면(로그아웃 · 다른 계정 로그인) 갱신 · 세션 삭제 · 이동 · 재전송을 하지 않아요.
      if (epoch !== getSessionEpoch()) return Promise.reject(toApiError(error));
      const token = await sharedRefresh(epoch);
      // 갱신을 기다리는 사이 세션이 바뀌었으면, 성공이든 실패든 새 세션과 지금 화면을 그대로 둬요.
      // 원래 요청을 새 세션의 토큰으로 다시 보내지도 않아요.
      if (epoch !== getSessionEpoch()) return Promise.reject(toApiError(error));
      if (token) {
        config._retried = true;
        config.headers = { ...config.headers, Authorization: `Bearer ${token}` };
        return apiClient(config);
      }
      // 같은 세션에서 갱신이 실패했을 때만: 세션을 지우고 로그인 화면으로
      clearSession();
      if (!window.location.pathname.startsWith(LOGIN_PATH)) window.location.assign(LOGIN_PATH);
    }
    return Promise.reject(toApiError(error));
  },
);
