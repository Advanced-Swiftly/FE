import { useState } from 'react';
import { Link } from 'react-router-dom';
import { answerQna, getQnaDetail, getQnaPage, type QnaStatusTab } from '@/api/qna';
import { useCursorList } from '@/hooks/useCursorList';
import { Button } from '@/components/common/Button';
import { Card } from '@/components/common/Card';
import { Field, Select, TextArea } from '@/components/common/Field';
import { Icon } from '@/components/common/Icon';
import { LoadState } from '@/components/common/LoadState';
import { Notice } from '@/components/common/Notice';
import { PageHeader } from '@/components/common/PageHeader';
import { Segmented } from '@/components/common/Segmented';
import { Tag } from '@/components/common/Tag';
import { useAction } from '@/hooks/useAction';
import { useFetch } from '@/hooks/useFetch';
import { ANSWER_TEMPLATES } from '@/mocks/qna';
import page from '@/styles/page.module.css';
import type { QnaItem, QnaListItem } from '@/types';
import { notifyCountsChanged } from '@/utils/counts';
import { queuePath } from '@/utils/queue';
import styles from './QnaPage.module.css';

type Who = 'ALL' | NonNullable<QnaItem['author']>;
const AUTHOR = { GUARDIAN: { label: '보호자', tone: 'blue' as const }, BUSINESS: { label: '업체', tone: 'orange' as const } };
/** 답변 최소 글자 수 (공백 제외 · 명세 F-OQNA-03) */
const MIN_ANSWER = 5;

const titleOf = (q: QnaListItem) => q.title ?? (q.preview.length > 40 ? `${q.preview.slice(0, 40)}…` : q.preview || '챗봇에서 전달된 보호자 문의');

/** 관련 요청 화면 — kind / queueType 으로 정해요 */
function relatedPath(q: QnaItem): string | null {
  if (q.relatedRequest) {
    const type = q.relatedRequest.kind === 'EVENT_AD' ? 'EVENT' : q.relatedRequest.kind === 'AI_CANDIDATE' ? 'AI_POLICY' : 'STORE_CHANGE';
    return queuePath({ id: q.relatedRequest.id, type });
  }
  if (q.relatedStore?.queueId && q.relatedStore.queueType) return queuePath({ id: q.relatedStore.queueId, type: q.relatedStore.queueType });
  return null;
}

/** UI-O-011 Q&A — 업체 문의 + 보호자가 챗봇에서 전달에 동의한 문의 (F-OQNA-01 ~ 04) */
export function QnaPage() {
  const [tab, setTab] = useState<QnaStatusTab>('WAITING');
  const [who, setWho] = useState<Who>('ALL');
  const list = useCursorList(`qna:${tab}:${who}`, (cursor) => getQnaPage({ tab, who, cursor }));
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [flash, setFlash] = useState('');

  const items = list.items;
  const selId = items.some((q) => q.id === selectedId) ? selectedId : (items[0]?.id ?? null);
  const detail = useFetch(`qna-detail:${selId ?? 'none'}`, () => (selId ? getQnaDetail(selId) : Promise.reject(new Error('고른 문의가 없어요.'))));

  return (
    <div className={page.stack}>
      <PageHeader title="Q&A" description="업체가 남긴 문의와, 보호자가 챗봇에서 전달에 동의한 문의에 답해요. 답변은 업체 센터 문의하기 · 보호자 챗봇 화면에서 보여요." />
      {flash && (
        <Notice tone="success" role="status" onClose={() => setFlash('')}>
          {flash}
        </Notice>
      )}

      <div className={styles.layout}>
        <Card title="문의 목록" padding="none" className={styles.listCard}>
          <div className={styles.filters}>
            <Segmented
              variant="outline"
              label="답변 상태"
              value={tab}
              onChange={(t) => {
                setTab(t);
                setSelectedId(null);
              }}
              options={[
                { value: 'ALL', label: '전체' },
                { value: 'WAITING', label: '답변 대기' },
                { value: 'ANSWERED', label: '답변 완료' },
              ]}
            />
            <label htmlFor="qna-who" className="sr-only">
              작성자 구분
            </label>
            <Select
              id="qna-who"
              value={who}
              onChange={(e) => {
                setWho(e.target.value as Who);
                setSelectedId(null);
              }}
              className={styles.who}
            >
              <option value="ALL">보호자 · 업체 전체</option>
              <option value="GUARDIAN">보호자</option>
              <option value="BUSINESS">업체</option>
            </Select>
          </div>
          <LoadState status={list.status} errorText={list.error ?? undefined} onRetry={list.reload} />
          {list.status === 'success' &&
            (items.length === 0 ? (
              <p className={styles.empty}>{tab === 'WAITING' ? '답변할 문의가 없어요.' : '해당하는 문의가 없어요.'}</p>
            ) : (
              <ul className={styles.list}>
                {items.map((q) => (
                  <li key={q.id}>
                    <button type="button" aria-current={q.id === selId} className={`${styles.item} ${q.id === selId ? styles.itemOn : ''}`} onClick={() => setSelectedId(q.id)}>
                      <span className={styles.meta}>
                        {q.author ? <Tag tone={AUTHOR[q.author].tone}>{AUTHOR[q.author].label}</Tag> : <Tag tone='gray'>작성자 구분 없음</Tag>}
                        {q.authorName} · {q.createdAt}
                        {q.answered ? <Tag tone="green">답변 완료</Tag> : <Tag tone="yellow">답변 대기</Tag>}
                        {q.attachmentCount > 0 && (
                          <span className={styles.clip}>
                            <Icon name="file" size={14} />
                            {q.attachmentCount}
                          </span>
                        )}
                      </span>
                      <strong>{titleOf(q)}</strong>
                    </button>
                  </li>
                ))}
              </ul>
            ))}
          {list.hasMore && (
            <div className={styles.more}>
              <Button variant="secondary" size="sm" onClick={list.loadMore} disabled={list.loadingMore}>
                {list.loadingMore ? '불러오는 중…' : '더 보기'}
              </Button>
            </div>
          )}
        </Card>

        {selId &&
          (detail.status === 'success' ? (
            <Answer
              key={detail.data.id}
              q={detail.data}
              onReload={detail.reload}
              onDone={() => {
                setFlash(`${detail.data.authorName} 문의에 답변을 등록했어요.`);
                setSelectedId(null);
                list.reload();
                notifyCountsChanged();
              }}
            />
          ) : (
            <Card className={styles.detail}>
              <LoadState status={detail.status} errorText={detail.error?.message} onRetry={detail.reload} />
            </Card>
          ))}
      </div>
    </div>
  );
}

function Answer({ q, onDone, onReload }: { q: QnaItem; onDone: () => void; onReload: () => void }) {
  const related = relatedPath(q);
  const [reply, setReply] = useState('');
  const answer = useAction(answerQna);
  const length = reply.replace(/\s/g, '').length;

  return (
    <Card className={styles.detail}>
      <div className={styles.question}>
        <span className={styles.meta}>
          {q.author ? <Tag tone={AUTHOR[q.author].tone}>{AUTHOR[q.author].label}</Tag> : <Tag tone='gray'>작성자 구분 없음</Tag>}
          {q.authorName} · {q.createdAt}
          {q.context && ` · ${q.context}`}
        </span>
        <h2 className={styles.qTitle}>{q.title ?? '챗봇에서 전달된 보호자 문의'}</h2>
        <p className={styles.body}>{q.body}</p>
        {q.attachments.length > 0 && (
          <div className={styles.attachments}>
            {q.attachments.map((a) => (
              <a key={a.url || a.name} href={a.url} target="_blank" rel="noopener noreferrer">
                {/\.(png|jpe?g|gif|webp)$/i.test(a.name) ? <img src={a.url} alt={`첨부: ${a.name}`} className={styles.thumb} /> : <Icon name="file" size={16} />}
                {a.name}
              </a>
            ))}
          </div>
        )}
      </div>

      {(q.relatedStore || q.relatedRequest) && (
        <div className={styles.related}>
          {q.relatedStore && (
            <>
              <span className={page.muted}>관련 업체</span>
              <Link to={`/stores/${q.relatedStore.id}`}>
                {q.relatedStore.name} · {q.relatedStore.area}
              </Link>
              <span className={page.muted}>· {q.relatedStore.note}</span>
            </>
          )}
          {related && (
            <Link to={related} className={styles.push}>
              관련 요청 보기
            </Link>
          )}
        </div>
      )}

      {q.answer ? (
        <div className={styles.answered}>
          <span>운영팀 답변 · {q.answer.answeredAt}</span>
          <p>{q.answer.body}</p>
          <span className={page.muted}>답변은 한 번만 등록해요. 고치거나 지울 수 없어요.</span>
        </div>
      ) : (
        <>
          <div className={styles.templates}>
            <span className={page.muted}>자주 쓰는 답변</span>
            <div className={page.actions}>
              {ANSWER_TEMPLATES.map((t) => (
                <Button key={t.label} variant="secondary" size="sm" onClick={() => setReply(t.body)}>
                  {t.label}
                </Button>
              ))}
            </div>
          </div>
          <Field
            label="답변"
            htmlFor="qna-reply"
            hint={`공백 빼고 ${length}자 · ${MIN_ANSWER}자 이상 · 확인되지 않은 조건을 ‘가능’이라고 답하지 않도록 주의해 주세요.`}
          >
            <TextArea id="qna-reply" rows={6} value={reply} onChange={(e) => setReply(e.target.value)} />
          </Field>
          {answer.error && (
            <Notice
              tone="danger"
              role="alert"
              action={
                answer.errorCode === 'INQUIRY_ALREADY_ANSWERED' || answer.errorCode === 'IDEMPOTENCY_KEY_CONFLICT' || answer.errorCode === 'IDEMPOTENCY_IN_PROGRESS' ? (
                  <Button variant="secondary" size="sm" onClick={onReload}>
                    다시 불러오기
                  </Button>
                ) : undefined
              }
            >
              {answer.error}
            </Notice>
          )}
          <div className={page.actionsBetween}>
            <span className={page.muted}>답변은 문의당 한 번 등록하고, 등록 뒤에는 고칠 수 없어요.</span>
            <Button
              variant="dark"
              disabled={length < MIN_ANSWER || answer.pending}
              onClick={async () => {
                if ((await answer.run(q.id, reply.trim())).ok) onDone();
              }}
            >
              {answer.pending ? '등록하는 중…' : '답변 등록'}
            </Button>
          </div>
        </>
      )}
    </Card>
  );
}
