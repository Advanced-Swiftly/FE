import { apiClient, mockResponse, USE_MOCK } from './client';
import { mockError } from './errors';
import { clearSession, getSession, setSession, type Session } from './session';

// 명세 F-OAUTH-01 ~ 03 (경로 · 필드 이름은 [제안])

interface AuthResponseDto {
  accessToken: string;
  refreshToken: string;
  user: { id: string; loginId: string; role: 'OPERATOR' };
}

/** F-OAUTH-01 운영자 로그인 — 토큰을 저장해요. 운영자 계정이 아니면 서버가 INVALID_CREDENTIALS 를 줘요. */
export async function adminLogin(loginId: string, password: string): Promise<Session> {
  let res: AuthResponseDto;
  if (USE_MOCK) {
    if (!loginId || password.length < 4) throw mockError('INVALID_CREDENTIALS');
    res = await mockResponse({ accessToken: `mock-access-${Date.now()}`, refreshToken: `mock-refresh-${Date.now()}`, user: { id: 'u_ops', loginId, role: 'OPERATOR' as const } }, 400);
  } else {
    res = (await apiClient.post<AuthResponseDto>('/admin/auth/login', { loginId, password })).data;
  }
  if (res.user.role !== 'OPERATOR') throw mockError('INVALID_CREDENTIALS');
  const session: Session = { accessToken: res.accessToken, refreshToken: res.refreshToken, role: 'OPERATOR', loginId: res.user.loginId };
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
