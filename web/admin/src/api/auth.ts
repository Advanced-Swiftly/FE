import { apiClient, mockResponse, USE_MOCK } from './client';
import { mockError } from './errors';
import { clearSession, getSession, setSession, type Session } from './session';

// 로그인 · 로그아웃은 업체 · 운영자 공통 API 를 써요 (실제 BE AuthController).
//   POST /auth/login { phoneNumber, password, deviceToken? } → { user: { userId, role, name }, accessToken, refreshToken }
//   운영자 화면은 role 이 OPERATOR 인 계정만 받아요. 다른 역할이면 받은 토큰을 바로 로그아웃으로 무효화해요.

interface LoginResponseDto {
  accessToken: string;
  refreshToken: string;
  user: { userId?: string | number | null; role?: string | null; name?: string | null } | null;
}

/** 휴대폰 번호는 숫자만 보내요 (BE 는 010-1234-5678 · 01012345678 둘 다 받아요) */
const digits = (v: string) => v.replace(/\D/g, '');

/** 받은 토큰을 서버에서 무효화해요 (역할이 맞지 않을 때). 실패해도 로그인은 막아요 */
async function revoke(res: LoginResponseDto) {
  await apiClient
    .post('/auth/logout', { refreshToken: res.refreshToken }, { headers: { Authorization: `Bearer ${res.accessToken}` } })
    .catch(() => undefined);
}

/** F-OAUTH-01 운영자 로그인 — 아이디 자리에 가입한 휴대폰 번호를 받아요 */
export async function adminLogin(loginId: string, password: string): Promise<Session> {
  let res: LoginResponseDto;
  if (USE_MOCK) {
    if (!loginId || password.length < 4) throw mockError('INVALID_CREDENTIALS');
    res = await mockResponse({ accessToken: `mock-access-${Date.now()}`, refreshToken: `mock-refresh-${Date.now()}`, user: { userId: 'u_ops', role: 'OPERATOR', name: loginId } }, 400);
  } else {
    res = (await apiClient.post<LoginResponseDto>('/auth/login', { phoneNumber: digits(loginId), password })).data;
  }
  if (res.user?.role !== 'OPERATOR') {
    if (!USE_MOCK) await revoke(res);
    throw mockError('ROLE_NOT_ALLOWED');
  }
  const session: Session = { accessToken: res.accessToken, refreshToken: res.refreshToken, role: 'OPERATOR', loginId: USE_MOCK ? loginId : res.user.name || digits(loginId) };
  // 운영자 화면은 공용 PC 에서 쓸 수 있어서 브라우저를 닫으면 로그아웃돼요.
  setSession(session, false);
  return session;
}

/** F-OAUTH-03 로그아웃. 서버 요청이 실패해도 이 브라우저의 로그인은 지워요. */
export async function adminLogout(): Promise<void> {
  const refreshToken = getSession()?.refreshToken;
  const accessToken = getSession()?.accessToken;
  // 이 브라우저의 로그인을 먼저 지워요 (진행 중인 토큰 갱신 결과는 버려져요). 서버 실패는 무시해요.
  clearSession();
  if (!USE_MOCK && refreshToken)
    await apiClient.post('/auth/logout', { refreshToken }, { headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {} }).catch(() => undefined);
}
