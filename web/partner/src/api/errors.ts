import { isAxiosError } from 'axios';

/**
 * 서버 오류 응답 { error: { code, message, details } } 를 화면에서 쓰기 좋게 바꾼 오류 (명세 4.3절).
 * message 는 화면 문구예요 (서버 message 는 개발 확인용이라 쓰지 않아요).
 */
export class ApiError extends Error {
  code: string;
  status: number | null;
  details: Record<string, unknown> | null;
  /** 서버가 응답했는지 (false 면 네트워크 · 시간 초과 — 같은 요청을 다시 보내도 돼요) */
  responded: boolean;

  constructor(code: string, message: string, status: number | null, details: Record<string, unknown> | null, responded: boolean) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.status = status;
    this.details = details;
    this.responded = responded;
  }

  /** VALIDATION_ERROR 의 details.field */
  get field(): string | null {
    return typeof this.details?.field === 'string' ? this.details.field : null;
  }
}

/** 오류 코드 → 화면 문구 (공통 4.3절 + 각 기능 오류). 영역별 문구는 화면에서 덧붙여도 돼요. */
const ERROR_TEXT: Record<string, string> = {
  VALIDATION_ERROR: '입력한 내용을 다시 확인해 주세요.',
  UNAUTHORIZED: '로그인이 필요해요. 다시 로그인해 주세요.',
  BUSINESS_NOT_APPROVED: '운영자 승인 후 이용할 수 있어요.',
  NOT_FOUND: '정보를 찾을 수 없어요.',
  RATE_LIMITED: '잠시 후 다시 시도해 주세요.',
  SERVER_ERROR: '잠시 후 다시 시도해 주세요.',
  NETWORK_ERROR: '서버에 연결하지 못했어요. 인터넷 연결을 확인하고 다시 시도해 주세요.',
  // 인증 · 가입
  INVALID_REFRESH_TOKEN: '로그인이 만료됐어요. 다시 로그인해 주세요.',
  INVALID_REQUEST: '요청을 처리할 수 없어요. 입력 내용을 확인해 주세요.',
  FIELD_NOT_SUPPORTED: '이 항목은 아직 서버로 보낼 수 없어요 (첨부 업로드 방식 확인 중). 첨부 없이 보내 주세요.',
  TOO_MANY_REQUESTS: '요청이 너무 많아요. 잠시 뒤 다시 시도해 주세요.',
  INVALID_VERIFICATION_CODE: '인증번호가 맞지 않아요.',
  REQUIRED_TERM_NOT_AGREED: '필수 약관에 동의해 주세요.',
  DUPLICATE_PHONE_NUMBER: '이미 가입한 휴대폰 번호예요.',
  INVALID_ROLE: '가입 역할이 올바르지 않아요.',
  INVALID_CREDENTIALS: '아이디 또는 비밀번호가 맞지 않아요.',
  ACCOUNT_LOCKED: '로그인에 여러 번 실패해 잠시 잠겼어요. 15분 뒤 다시 시도해 주세요.',
  CODE_MISMATCH: '인증번호가 맞지 않아요.',
  CODE_EXPIRED: '인증 시간이 지났어요. 다시 받아 주세요.',
  PHONE_TAKEN: '이미 가입한 휴대폰 번호예요.',
  EMAIL_TAKEN: '이미 사용 중인 아이디예요.',
  LOGIN_ID_TAKEN: '이미 사용 중인 아이디예요.',
  VERIFICATION_INVALID: '휴대폰 인증을 다시 해 주세요.',
  REQUIRED_TERMS_MISSING: '필수 약관에 동의해 주세요.',
  WEAK_PASSWORD: '비밀번호 조건을 확인해 주세요.',
  FILE_TOO_LARGE: '10MB 이하 파일을 올려 주세요.',
  UNSUPPORTED_FILE: 'JPG, PNG, PDF 파일만 올릴 수 있어요.',
  VERIFICATION_IN_PROGRESS: '이미 확인 중인 신청이 있어요.',
  PLACE_ALREADY_MANAGED: '이미 다른 계정이 관리하는 매장이에요. 운영팀에 문의해 주세요.',
  VERIFICATION_NOT_EDITABLE: '지금은 고칠 수 없어요.',
  INVALID_PASSWORD: '비밀번호가 맞지 않아요.',
  // 조건 변경 요청
  CONDITIONS_OUTDATED: '조건이 바뀌었어요. 최신 조건을 확인한 뒤 다시 보내 주세요.',
  CONDITION_UNDER_REVIEW: '결과가 나올 때까지 다시 요청할 수 없어요.',
  REQUEST_NOT_CANCELLABLE: '검토가 시작돼 취소할 수 없어요.',
  REQUEST_NOT_EDITABLE: '지금은 고칠 수 없어요.',
  // 광고 · 이벤트
  RECRUITMENT_NOT_OPEN: '지금은 참여 신청 기간이 아니에요.',
  DUPLICATE_APPLICATION: '이미 이 분기에 신청한 매장이에요.',
  ELIGIBILITY_NOT_MET: '참여 조건을 확인해 주세요.',
  // 문의
  TOO_MANY_FILES: '첨부는 3개까지 올릴 수 있어요.',
};

export function errorText(code: string, fallback = '요청을 처리하지 못했어요. 잠시 후 다시 시도해 주세요.') {
  return ERROR_TEXT[code] ?? fallback;
}

/** 어떤 오류든 ApiError 로 바꿔요 (axios 오류 · 목업에서 던진 Error 모두) */
export function toApiError(e: unknown): ApiError {
  if (e instanceof ApiError) return e;
  if (isAxiosError(e)) {
    // 오류 본문: 백엔드 API 문서 { code, message } · 이전 명세 { error: { code, message, details } } 둘 다 읽어요
    const body = e.response?.data as { code?: string; details?: Record<string, unknown>; error?: { code?: string; details?: Record<string, unknown> } } | undefined;
    const bodyCode = typeof body?.code === 'string' ? body.code : body?.error?.code;
    const bodyDetails = body?.details ?? body?.error?.details ?? null;
    if (e.response) {
      const code = bodyCode ?? (e.response.status >= 500 ? 'SERVER_ERROR' : e.response.status === 401 ? 'UNAUTHORIZED' : e.response.status === 404 ? 'NOT_FOUND' : 'SERVER_ERROR');
      return new ApiError(code, errorText(code), e.response.status, bodyDetails, true);
    }
    return new ApiError('NETWORK_ERROR', errorText('NETWORK_ERROR'), null, null, false);
  }
  if (e instanceof Error) return new ApiError('CLIENT_ERROR', e.message, null, null, true);
  return new ApiError('CLIENT_ERROR', errorText('SERVER_ERROR'), null, null, true);
}

/** 목업에서 서버와 같은 오류를 흉내 낼 때 */
export function mockError(code: string, details: Record<string, unknown> | null = null): ApiError {
  return new ApiError(code, errorText(code), 409, details, true);
}
