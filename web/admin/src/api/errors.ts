import { isAxiosError } from 'axios';

/**
 * 서버 오류 응답 { error: { code, message, details } } 를 화면에서 쓰기 좋게 바꾼 오류 (공통 오류 규칙).
 * message 는 화면 문구예요 (서버 message 는 개발 확인용이라 쓰지 않아요).
 */
export class ApiError extends Error {
  code: string;
  status: number | null;
  details: Record<string, unknown> | null;
  /** 서버가 응답했는지 (false 면 네트워크 · 시간 초과 — 같은 멱등 키로 다시 보내도 돼요) */
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

/** 오류 코드 → 화면 문구 (공통 + 관리자 F-O* 명세의 오류 표) */
const ERROR_TEXT: Record<string, string> = {
  VALIDATION_ERROR: '입력한 내용을 다시 확인해 주세요.',
  UNAUTHORIZED: '로그인이 필요해요. 다시 로그인해 주세요.',
  FORBIDDEN: '운영자 계정으로만 쓸 수 있어요.',
  ADMIN_POLICY_READ_UNSUPPORTED: '운영자가 업체의 현재 입장 정책을 읽는 서버 API 가 없어 여기서 보거나 바꿀 수 없어요. 조건 변경은 검토 대기열의 요청 승인으로 처리해 주세요.',
  CONFLICT: '지금 상태에서는 처리할 수 없어요. 새로고침해 주세요.',
  INVALID_REQUEST_STATE: '지금 상태에서는 처리할 수 없어요. 새로고침해 주세요.',
  ROLE_NOT_ALLOWED: '운영자 계정이 아니에요. 운영자 계정으로 로그인해 주세요.',
  INVALID_FILE: '파일이 올바르지 않아요.',
  NOT_FOUND: '정보를 찾을 수 없어요.',
  RATE_LIMITED: '잠시 후 다시 시도해 주세요.',
  SERVER_ERROR: '잠시 후 다시 시도해 주세요.',
  NETWORK_ERROR: '서버에 연결하지 못했어요. 인터넷 연결을 확인하고 다시 시도해 주세요.',
  // 로그인
  INVALID_REFRESH_TOKEN: '로그인이 만료됐어요. 다시 로그인해 주세요.',
  INVALID_REQUEST: '요청을 처리할 수 없어요. 입력 내용을 확인해 주세요.',
  INVALID_CREDENTIALS: '로그인 정보가 맞지 않아요. 휴대폰 번호(아이디)와 비밀번호를 확인해 주세요.',
  ACCOUNT_LOCKED: '로그인에 여러 번 실패해 잠시 잠겼어요. 15분 뒤 다시 시도해 주세요.',
  FIELD_NOT_SUPPORTED: '이 항목은 지금 서버 API로 바꿀 수 없어요. 운영팀 확인이 필요해요.',
  // 검토 대기열
  POLICY_VERSION_CONFLICT: '정책이 그사이 바뀌었어요. 최신 내용을 다시 불러왔어요.',
  INVALID_STATUS_TRANSITION: '지금 상태에서는 할 수 없는 처리예요. 최신 상태를 다시 확인해 주세요.',
  REQUEST_STATE_CONFLICT: '이미 처리됐거나 지금 할 수 없는 처리예요. 목록을 다시 확인해 주세요.',
  CONDITION_CHANGED_SINCE_REQUEST: '요청 뒤 조건이 바뀌었어요. 최신 조건으로 다시 검토해 주세요.',
  CONDITIONS_OUTDATED: '다른 운영자가 조건을 먼저 바꿨어요. 최신 조건을 불러온 뒤 다시 저장해 주세요.',
  APPROVAL_DEADLINE_PASSED: '처리 기간이 지났어요.',
  ELIGIBILITY_NOT_MET: '참여 조건이 맞지 않아 승인할 수 없어요.',
  REQUEST_NOT_EDITABLE: '지금은 고칠 수 없는 요청이에요.',
  // 문의 답변 (멱등 키)
  INQUIRY_ALREADY_ANSWERED: '이미 답변이 등록된 문의예요. 저장된 답변을 확인해 주세요.',
  IDEMPOTENCY_IN_PROGRESS: '답변을 등록하는 중이에요. 잠시 뒤 다시 확인해 주세요.',
  IDEMPOTENCY_KEY_CONFLICT: '이미 처리된 요청이에요. 문의를 다시 불러와 결과를 확인해 주세요.',
  // 댕댕로드 추첨
  DRAW_ALREADY_COMPLETED: '이미 추첨이 끝났어요.',
  DRAW_IN_PROGRESS: '추첨이 진행 중이에요. 잠시 뒤 결과를 확인해 주세요.',
  DRAW_NOT_ALLOWED_YET: '아직 추첨할 수 없는 기간이에요.',
  DRAW_POLICY_NOT_SET: '추첨 규칙이 정해지지 않았어요.',
  PRIZES_NOT_SET: '경품이 등록되지 않았어요.',
  PRIZE_QUANTITY_INSUFFICIENT: '경품 수량이 부족해요.',
  PRIZE_LOCKED: '추첨이 시작돼 경품을 바꿀 수 없어요.',
  PERIOD_FIELD_LOCKED: '진행 중인 기간이라 바꿀 수 없는 항목이에요.',
  PERIOD_OVERLAP: '다른 기간과 날짜가 겹쳐요.',
  ENTRY_CANCELED: '취소된 응모예요.',
  ENTRY_NOT_WON: '당첨된 응모가 아니에요.',
  RESULT_NOT_PUBLISHED: '아직 결과가 공개되지 않았어요.',
};

export function errorText(code: string, fallback = '요청을 처리하지 못했어요. 잠시 후 다시 시도해 주세요.') {
  return ERROR_TEXT[code] ?? fallback;
}

/**
 * 실제 BE(Advanced-Swiftly/BE)의 공통 오류 코드 → 화면 코드.
 * BE 본문은 { status, code, message, path, requestId, fieldErrors } 예요.
 */
const BE_CODE: Record<string, string> = {
  COMMON_001: 'INVALID_REQUEST',
  COMMON_002: 'NOT_FOUND',
  COMMON_003: 'CONFLICT',
  COMMON_500: 'SERVER_ERROR',
  AUTH_001: 'UNAUTHORIZED',
  AUTH_002: 'FORBIDDEN',
  FILE_001: 'INVALID_FILE',
  FILE_002: 'FILE_TOO_LARGE',
  FILE_003: 'UNSUPPORTED_FILE',
  AI_001: 'SERVER_ERROR',
};
/** BE 가 상황별로 적어 보내는 문구만 화면에 써요 (공통 문구 '요청을 처리할 수 없습니다.' 등은 화면 문구로 바꿔요) */
const GENERIC_BE_MESSAGE = /^(요청을 처리할 수 없습니다|요청 값이 올바르지 않습니다|인증이 필요합니다|접근 권한이 없습니다|서버 오류가 발생했습니다|현재 상태에서는 요청을 처리할 수 없습니다|요청한 리소스를 찾을 수 없습니다|파일이 올바르지 않습니다)\.?$/;
function beMessage(body: { message?: unknown; fieldErrors?: unknown } | undefined): string | null {
  const fe = body?.fieldErrors && typeof body.fieldErrors === 'object' ? Object.values(body.fieldErrors as Record<string, unknown>).find((v) => typeof v === 'string' && v.trim()) : null;
  if (typeof fe === 'string') return fe;
  const m = typeof body?.message === 'string' ? body.message.trim() : '';
  return m && !GENERIC_BE_MESSAGE.test(m) ? m : null;
}

/** 어떤 오류든 ApiError 로 바꿔요 (axios 오류 · 목업에서 던진 Error 모두) */
export function toApiError(e: unknown): ApiError {
  if (e instanceof ApiError) return e;
  if (isAxiosError(e)) {
    // 오류 본문: 백엔드 API 문서 { code, message } · 이전 명세 { error: { code, message, details } } 둘 다 읽어요
    const body = e.response?.data as { code?: string; message?: string; fieldErrors?: Record<string, string> | null; details?: Record<string, unknown>; error?: { code?: string; details?: Record<string, unknown> } } | undefined;
    const rawCode = typeof body?.code === 'string' ? body.code : body?.error?.code;
    const bodyCode = rawCode ? (BE_CODE[rawCode] ?? rawCode) : undefined;
    const bodyDetails = body?.details ?? body?.error?.details ?? (body?.fieldErrors ? { fieldErrors: body.fieldErrors, field: Object.keys(body.fieldErrors)[0] } : null);
    if (e.response) {
      const status = e.response.status;
      const code = bodyCode ?? (status === 401 ? 'UNAUTHORIZED' : status === 403 ? 'FORBIDDEN' : status === 404 ? 'NOT_FOUND' : 'SERVER_ERROR');
      return new ApiError(code, beMessage(body) ?? errorText(code), status, bodyDetails, true);
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
