import { USE_MOCK } from '@/api/client';
import { useRef, useState, type FormEvent } from 'react';
import { createInquiry, getFaqs, getInquiryPage } from '@/api/inquiries';
import { getRequestPage } from '@/api/requests';
import { Button } from '@/components/common/Button';
import { Card } from '@/components/common/Card';
import { Choice, Field, Select, TextArea, TextInput } from '@/components/common/Field';
import { Icon } from '@/components/common/Icon';
import { LoadState } from '@/components/common/LoadState';
import { Notice } from '@/components/common/Notice';
import { PageHeader } from '@/components/common/PageHeader';
import { Tag } from '@/components/common/Tag';
import { REQUEST_STATUS_LABEL } from '@/constants/status';
import { useAction } from '@/hooks/useAction';
import { useOptionalStore } from '@/hooks/useCurrentStore';
import { useCursorList } from '@/hooks/useCursorList';
import { useFetch } from '@/hooks/useFetch';
import page from '@/styles/page.module.css';
import { INQUIRY_TYPES, type InquiryType, type RelatedRequest } from '@/types';
import { formatDate, formatFileSize } from '@/utils/format';
import styles from './InquiryPage.module.css';

const MAX_FILES = 3;

export function InquiryPage() {
  const store = useOptionalStore();
  const inquiries = useCursorList('inquiries', (cursor) => getInquiryPage({ cursor }));
  const faqs = useFetch('faqs', getFaqs);
  // 관련 신청 고르기: 승인된 매장이 있을 때만, 진행 중인 요청 (F-WREQ-01 status=IN_PROGRESS 첫 페이지)
  const requests = useFetch(`requests:${store?.id ?? 'none'}:open`, () =>
    store ? getRequestPage(store.id, { status: 'IN_PROGRESS', limit: 50 }).then((r) => r.items) : Promise.resolve([]),
  );
  const submit = useAction(createInquiry);
  const fileInput = useRef<HTMLInputElement>(null);

  const [type, setType] = useState<InquiryType | null>(null);
  /** 'KIND:APPKIND:ID' 로 담아요 (목업 모드에서만 — 서버 문의 API 에는 관련 신청 필드가 없어요) */
  const [related, setRelated] = useState('');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [touched, setTouched] = useState(false);
  const [sent, setSent] = useState(false);

  const openRequests = requests.data ?? [];
  const valid = type !== null && body.trim().length >= 10;

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setTouched(true);
    if (!valid) return;
    // 'KIND:APPKIND:ID' — 같은 숫자 ID 의 이벤트 · 광고 신청도 따로 골라요
    const [kind, appKind, ...idParts] = related.split(':');
    const relatedRequest: RelatedRequest | null =
      related && USE_MOCK ? { kind: kind as RelatedRequest['kind'], ...(appKind ? { appKind: appKind as RelatedRequest['appKind'] } : {}), id: idParts.join(':') } : null;
    const res = await submit.run({ type: type as InquiryType, relatedRequest, title, content: body, placeId: store?.id ?? null }, files);
    if (!res.ok) return;
    setTitle('');
    setBody('');
    setFiles([]);
    setRelated('');
    setTouched(false);
    setSent(true);
    inquiries.reload();
  };

  const waiting = inquiries.items.filter((q) => q.status === 'WAITING').length;

  return (
    <div className={page.stack}>
      <PageHeader title="문의하기" description="운영팀에 궁금한 점을 남겨 주세요. 답변은 이 화면의 ‘내 문의’에서 확인할 수 있어요." />

      <div className={page.split}>
        <form className={`${page.main} ${styles.form}`} aria-labelledby="new-title" onSubmit={onSubmit} noValidate>
          <h2 id="new-title" className={styles.h2}>
            새 문의
          </h2>
          {sent && (
            <Notice tone="success" role="status" onClose={() => setSent(false)}>
              문의를 보냈어요. 답변이 달리면 아래 ‘내 문의’에서 볼 수 있어요.
            </Notice>
          )}
          <fieldset className={styles.fieldset}>
            <legend>문의 유형</legend>
            <div className={styles.types}>
              {INQUIRY_TYPES.map((t) => (
                <Choice key={t} type="radio" name="inq-type" boxed label={t} checked={type === t} onChange={() => setType(t)} />
              ))}
            </div>
            {touched && !type && (
              <span role="alert" className={styles.error}>
                문의 유형을 골라 주세요
              </span>
            )}
          </fieldset>

{/* 서버 문의 API(POST /inquiries)에는 관련 신청 필드가 없어 서버 모드에서는 숨겨요 */}
          {USE_MOCK && (
                    <Field
            label={
              <>
                관련 신청 · 요청 <span className={styles.optional}>(선택)</span>
              </>
            }
            htmlFor="inq-rel"
            hint="관련 건을 고르면 운영자가 바로 확인할 수 있어요."
          >
            <Select id="inq-rel" value={related} disabled={!store} onChange={(e) => setRelated(e.target.value)}>
              <option value="">{store ? '선택 안 함' : '승인된 매장이 생기면 고를 수 있어요'}</option>
              {openRequests.map((r) => (
                <option key={`${r.kind}:${r.appKind ?? ''}:${r.id}`} value={`${r.kind}:${r.appKind ?? ''}:${r.id}`}>
                  {r.appKind === 'AD' ? '광고 · ' : r.appKind === 'EVENT' ? '이벤트 · ' : ''}{r.summaryText ?? r.id} ({REQUEST_STATUS_LABEL[r.status]})
                </option>
              ))}
            </Select>
          </Field>
          )}

          {/* TODO: 제목을 받을지는 팀 확인 필요 (명세 원본 34) — 지금은 선택 */}
          <Field label="제목 (선택)" htmlFor="inq-title">
            <TextInput id="inq-title" maxLength={80} value={title} onChange={(e) => setTitle(e.target.value)} />
          </Field>

          <Field
            label="내용"
            htmlFor="inq-body"
            hint={`${body.length}자`}
            message={touched && body.trim().length < 10 ? { tone: 'error', text: '내용을 10자 이상 적어 주세요' } : null}
          >
            <TextArea id="inq-body" rows={6} value={body} aria-invalid={touched && body.trim().length < 10} onChange={(e) => setBody(e.target.value)} />
          </Field>

          {files.length > 0 && (
            <ul className={styles.files}>
              {files.map((f) => (
                <li key={f.name}>
                  <Icon name="file" size={16} />
                  <span>
                    {f.name} · {formatFileSize(f.size)}
                  </span>
                  <button type="button" aria-label={`${f.name} 삭제`} onClick={() => setFiles((list) => list.filter((x) => x !== f))}>
                    <Icon name="close" size={14} />
                  </button>
                </li>
              ))}
            </ul>
          )}
          <input
            ref={fileInput}
            type="file"
            multiple
            accept="image/*,application/pdf"
            className="sr-only"
            aria-label="사진 · 파일 첨부"
            onChange={(e) => {
              const picked = Array.from(e.target.files ?? []);
              setFiles((list) => [...list, ...picked].slice(0, MAX_FILES));
              e.target.value = '';
            }}
          />
          {submit.error && <Notice tone="danger" role="alert">{submit.error}</Notice>}
          <div className={page.actionsBetween}>
            <Button variant="secondary" disabled={files.length >= MAX_FILES} onClick={() => fileInput.current?.click()}>
              <Icon name="upload" />
              사진 · 파일 첨부 {files.length > 0 && `(${files.length}/${MAX_FILES})`}
            </Button>
            <Button type="submit" disabled={submit.pending}>
              {submit.pending ? '보내는 중…' : '문의 보내기'}
            </Button>
          </div>
        </form>

        <div className={page.side}>
          <Card title="내 문의" aside={waiting > 0 ? `답변 대기 ${waiting}` : undefined} padding="none">
            <LoadState status={inquiries.status} errorText={inquiries.error ?? undefined} onRetry={inquiries.reload} />
            {inquiries.status === 'success' && inquiries.items.length === 0 && <p className={styles.empty}>아직 보낸 문의가 없어요.</p>}
            <ul className={styles.myList}>
              {inquiries.items.map((q) =>
                q.answer ? (
                  <li key={q.id}>
                    <details className={styles.item}>
                      <summary>
                        <span className={styles.meta}>
                          <span>
                            {q.type} · {formatDate(q.submittedAt, true)}
                          </span>
                          <Tag tone="green">답변 완료</Tag>
                        </span>
                        <span className={styles.qTitle}>{q.title ?? q.content.slice(0, 40)}</span>
                      </summary>
                      <p className={styles.question}>{q.content}</p>
                      <div className={styles.answer}>
                        <span>운영팀 답변 · {formatDate(q.answer.answeredAt, true)}</span>
                        <p>{q.answer.content}</p>
                      </div>
                    </details>
                  </li>
                ) : (
                  <li key={q.id} className={styles.item}>
                    <span className={styles.meta}>
                      <span>
                        {q.type} · {formatDate(q.submittedAt, true)}
                      </span>
                      <Tag tone="yellow">답변 대기</Tag>
                    </span>
                    <span className={styles.qTitle}>{q.title ?? q.content.slice(0, 40)}</span>
                  </li>
                ),
              )}
            </ul>
            {inquiries.hasMore && (
              <div className={styles.moreRow}>
                <Button variant="secondary" size="sm" onClick={inquiries.loadMore} disabled={inquiries.loadingMore}>
                  {inquiries.loadingMore ? '불러오는 중…' : '더 보기'}
                </Button>
              </div>
            )}
          </Card>

          <Card title="자주 묻는 질문">
            <LoadState status={faqs.status} errorText={faqs.error?.message} onRetry={faqs.reload} />
            {faqs.data?.length === 0 && <p className={page.muted}>등록된 질문이 없어요.</p>}
            <div className={styles.faqs}>
              {faqs.data?.map((f) => (
                <details key={f.question} className={styles.faq}>
                  <summary>{f.question}</summary>
                  <p>{f.answer}</p>
                </details>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
