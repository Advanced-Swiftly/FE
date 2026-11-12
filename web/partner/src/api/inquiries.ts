import { MOCK_FAQS, MOCK_INQUIRIES } from '@/mocks/inquiries';
import type { Faq, Inquiry, NewInquiry, RelatedRequest } from '@/types';
import { apiClient, mockResponse, USE_MOCK } from './client';
import { mockError } from './errors';
import { toId } from './ids';

// 명세 F-WQNA-01 ~ 03 (제출본 6.1.6절). 승인 전 계정도 써요. 서버 응답(DTO) → 화면 타입 변환은 이 파일에서만 해요.

export interface InquiryDto {
  inquiryId: string;
  type: string;
  title: string | null;
  content: string;
  relatedRequest: RelatedRequest | null;
  status: 'WAITING' | 'ANSWERED';
  submittedAt: string;
  answers: { content: string; answeredAt: string }[];
}
interface InquiryListDto {
  inquiries: InquiryDto[];
  nextCursor: string | null;
}

const toInquiry = (d: InquiryDto): Inquiry => ({
  id: d.inquiryId,
  type: d.type,
  title: d.title,
  content: d.content,
  relatedRequest: d.relatedRequest,
  status: d.status,
  submittedAt: d.submittedAt,
  answer: d.answers[0] ? { content: d.answers[0].content, answeredAt: d.answers[0].answeredAt } : null,
});

/** F-WQNA-02 내 문의 한 페이지 (최근 순, 답변 포함) */
export async function getInquiryPage(opts: { status?: 'WAITING' | 'ANSWERED'; cursor: string | null; limit?: number }): Promise<{ items: Inquiry[]; nextCursor: string | null }> {
  const limit = opts.limit ?? 20;
  let dto: InquiryListDto;
  if (USE_MOCK) {
    const rows = MOCK_INQUIRIES.filter((q) => !opts.status || q.status === opts.status);
    const start = opts.cursor ? Number(opts.cursor) : 0;
    dto = await mockResponse({ inquiries: rows.slice(start, start + limit), nextCursor: start + limit < rows.length ? String(start + limit) : null });
  } else {
    return getMyInquiries(opts.status);
  }
  return { items: dto.inquiries.map(toInquiry), nextCursor: dto.nextCursor };
}

/** 문의 유형 ↔ API 문서 category (ACCOUNT · PLACE · EVENT · ETC). QR · 방문 인증의 분류는 백엔드 확인 사항 */
const TYPE_TO_CATEGORY: Record<string, 'ACCOUNT' | 'PLACE' | 'EVENT' | 'ETC'> = { '입장 조건': 'PLACE', '이벤트 · 광고': 'EVENT', 'QR · 방문 인증': 'PLACE', '가입 · 계정': 'ACCOUNT', 기타: 'ETC' };
const CATEGORY_TO_TYPE: Record<string, string> = { PLACE: '입장 조건', EVENT: '이벤트 · 광고', ACCOUNT: '가입 · 계정', ETC: '기타' };

/** 내 문의 목록 · 상세 응답 (GET /inquiries · /inquiries/{id}) — 예시에 없는 값은 비워 둬요 */
interface MyInquiryDto {
  inquiryId?: string | number;
  category?: string | null;
  title?: string | null;
  content?: string | null;
  status?: 'WAITING' | 'ANSWERED';
  createdAt?: string | null;
  submittedAt?: string | null;
  answer?: string | null;
  answeredAt?: string | null;
}

function fromMyInquiry(d: MyInquiryDto): Inquiry {
  return {
    id: toId(d.inquiryId) ?? '',
    type: d.category ? (CATEGORY_TO_TYPE[d.category] ?? d.category) : '',
    title: d.title ?? null,
    content: d.content ?? '',
    relatedRequest: null,
    status: d.status === 'ANSWERED' ? 'ANSWERED' : 'WAITING',
    submittedAt: d.submittedAt ?? d.createdAt ?? '',
    answer: d.answer ? { content: d.answer, answeredAt: d.answeredAt ?? '' } : null,
  };
}

/**
 * 내 문의 목록 — GET /inquiries?status → { items: [{ inquiryId, title, status }] }
 * 답변 · 본문은 목록에 없어 각 문의 상세(GET /inquiries/{id})를 불러 채워요. 다음 페이지 근거가 없어 첫 페이지만 보여 줘요.
 */
export async function getMyInquiries(status?: 'WAITING' | 'ANSWERED'): Promise<{ items: Inquiry[]; nextCursor: string | null }> {
  const { data } = await apiClient.get<{ items?: MyInquiryDto[] | null }>('/inquiries', { params: { status } });
  const list = (data?.items ?? []).map(fromMyInquiry).filter((q) => q.id !== '');
  const items = await Promise.all(
    list.map(async (q) => {
      try {
        const { data: d } = await apiClient.get<MyInquiryDto>(`/inquiries/${encodeURIComponent(q.id)}`);
        const full = fromMyInquiry({ ...d, inquiryId: d?.inquiryId ?? q.id });
        return { ...q, ...Object.fromEntries(Object.entries(full).filter(([, v]) => v !== '' && v !== null)), status: full.status } as Inquiry;
      } catch {
        return q;
      }
    }),
  );
  return { items, nextCursor: null };
}

/** F-WQNA-03 자주 묻는 질문 (서버에서 줄 때만 — 웹 고정으로 할지는 명세 원본 36 [확인 필요]) */
export async function getFaqs(): Promise<Faq[]> {
  const dto = USE_MOCK ? await mockResponse({ faqs: MOCK_FAQS }) : (await apiClient.get<{ faqs: { question: string; answer: string }[] }>('/business/faqs')).data;
  return dto.faqs.map((f) => ({ question: f.question, answer: f.answer }));
}

/**
 * F-WQNA-01 문의 보내기 — multipart. JSON 부분은 { type, relatedRequest, title, content, placeId }, 파일은 files (최대 3개).
 * JSON 부분 · 파일 부분의 이름은 명세에 없어 백엔드 확인 사항이에요.
 */
export async function createInquiry(input: NewInquiry, files: File[] = [], attachmentUrls: string[] = []): Promise<{ id: string }> {
  const json = {
    type: input.type,
    relatedRequest: input.relatedRequest,
    title: input.title.trim() || null,
    content: input.content.trim(),
    placeId: input.placeId,
  };
  if (files.length > 3) throw mockError('TOO_MANY_FILES');
  if (USE_MOCK) {
    if (json.content.length < 10) throw mockError('VALIDATION_ERROR', { field: 'content' });
    const dto: InquiryDto = {
      inquiryId: `Q-${String(311 + MOCK_INQUIRIES.length).padStart(4, '0')}`,
      type: json.type,
      title: json.title,
      content: json.content,
      relatedRequest: json.relatedRequest,
      status: 'WAITING',
      submittedAt: new Date().toISOString(),
      answers: [],
    };
    MOCK_INQUIRIES.unshift(dto);
    const res = await mockResponse({ inquiryId: dto.inquiryId, status: dto.status, submittedAt: dto.submittedAt }, 500);
    return { id: res.inquiryId };
  }
  // 1:1 문의 등록 — POST /inquiries { category, title(필수 · 100자), content(4000자), attachmentUrls?(https · 5개) }
  // BE 에 파일 업로드 API 가 없어 첨부는 https 주소로만 받아요. 관련 요청 연결(relatedRequest)은 이 API 에 없어요.
  if (files.length > 0) throw mockError('FIELD_NOT_SUPPORTED', { field: 'attachmentUrls' });
  if (!json.title) throw mockError('INVALID_REQUEST', { field: 'title' });
  const urls = attachmentUrls.map((u) => u.trim()).filter(Boolean);
  if (urls.length > 5 || urls.some((u) => !/^https:\/\/\S+$/.test(u) || u.length > 500)) throw mockError('INVALID_REQUEST', { field: 'attachmentUrls' });
  const category = TYPE_TO_CATEGORY[input.type] ?? 'ETC';
  const { data } = await apiClient.post<{ inquiryId: string | number; status: string }>('/inquiries', { category, title: json.title, content: json.content, ...(urls.length ? { attachmentUrls: urls } : {}) });
  return { id: toId(data.inquiryId) ?? '' };
}
