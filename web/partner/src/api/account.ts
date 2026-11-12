import { MOCK_ACCOUNT, MOCK_TERMS, MOCK_VERIFICATIONS } from '@/mocks/inquiries';
import { BUSINESS_CATEGORY_LABEL, type Account, type BusinessCategory, type BusinessLookup, type SignupStatus, type Term } from '@/types';
import { apiClient, mockResponse, USE_MOCK } from './client';
import { mockError } from './errors';
import { toId, type RawId } from './ids';
import { clearSession, getSession, setSession, updateSession, type Session } from './session';

// 경로 · 필드 이름은 명세 F-WAUTH · F-WACC 최종본 기준이에요 ([제안] 표시가 많아 백엔드 확정 후 다시 맞춰 주세요).

/** 숫자만 남겨요 (휴대폰 · 사업자번호는 숫자만 보내요) */
export const digitsOnly = (v: string) => v.replace(/\D/g, '');

// ─── 서버 응답 모양 (DTO) ──────────────────────────────

interface AuthUserDto {
  id: string;
  loginId: string;
  role: 'BUSINESS';
  hasVerificationRequest: boolean;
  hasApprovedPlace: boolean;
}
interface AuthResponseDto {
  accessToken: string;
  refreshToken: string;
  user: AuthUserDto;
}
/** 실제 BE 로그인 응답 (AuthDtos.LoginResponse) */
interface LoginResponseDto {
  accessToken: string;
  refreshToken: string;
  user: { userId?: string | number | null; role?: string | null; name?: string | null } | null;
}
/** 내 프로필 조회 응답 (GET /users/me) — placeCounts 는 이전 명세 값이라 올 때만 써요 */
interface MeDto {
  userId?: string | number;
  role?: string;
  name: string | null;
  phoneNumber?: string | null;
  phone?: string | null;
  placeCounts?: { approved: number; pending: number } | null;
}
/** F-WAUTH-11 verifications[] 한 건 (F-WAUTH-12 응답도 같은 모양) */
export interface VerificationDto {
  /** 문자 · 숫자 모두 받아요 */
  verificationId: string | number;
  businessName: string;
  /** 아래부터는 사업자 인증 목록 응답 예시에 없어요 — 오면 쓰고, 없으면 빈 값으로 보여요 */
  businessNumber?: string;
  region?: string;
  /** 업종 CAFE · RESTAURANT — 기획 결정으로 추가 (백엔드 반영 필요). 예전 데이터는 없거나 null 일 수 있어요 */
  category?: string | null;
  address?: { zip: string; line1: string; line2: string } | null;
  licenseFile?: { fileName: string; url: string } | null;
  /** 목록은 NEEDS_SUPPLEMENT, 상세는 NEEDS_INFO 로 문서에 적혀 있어 둘 다 받아요 */
  status: SignupStatus['status'] | 'NEEDS_SUPPLEMENT';
  /** 보완 요청 · 반려 사유 (이전 명세 reason · API 문서 상세 reviewComment) */
  reason?: string | null;
  reviewComment?: string | null;
  submittedAt?: string | null;
  lastSubmittedAt?: string | null;
  approvedAt?: string | null;
  /** 고치기 · 보완 · 다시 신청 버튼을 열지 — 응답에 없으면 열지 않아요 */
  canEdit?: boolean;
  canResubmit?: boolean;
  canReapply?: boolean;
}

function saveAuth(res: AuthResponseDto, keep: boolean) {
  const session: Session = {
    accessToken: res.accessToken,
    refreshToken: res.refreshToken,
    role: 'BUSINESS',
    loginId: res.user.loginId,
    hasVerificationRequest: res.user.hasVerificationRequest,
    hasApprovedPlace: res.user.hasApprovedPlace,
  };
  setSession(session, keep);
  return session;
}

function mockAuth(loginId: string, hasVerificationRequest: boolean, hasApprovedPlace: boolean): AuthResponseDto {
  return { accessToken: `mock-access-${Date.now()}`, refreshToken: `mock-refresh-${Date.now()}`, user: { id: 'u_mock', loginId, role: 'BUSINESS', hasVerificationRequest, hasApprovedPlace } };
}

// ─── 로그인 · 로그아웃 ────────────────────────────────

/**
 * F-WAUTH-06 로그인. 토큰을 저장하고, 웹이 이동할 화면을 정할 값을 돌려줘요:
 * 승인된 매장 있음 → 대시보드 / 인증 요청 전 → 업체 인증 / 그 밖 → 승인 대기
 * keep: '로그인 상태 유지' (끄면 브라우저를 닫을 때 로그아웃돼요)
 */
export async function login(loginId: string, password: string, keep = true): Promise<Session> {
  if (USE_MOCK) {
    // 어느 쪽이 틀렸는지 알리지 않아요.
    if (!loginId || password.length < 4) throw mockError('INVALID_CREDENTIALS');
    // 예시: 아이디에 new 가 들어가면 인증 요청 전, pending 이면 승인 대기 계정으로 봐요.
    const res = loginId.includes('new') ? mockAuth(loginId, false, false) : loginId.includes('pending') ? mockAuth(loginId, true, false) : mockAuth(loginId, true, true);
    return saveAuth(await mockResponse(res, 400), keep);
  }
  // 공통 로그인 — POST /auth/login { phoneNumber, password } → { user: { userId, role, name }, accessToken, refreshToken }
  const { data } = await apiClient.post<LoginResponseDto>('/auth/login', { phoneNumber: digitsOnly(loginId), password });
  if (data.user?.role !== 'BUSINESS') {
    // 업체 관리자 계정이 아니면 받은 토큰을 바로 무효화하고 로그인하지 않아요
    await apiClient.post('/auth/logout', { refreshToken: data.refreshToken }, { headers: { Authorization: `Bearer ${data.accessToken}` } }).catch(() => undefined);
    throw mockError('ROLE_NOT_ALLOWED');
  }
  setSession({ accessToken: data.accessToken, refreshToken: data.refreshToken, role: 'BUSINESS', loginId: data.user.name || digitsOnly(loginId) }, keep);
  try {
    return await refreshPartnerState();
  } catch (e) {
    // 이동할 화면을 정하지 못하면 로그인 상태를 남기지 않아요 (다시 시도하게)
    clearSession();
    throw e;
  }
}

/**
 * 로그인 뒤 갈 화면을 정할 값 — 로그인 응답에는 없어서 BE 목록 두 개로 정해요.
 * - GET /business/stores → { stores } : 승인된 인증 요청이 있는 매장 (1개 이상이면 대시보드)
 * - GET /business/verifications → { items } : 보낸 인증 요청 (있으면 승인 대기 · 보완, 없으면 업체 인증)
 */
export async function refreshPartnerState(): Promise<Session> {
  const { data: stores } = await apiClient.get<{ stores?: unknown[] | null }>('/business/stores');
  const hasApprovedPlace = Array.isArray(stores?.stores) && stores.stores.length > 0;
  let hasVerificationRequest = hasApprovedPlace;
  if (!hasApprovedPlace) {
    const { data: v } = await apiClient.get<{ items?: unknown[] | null }>('/business/verifications');
    hasVerificationRequest = Array.isArray(v?.items) && v.items.length > 0;
  }
  updateSession({ hasApprovedPlace, hasVerificationRequest });
  return getSession()!;
}

/** F-WAUTH-08 로그아웃. 서버 요청이 실패해도 이 브라우저의 로그인은 지워요. */
export async function logout(): Promise<void> {
  const refreshToken = getSession()?.refreshToken;
  const accessToken = getSession()?.accessToken;
  // 이 브라우저의 로그인을 먼저 지워요 (세대가 바뀌어 진행 중인 토큰 갱신 결과는 버려져요). 서버 실패는 무시해요.
  clearSession();
  if (!USE_MOCK && refreshToken)
    await apiClient.post('/auth/logout', { refreshToken }, { headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {} }).catch(() => undefined);
}

// ─── 회원가입 ─────────────────────────────────────────

/** 이용약관 목록 조회 응답 한 줄 (GET /terms?role=BUSINESS) */
interface TermDto {
  termId?: string | number | null;
  title?: string | null;
  required?: boolean;
  version?: string | null;
  url?: string | null;
}

/** 업체용 약관 목록 — GET /terms?role=BUSINESS → { terms: [{ termId, title, required, version }] } */
export async function getTerms(): Promise<Term[]> {
  if (USE_MOCK) return mockResponse(MOCK_TERMS);
  const { data } = await apiClient.get<{ terms?: TermDto[] | null }>('/terms', { params: { role: 'BUSINESS' } });
  return (data?.terms ?? []).flatMap((t) => {
    const code = toId(t.termId);
    if (!code || t.termId === null || t.termId === undefined) return [];
    return [{ code, termId: t.termId, title: t.title ?? '', required: Boolean(t.required), version: t.version ?? '', url: typeof t.url === 'string' && t.url.trim() ? t.url : null }];
  });
}

/** F-WAUTH-02 아이디 중복 확인 → 사용 가능하면 true */
export async function checkLoginIdAvailable(loginId: string): Promise<boolean> {
  if (USE_MOCK) return mockResponse(!loginId.startsWith('taken'));
  const { data } = await apiClient.post<{ available: boolean }>('/business/auth/login-id/check', { loginId });
  return data.available;
}

export type PhoneVerificationPurpose = 'SIGN_UP' | 'LOGIN' | 'CHANGE_PHONE';

export interface PhoneCodeSent {
  /** 확인 요청에 보낼 인증 요청 ID (다시 받으면 새 값으로 바꿔요) */
  verificationId: string | number;
  /** 인증번호 유효 시간 */
  expiresInSec: number;
  /** 다시 받기까지 기다릴 시간 — API 문서에 없어 null 이면 기다리지 않아요 (유효 시간으로 대신하지 않아요) */
  resendAfterSec: number | null;
}

/** 휴대전화 인증번호 발송 — POST /auth/phone-verifications { phoneNumber, purpose } → { verificationId, expiresInSeconds } */
export async function sendPhoneCode(phone: string, purpose: PhoneVerificationPurpose = 'SIGN_UP'): Promise<PhoneCodeSent> {
  if (USE_MOCK) return mockResponse({ verificationId: `mock_vid_${Date.now()}`, expiresInSec: 180, resendAfterSec: 30 });
  const { data } = await apiClient.post<{ verificationId: string | number; expiresInSeconds?: number; resendAfterSeconds?: number }>('/auth/phone-verifications', { phoneNumber: digitsOnly(phone), purpose });
  return { verificationId: data.verificationId, expiresInSec: data.expiresInSeconds ?? 0, resendAfterSec: typeof data.resendAfterSeconds === 'number' ? data.resendAfterSeconds : null };
}

/** 휴대전화 인증번호 확인 — POST /auth/phone-verifications/confirm { verificationId, code } → verificationToken (예시 모드는 6자리면 통과) */
export async function verifyPhoneCode(verificationId: string | number, code: string): Promise<string> {
  if (USE_MOCK) {
    if (!/^\d{6}$/.test(code)) throw mockError('CODE_MISMATCH');
    return mockResponse(`vt_mock_${verificationId}`);
  }
  const { data } = await apiClient.post<{ verified?: boolean; verificationToken?: string }>('/auth/phone-verifications/confirm', { verificationId, code });
  if (data.verified === false || !data.verificationToken) throw mockError('INVALID_VERIFICATION_CODE');
  return data.verificationToken;
}

export interface Agreement {
  code: string;
  /** 서버 약관 ID (가입 termAgreements 에 그대로 보내요) */
  termId?: string | number;
  version: string;
  agreed: boolean;
}

export interface SignupAccountForm {
  loginId: string;
  password: string;
  name: string;
  phone: string;
  verificationToken: string;
  agreements: Agreement[];
}

/**
 * 업체관리자 회원가입 — POST /auth/signup/business { phoneVerificationToken, name, password, termAgreements[{ termId, agreed }] }
 * → { userId, role, accessToken, refreshToken } (만들면 바로 로그인 상태)
 * 아이디(이메일) · 약관 버전은 API 문서에 없어 보내지 않아요 (백엔드 확인 사항).
 */
export async function createAccount(form: SignupAccountForm): Promise<Session> {
  if (USE_MOCK) {
    if (!form.verificationToken) throw mockError('VERIFICATION_INVALID');
    return saveAuth(await mockResponse(mockAuth(form.loginId, false, false)), true);
  }
  const body = {
    phoneVerificationToken: form.verificationToken,
    name: form.name,
    password: form.password,
    termAgreements: form.agreements.map((a) => ({ termId: a.termId ?? a.code, agreed: a.agreed })),
  };
  const { data } = await apiClient.post<{ userId?: string | number; role?: string; accessToken: string; refreshToken: string }>('/auth/signup/business', body);
  if (data.role && data.role !== 'BUSINESS') throw mockError('FORBIDDEN');
  // 새로 만든 계정이라 업체 인증 요청 · 승인 매장은 아직 없어요
  const session: Session = { accessToken: data.accessToken, refreshToken: data.refreshToken, role: 'BUSINESS', loginId: form.loginId || digitsOnly(form.phone), hasVerificationRequest: false, hasApprovedPlace: false };
  setSession(session, true);
  return session;
}

// ─── 업체 인증 ────────────────────────────────────────

/** F-WAUTH-09 사업자 상태 조회 */
export async function lookupBusiness(bizNo: string): Promise<BusinessLookup> {
  const businessNumber = digitsOnly(bizNo);
  if (USE_MOCK) {
    const valid = businessNumber.length === 10;
    return mockResponse({ valid, message: valid ? '정상 영업 중인 사업자예요' : '사업자등록번호 10자리를 확인해 주세요' });
  }
  if (businessNumber.length !== 10) return { valid: false, message: '사업자등록번호 10자리를 확인해 주세요' };
  const { data } = await apiClient.post<{ isActive: boolean }>('/business/verifications/business-status', { businessNumber });
  return { valid: data.isActive, message: data.isActive ? '정상 영업 중인 사업자예요' : '정상 영업 중인 사업자가 아니에요' };
}

/** 업체 인증 화면에서 고친 값 (명세 F-WAUTH-10 · 12 필드만) */
export interface BusinessFields {
  bizNo: string;
  name: string;
  area: string;
  /** 업종 — 고르기 전에는 '' (화면이 제출을 막아요) */
  category: BusinessCategory | '';
  address: { zip: string; line1: string; line2: string };
}

const toCategory = (v: string | null | undefined): BusinessCategory | null => (v === 'CAFE' || v === 'RESTAURANT' ? v : null);

function formatBizNo(n: string) {
  const d = digitsOnly(n);
  return d.length === 10 ? `${d.slice(0, 3)}-${d.slice(3, 5)}-${d.slice(5)}` : n;
}

function toInfo(v: VerificationDto) {
  // 서버 모드: BE 인증 목록 · 상세에는 상호명만 있어요. 없는 항목(지역 · 업종 · 주소 · 파일)을 '선택 안 됨'처럼 보여 주지 않아요
  if (!USE_MOCK) return [{ label: '상호명', value: v.businessName || '—' }];
  return [
    { label: '상호명', value: v.businessName },
    { label: '사업자등록번호', value: v.businessNumber ? formatBizNo(v.businessNumber) : '—' },
    { label: '지역', value: v.region || '—' },
    { label: '업종', value: toCategory(v.category) ? BUSINESS_CATEGORY_LABEL[toCategory(v.category)!] : '선택 안 됨' },
    ...(v.address ? [{ label: '주소', value: `(${v.address.zip}) ${v.address.line1} ${v.address.line2}`.trim() }] : []),
    { label: '사업자등록증', value: v.licenseFile?.fileName ?? '—' },
  ];
}

export function toSignupStatus(v: VerificationDto): SignupStatus {
  // 보완 상태 표기 두 가지(NEEDS_SUPPLEMENT · NEEDS_INFO)를 화면에서는 하나로 다뤄요
  const status = v.status === 'NEEDS_SUPPLEMENT' ? 'NEEDS_INFO' : v.status;
  // 실제 BE 응답에는 가능 여부가 없어서 BE 규칙대로 정해요:
  // 보완 제출(POST …/resubmit)은 NEEDS_SUPPLEMENT 일 때만, 반려된 사업자번호만 새로 신청 가능, 접수 상태 수정 API 는 없어요.
  if (!USE_MOCK) {
    v = { ...v, canEdit: v.canEdit ?? false, canResubmit: v.canResubmit ?? status === 'NEEDS_INFO', canReapply: v.canReapply ?? status === 'REJECTED' };
  }
  const filled = { ...v, businessNumber: v.businessNumber ?? '', region: v.region ?? '' };
  return {
    verificationId: toId(v.verificationId) ?? '',
    status,
    submittedAt: v.submittedAt ?? '',
    lastSubmittedAt: v.lastSubmittedAt ?? v.submittedAt ?? '',
    approvedAt: v.approvedAt ?? null,
    canEdit: v.canEdit === true,
    canResubmit: v.canResubmit === true,
    canReapply: v.canReapply === true,
    reason: v.reason ?? v.reviewComment ?? undefined,
    licenseFile: v.licenseFile ?? null,
    category: toCategory(v.category),
    info: toInfo(v),
    form: { bizNo: formatBizNo(filled.businessNumber), name: v.businessName ?? '', area: filled.region, category: toCategory(v.category) ?? '', zip: v.address?.zip ?? '', line1: v.address?.line1 ?? '', line2: v.address?.line2 ?? '' },
  };
}

function multipart(json: Record<string, unknown>, licenseFile: File | null) {
  const body = new FormData();
  body.append('body', new Blob([JSON.stringify(json)], { type: 'application/json' }));
  if (licenseFile) body.append('licenseFile', licenseFile);
  return body;
}

function mockVerificationRules(v: VerificationDto) {
  Object.assign(v, { canEdit: v.status === 'RECEIVED', canResubmit: v.status === 'NEEDS_INFO', canReapply: v.status === 'REJECTED' });
}

/**
 * F-WAUTH-10 업체 인증 요청 보내기 (처음 · 업체 추가 · 반려 뒤 다시 신청).
 * 본문: businessName · businessNumber · region · address · licenseFile · agreements (약관 코드 · 버전은 F-WAUTH-01 응답 값)
 * 대표자명 · 업종 · 매장 전화번호는 명세 요청에 없어 화면에서 받지 않아요.
 */
export async function createVerification(fields: BusinessFields, licenseFile: File, agreements: Agreement[]): Promise<SignupStatus> {
  if (!fields.category) throw mockError('VALIDATION_ERROR', { field: 'category' });
  const json = { businessName: fields.name.trim(), businessNumber: digitsOnly(fields.bizNo), region: fields.area, category: fields.category, address: fields.address, agreements };
  let dto: VerificationDto;
  if (USE_MOCK) {
    const at = new Date().toISOString();
    dto = {
      verificationId: `bv_${MOCK_VERIFICATIONS.length + 1}`,
      businessName: json.businessName,
      businessNumber: json.businessNumber,
      region: json.region,
      category: json.category,
      address: json.address,
      licenseFile: { fileName: licenseFile.name, url: '' },
      status: 'RECEIVED',
      reason: null,
      submittedAt: at,
      lastSubmittedAt: at,
      approvedAt: null,
      canEdit: true,
      canResubmit: false,
      canReapply: false,
    };
    MOCK_VERIFICATIONS.unshift(dto);
    const res = await mockResponse({ verificationId: dto.verificationId, status: dto.status, submittedAt: dto.submittedAt }, 500);
    updateSession({ hasVerificationRequest: true });
    return toSignupStatus({ ...dto, ...res });
  }
  const { data } = await apiClient.post<{ verificationId: string; status: SignupStatus['status']; submittedAt: string }>('/business/verifications', multipart(json, licenseFile));
  updateSession({ hasVerificationRequest: true });
  // 201 응답에는 상태 · 시각만 있어서 목록을 다시 읽어요
  const list = await getVerifications();
  return list.find((v) => v.verificationId === data.verificationId) ?? list[0];
}

/**
 * F-WAUTH-12 업체 인증 내용 수정 (RECEIVED) · 보완 제출 (NEEDS_INFO).
 * 바뀐 필드만 보내요 (agreements · 미변경 값은 보내지 않아요). 새 사업자등록증이 있으면 multipart, 없으면 JSON.
 */
export async function updateVerification(verificationId: string, before: BusinessFields, after: BusinessFields, licenseFile: File | null): Promise<SignupStatus> {
  const json: Record<string, unknown> = {};
  if (after.name.trim() !== before.name.trim()) json.businessName = after.name.trim();
  if (digitsOnly(after.bizNo) !== digitsOnly(before.bizNo)) json.businessNumber = digitsOnly(after.bizNo);
  if (after.area !== before.area) json.region = after.area;
  // 업종은 바꾼 경우에만 보내요. 예전 데이터처럼 비어 있었으면 화면이 먼저 고르게 해요.
  if (!after.category) throw mockError('VALIDATION_ERROR', { field: 'category' });
  if (after.category !== before.category) json.category = after.category;
  if (JSON.stringify(after.address) !== JSON.stringify(before.address)) json.address = after.address;
  if (Object.keys(json).length === 0 && !licenseFile) throw mockError('VALIDATION_ERROR', { field: 'body' });
  let dto: VerificationDto;
  if (USE_MOCK) {
    const v = MOCK_VERIFICATIONS.find((x) => x.verificationId === verificationId);
    if (!v) throw mockError('NOT_FOUND');
    if (v.status !== 'RECEIVED' && v.status !== 'NEEDS_INFO') throw mockError('VERIFICATION_NOT_EDITABLE');
    Object.assign(v, json, licenseFile ? { licenseFile: { fileName: licenseFile.name, url: '' } } : {}, {
      status: 'RECEIVED',
      reason: null,
      lastSubmittedAt: new Date().toISOString(),
    });
    mockVerificationRules(v);
    dto = await mockResponse(v, 500);
  } else {
    const path = `/business/verifications/${encodeURIComponent(verificationId)}`;
    dto = (await (licenseFile ? apiClient.patch<VerificationDto>(path, multipart(json, licenseFile)) : apiClient.patch<VerificationDto>(path, json))).data;
  }
  return toSignupStatus(dto);
}

// ─── 실제 BE 사업자 인증 (서버 모드 전용) ─────────────

/** 사업자 인증 요청 · 보완 제출에 필요한 값 (BE VerificationCreateRequest · VerificationResubmitRequest) */
export interface ServerVerificationInput {
  businessNumber: string;
  businessName: string;
  representativeName: string;
  /** 사업자등록증 파일 주소 — http(s) URL (BE 에 파일 업로드 API 가 없어 주소로 받아요) */
  documentUrl: string;
  store: { name: string; address: string; phone: string; latitude: string; longitude: string };
}

const toNumber = (v: string) => (v.trim() === '' ? undefined : Number(v));

/**
 * 사업자 인증 요청 — POST /business/verifications
 * { businessNumber, businessName, representativeName, documentUrl, store: { name, address, phone, latitude, longitude } } → { verificationId, status }
 */
export async function createServerVerification(input: ServerVerificationInput): Promise<string> {
  const body = {
    businessNumber: digitsOnly(input.businessNumber),
    businessName: input.businessName.trim(),
    representativeName: input.representativeName.trim(),
    documentUrl: input.documentUrl.trim(),
    store: { name: input.store.name.trim(), address: input.store.address.trim(), phone: input.store.phone.trim(), latitude: toNumber(input.store.latitude), longitude: toNumber(input.store.longitude) },
  };
  const { data } = await apiClient.post<{ verificationId: RawId; status: string }>('/business/verifications', body);
  updateSession({ hasVerificationRequest: true });
  return toId(data.verificationId) ?? '';
}

/**
 * 보완 제출 — POST /business/verifications/{verificationId}/resubmit { documentUrl(필수), store? }
 * store 는 바꾼 항목만 보내요 (BE 는 보낸 항목만 고치고 나머지는 그대로 둬요).
 */
export async function resubmitServerVerification(verificationId: string, documentUrl: string, store: Partial<ServerVerificationInput['store']>): Promise<void> {
  const s: Record<string, unknown> = {};
  if (store.name?.trim()) s.name = store.name.trim();
  if (store.address?.trim()) s.address = store.address.trim();
  if (store.phone?.trim()) s.phone = store.phone.trim();
  if (store.latitude?.trim()) s.latitude = Number(store.latitude);
  if (store.longitude?.trim()) s.longitude = Number(store.longitude);
  await apiClient.post(`/business/verifications/${encodeURIComponent(verificationId)}/resubmit`, { documentUrl: documentUrl.trim(), ...(Object.keys(s).length ? { store: s } : {}) });
}

/** F-WAUTH-11 내 업체 인증 요청 전체 (최근 제출 순) */
/** 사업자 인증 상세 조회 — GET /business/verifications/{verificationId} → { verificationId, status, reviewComment, … } */
export async function getVerification(verificationId: string): Promise<SignupStatus> {
  if (USE_MOCK) {
    const v = MOCK_VERIFICATIONS.find((x) => x.verificationId === verificationId);
    if (!v) throw mockError('NOT_FOUND');
    return toSignupStatus(await mockResponse(v));
  }
  const { data } = await apiClient.get<VerificationDto>(`/business/verifications/${encodeURIComponent(verificationId)}`);
  return toSignupStatus(data);
}

/**
 * 내 사업자 인증 목록 — GET /business/verifications → { items: [{ verificationId, status, businessName }] }
 * 목록에 보완 · 반려 사유가 없으면 그 건만 상세(reviewComment)를 불러 채워요.
 */
export async function getVerifications(): Promise<SignupStatus[]> {
  let dtos: VerificationDto[];
  if (USE_MOCK) dtos = (await mockResponse({ verifications: MOCK_VERIFICATIONS })).verifications;
  else {
    const { data } = await apiClient.get<{ items?: VerificationDto[] | null; verifications?: VerificationDto[] | null }>('/business/verifications');
    dtos = data?.items ?? data?.verifications ?? [];
  }
  let list = dtos.map(toSignupStatus).filter((v) => v.verificationId !== '');
  if (!USE_MOCK) {
    list = await Promise.all(
      list.map(async (v) => {
        if ((v.status !== 'NEEDS_INFO' && v.status !== 'REJECTED') || v.reason) return v;
        try {
          const d = await getVerification(v.verificationId);
          return { ...v, reason: d.reason };
        } catch {
          return v;
        }
      }),
    );
  }
  if (list.length) updateSession({ hasVerificationRequest: true, ...(list.some((v) => v.status === 'APPROVED') ? { hasApprovedPlace: true } : {}) });
  return list;
}

// ─── 계정 정보 (F-WACC) ───────────────────────────────

/** 내 프로필 조회 — GET /users/me → { userId, role, name, phoneNumber } */
export async function getAccount(): Promise<Account> {
  const loginId = getSession()?.loginId ?? '';
  if (USE_MOCK) return mockResponse({ ...MOCK_ACCOUNT, loginId: loginId || MOCK_ACCOUNT.loginId });
  const { data } = await apiClient.get<MeDto>('/users/me');
  const counts = data.placeCounts;
  return {
    name: data.name ?? '',
    loginId,
    phone: data.phoneNumber ?? data.phone ?? '',
    // 연결된 업체 수는 이 응답의 예시에 없어요. 오면 쓰고, 없으면 null (0 으로 채우지 않아요)
    stores: counts ? { total: counts.approved + counts.pending, approved: counts.approved, pending: counts.pending } : null,
  };
}

/**
 * 내 프로필 수정 — PATCH /users/me { name?, phoneVerificationToken? } (바뀐 것만 보내요)
 * 이름은 지금 이름과 다를 때만, 번호는 새 번호로 휴대전화 인증(CHANGE_PHONE)을 마친 토큰이 있을 때만 넣어요.
 * 바뀐 게 없으면 요청을 보내지 않고 false 를 돌려줘요.
 */
export async function updateAccount(input: { currentName: string; name: string; phoneVerificationToken?: string; newPhone?: string }): Promise<boolean> {
  const body: { name?: string; phoneVerificationToken?: string } = {};
  const name = input.name.trim();
  if (name && name !== input.currentName.trim()) body.name = name;
  if (input.phoneVerificationToken) body.phoneVerificationToken = input.phoneVerificationToken;
  if (!body.name && !body.phoneVerificationToken) return false;
  if (USE_MOCK) {
    if (body.name) MOCK_ACCOUNT.name = body.name;
    const phone = digitsOnly(input.newPhone ?? '');
    if (body.phoneVerificationToken && phone) MOCK_ACCOUNT.phone = phone.replace(/^(\d{3})\d{3,4}(\d{4})$/, '$1-****-$2');
    await mockResponse(null);
    return true;
  }
  await apiClient.patch('/users/me', body);
  return true;
}

export async function changePassword(currentPassword: string, newPassword: string): Promise<void> {
  if (USE_MOCK) {
    if (currentPassword.length < 4) throw mockError('INVALID_PASSWORD');
    await mockResponse(null);
    return;
  }
  // 실제 BE 에 비밀번호 변경 API 가 없어요 (백엔드 확인 사항) — 없는 경로로 보내지 않아요
  void newPassword;
  throw mockError('FIELD_NOT_SUPPORTED', { field: 'password' });
}

/** 탈퇴 — 성공하면 로그인도 지워요 */
export async function deleteAccount(password: string): Promise<void> {
  if (USE_MOCK) {
    if (password.length < 4) throw mockError('INVALID_PASSWORD');
    await mockResponse(null);
  } else {
    // 회원 탈퇴 — DELETE /users/me { password, reason? }
    await apiClient.delete('/users/me', { data: { password } });
  }
  clearSession();
}
