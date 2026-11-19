import { MOCK_QNA } from '@/mocks/qna';
import { paginate, type Page } from '@/hooks/useCursorList';
import type { Area } from '@/constants/status';
import type { QnaItem, QnaListItem } from '@/types';
import { idemKeys } from '@/utils/idempotency';
import { apiClient, mockResponse, USE_MOCK } from './client';
import { mockError, toApiError } from './errors';
import { toId } from './ids';

// 명세 F-OQNA-01 ~ 03 (경로 · 필드 이름은 [제안])

export type QnaStatusTab = 'ALL' | 'WAITING' | 'ANSWERED';

/** 이전 명세 + API 문서({ inquiryId, title, status } · 상세 { inquiryId, user, content, status }) 모두 받아요 */
interface InquiryCommonDto {
  inquiryId: string | number;
  authorType?: QnaItem['author'];
  author?: { userId: string; displayName: string | null } | null;
  /** 실제 BE 상세: { userId, name } */
  user?: { userId: string | number; name?: string | null } | null;
  place?: { placeId: string; name: string } | null;
  title?: string | null;
  submittedAt?: string;
  createdAt?: string;
  status?: 'WAITING' | 'ANSWERED';
  relatedRequest?: { kind: 'CONDITION' | 'AI_CANDIDATE' | 'EVENT_AD'; id: string } | null;
}
interface InquiryListDto extends InquiryCommonDto {
  lastAnsweredAt?: string | null;
  attachmentCount?: number;
  preview?: string;
}
interface InquiryDetailDto extends InquiryCommonDto {
  content?: string;
  attachments?: { fileId: string; fileName: string; url: string; urlExpiresAt: string | null }[] | null;
  /** API 문서 첨부 URL */
  attachmentUrls?: string[] | null;
  answers?: { answerId: string; content: string; answeredAt: string }[] | null;
  /** API 문서 답변 (문자열) */
  answer?: string | null;
  answeredAt?: string | null;
}

// 작성자 구분이 없으면 보호자 · 업체로 짐작하지 않아요
const authorName = (d: InquiryCommonDto) => d.author?.displayName ?? (d.authorType === 'BUSINESS' ? (d.place?.name ?? '업체') : d.authorType === 'GUARDIAN' ? '보호자' : d.user?.name ? d.user.name : d.user?.userId != null ? `회원 ${d.user.userId}` : '작성자 정보 없음');

function common(d: InquiryCommonDto) {
  return {
    id: toId(d.inquiryId) ?? '',
    author: d.authorType ?? null,
    authorName: authorName(d),
    createdAt: d.submittedAt ?? d.createdAt ?? '',
    title: d.title ?? null,
    // 지역 · 메모는 명세 응답에 없어요 [확인 필요]
    relatedStore: d.place ? { id: d.place.placeId, name: d.place.name, area: '' as Area, note: '' } : undefined,
    relatedRequest: d.relatedRequest ?? undefined,
  };
}

const toListItem = (q: QnaItem): QnaListItem => {
  const { body, attachments, answer, ...rest } = q;
  return { ...rest, attachmentCount: attachments.length, answered: Boolean(answer), preview: body };
};

/** F-OQNA-01 문의 목록 한 페이지 */
export async function getQnaPage(opts: { tab: QnaStatusTab; who: 'ALL' | NonNullable<QnaItem['author']>; cursor: string | null }): Promise<Page<QnaListItem>> {
  if (USE_MOCK) {
    const rows = MOCK_QNA.filter((q) => opts.tab === 'ALL' || (opts.tab === 'WAITING' ? !q.answer : Boolean(q.answer))).filter((q) => opts.who === 'ALL' || q.author === opts.who);
    return mockResponse(paginate(rows.map(toListItem), opts.cursor, 20));
  }
  // 문의 목록 — GET /admin/inquiries?status&category&page → { items: [{ inquiryId, category, title, status, createdAt }] } (20건씩, page 1부터)
  // 작성자 구분(authorType) 필터 · 첨부 수 · 미리보기는 이 API 에 없어요 (첨부 수는 null 로 둬요).
  const pageNo = opts.cursor ? Number(opts.cursor) : 1;
  const { data } = await apiClient.get<{ items?: (InquiryListDto & { status?: 'WAITING' | 'ANSWERED' })[] | null }>('/admin/inquiries', {
    params: { status: opts.tab === 'ALL' ? undefined : opts.tab, page: pageNo },
  });
  const rows = data?.items ?? [];
  return {
    items: rows.map((d) => ({ ...common(d), attachmentCount: d.attachmentCount ?? (null as unknown as number), answered: d.status ? d.status === 'ANSWERED' : (d.lastAnsweredAt ?? null) !== null, preview: d.preview ?? '' })).filter((x) => x.id !== ''),
    nextCursor: rows.length >= 20 ? String(pageNo + 1) : null,
  };
}

/** F-OQNA-02 문의 상세 (본문 · 첨부 · 답변) */
export async function getQnaDetail(id: string): Promise<QnaItem> {
  if (USE_MOCK) {
    const q = MOCK_QNA.find((x) => x.id === id);
    if (!q) throw mockError('NOT_FOUND');
    return mockResponse(q);
  }
  const { data } = await apiClient.get<InquiryDetailDto>(`/admin/inquiries/${encodeURIComponent(id)}`);
  const answers = data.answers ?? [];
  const last = answers[answers.length - 1];
  const files = data.attachments ?? (data.attachmentUrls ?? []).map((url, i) => ({ fileId: String(i), fileName: url.split('/').pop() || `첨부 ${i + 1}`, url, urlExpiresAt: null }));
  return {
    ...common(data),
    body: data.content ?? '',
    attachments: files.map((a) => ({ name: a.fileName, url: a.url })),
    answer: last ? { body: last.content, answeredAt: last.answeredAt } : data.answer ? { body: data.answer, answeredAt: data.answeredAt ?? '' } : undefined,
  };
}

/**
 * F-OQNA-03 답변 등록 — 문의당 1건, 답변 알림은 보내지 않아요 (업체는 문의하기, 보호자는 챗봇에서 확인).
 * 멱등 키: 같은 내용을 다시 보낼 때(시간 초과 등)는 같은 키, 내용이 바뀌면 새 키. 성공하면 키를 지워요.
 */
export async function answerQna(id: string, body: string): Promise<void> {
  if (USE_MOCK) {
    const q = MOCK_QNA.find((x) => x.id === id);
    if (!q) throw mockError('NOT_FOUND');
    if (q.answer) throw mockError('INQUIRY_ALREADY_ANSWERED');
    const now = new Date();
    q.answer = { body, answeredAt: `${String(now.getMonth() + 1).padStart(2, '0')}.${String(now.getDate()).padStart(2, '0')} ${now.toTimeString().slice(0, 5)}` };
    await mockResponse(null);
    return;
  }
  const scope = `answer:${id}`;
  const key = idemKeys.get(scope, body);
  try {
    // 문의 답변 등록 — POST /admin/inquiries/{inquiryId}/answer { answer, attachmentUrls? }
    await apiClient.post(`/admin/inquiries/${encodeURIComponent(id)}/answer`, { answer: body }, { headers: { 'Idempotency-Key': key } });
    idemKeys.done(scope);
  } catch (e) {
    const err = toApiError(e);
    // 서버가 결과를 확정해 준 오류면 다음 시도는 새 키로 (응답이 없던 오류는 같은 키로 다시 보내요)
    if (err.responded && err.code !== 'IDEMPOTENCY_IN_PROGRESS') idemKeys.done(scope);
    throw err;
  }
}
