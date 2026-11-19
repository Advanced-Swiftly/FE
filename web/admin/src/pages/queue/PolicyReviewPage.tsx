import { USE_MOCK } from '@/api/client';
import { ServerPolicyReviewPage } from './ServerPolicyReview';
import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { toApiError } from '@/api/errors';
import { decideConditionRequest, getConditionReview, previewConditionReview, reviewRows, saveProposal, startConditionReview } from '@/api/queue';
import { Card } from '@/components/common/Card';
import { ConditionValueInput } from '@/components/conditions/ConditionValueInput';
import { invalidField } from '@/utils/conditionEdit';
import { Icon } from '@/components/common/Icon';
import { JudgmentChip } from '@/components/common/JudgmentChip';
import { LoadState } from '@/components/common/LoadState';
import { Notice } from '@/components/common/Notice';
import { PageHeader } from '@/components/common/PageHeader';
import { Tag, type TagTone } from '@/components/common/Tag';
import { Timeline } from '@/components/common/Timeline';
import { DecisionPanel } from '@/components/review/DecisionPanel';
import { StartReviewPanel } from '@/components/review/StartReviewPanel';
import { useAction } from '@/hooks/useAction';
import { useFetch } from '@/hooks/useFetch';
import { appToday } from '@/utils/today';
import page from '@/styles/page.module.css';
import table from '@/styles/table.module.css';
import type { ConditionAction, ConditionState, Decision, PolicyReview, ProposalFieldStatus, ReviewStatus, VerdictPreview } from '@/types';
import { CONDITION_LABEL, changedFields, describeField, describeValue, sameField } from '@/utils/conditions';
import { notifyCountsChanged } from '@/utils/counts';
import { formatDate } from '@/utils/format';
import styles from './Review.module.css';

const FIELD_STATUS: Record<ProposalFieldStatus, { label: string; tone: TagTone }> = {
  CHANGED: { label: '변경', tone: 'blue' },
  CHECK: { label: '확인 필요', tone: 'yellow' },
  NEW: { label: '신규', tone: 'green' },
  SAME: { label: '기존과 같음', tone: 'gray' },
  KEEP_UNKNOWN: { label: '미확인 유지', tone: 'gray' },
};

const STATUS: Record<ReviewStatus, { label: string; tone: TagTone }> = {
  RECEIVED: { label: '접수', tone: 'gray' },
  IN_REVIEW: { label: '검토 중', tone: 'blue' },
  NEEDS_INFO: { label: '업체 보완 대기', tone: 'yellow' },
  APPROVED: { label: '승인', tone: 'green' },
  REJECTED: { label: '반려', tone: 'red' },
  CANCELED: { label: '취소', tone: 'gray' },
};
/** 모르는 상태 값은 받은 글자 그대로 보여 줘요 */
const statusOf = (s: string) => STATUS[s as ReviewStatus] ?? { label: s, tone: 'gray' as TagTone };

const DONE_TEXT: Record<string, string> = {
  APPROVED: '승인된 요청이에요. 조건은 이미 반영됐어요.',
  REJECTED: '반려된 요청이에요. 지금 적용 중인 조건은 그대로예요.',
  CANCELED: '업체가 취소한 요청이에요.',
  NEEDS_INFO: '업체에 보완을 요청했어요. 업체가 다시 제출하면 접수 상태로 돌아와요.',
};

/** UI-O-003 AI 정책 후보 · 업체 변경 요청 검토 (/queue/policy/:id) */
/** 서버 모드는 실제 BE 정책 구조(견종 · 준비물 · 예방접종)로 검토해요 */
export function PolicyReviewPage() {
  return USE_MOCK ? <MockPolicyReviewPage /> : <ServerPolicyReviewPage />;
}

function MockPolicyReviewPage() {
  const { id = '' } = useParams();
  const review = useFetch(`policy:${id}`, () => getConditionReview(id));

  return (
    <div className={page.stack}>
      <LoadState status={review.status} errorText={review.error?.message ?? '이미 처리됐거나 없는 요청이에요.'} onRetry={review.reload} />
      {review.status === 'error' && <Link to="/queue">검토 대기열로 돌아가기</Link>}
      {review.data && <ReviewBody key={`${id}:${review.data.status}:${review.data.allowedActions.join()}`} r={review.data} reload={review.reload} />}
    </div>
  );
}

function ReviewBody({ r, reload }: { r: PolicyReview; reload: () => void }) {
  const navigate = useNavigate();
  const isAi = r.type === 'AI_POLICY';
  // 처리 버튼 · 직접 수정은 서버 allowedActions 에 있는 것만 열어요 (F-OREV-03).
  // AI 후보만 EDIT_PROPOSAL 이 오고, 업체 요청은 보완 요청(REQUEST_SUPPLEMENT)으로 돌려보내요.
  const allowed = r.allowedActions;
  const editable = allowed.includes('EDIT_PROPOSAL');
  const ACTION_DECISION: [ConditionAction, Decision][] = [
    ['APPROVE', 'APPROVE'],
    ['REQUEST_SUPPLEMENT', 'REVISE'],
    ['REJECT', 'REJECT'],
  ];
  const actions: Decision[] = ACTION_DECISION.filter(([a]) => allowed.includes(a)).map(([, d]) => d);
  const [blockedNow, setBlockedNow] = useState<string | null>(null);
  // 운영자가 고치는 중인 변경안 (저장 전). 저장된 변경안은 r.proposal
  const [draft, setDraft] = useState<ConditionState>(() => structuredClone(r.proposal));
  const [decision, setDecision] = useState<Decision>(r.warnings.length > 0 && actions.includes('REVISE') ? 'REVISE' : (actions[0] ?? 'APPROVE'));
  const [reason, setReason] = useState('');
  const decide = useAction(decideConditionRequest);
  const save = useAction(saveProposal);
  const start = useAction(startConditionReview);

  // 저장 안 한 직접 수정 항목
  const dirty = changedFields(r.proposal, draft);
  const invalid = r.fields.map((f) => f.field).filter((f) => invalidField(draft, f));
  const rows = reviewRows(r, draft);

  // 판정 영향 (F-OREV-05) — 값을 고치면 0.4초 뒤 다시 계산해요
  const [impact, setImpact] = useState<{ dogs: VerdictPreview[] | null; loading: boolean; error: string | null }>({ dogs: null, loading: true, error: null });
  const [impactTick, setImpactTick] = useState(0);
  const draftKey = JSON.stringify(draft);
  const canPreview = allowed.length > 0;
  useEffect(() => {
    if (invalid.length > 0 || !canPreview) return;
    let cancelled = false;
    setImpact((s) => ({ ...s, loading: true }));
    const t = setTimeout(() => {
      previewConditionReview(r.id, r.current, r.proposal, dirty.length ? draft : undefined)
        .then((dogs) => !cancelled && setImpact({ dogs, loading: false, error: null }))
        .catch((e: unknown) => !cancelled && setImpact((s) => ({ ...s, loading: false, error: toApiError(e).message })));
    }, 400);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [draftKey, impactTick, invalid.length, canPreview]);

  const onSaveDraft = async () => {
    const res = await save.run(r.id, r.proposal, draft);
    if (res.ok) reload();
  };

  /** 처리 직전에 상세를 다시 읽어 그 작업이 아직 허용되는지 확인해요 */
  const stillAllowed = async (action: ConditionAction) => {
    try {
      const latest = await getConditionReview(r.id);
      if (latest.allowedActions.includes(action)) return true;
      setBlockedNow('방금 상태가 바뀌어 이 처리를 할 수 없어요. 최신 정보로 다시 불러왔어요.');
    } catch (e) {
      setBlockedNow(toApiError(e).message);
    }
    reload();
    return false;
  };

  const onStart = async () => {
    setBlockedNow(null);
    if (!(await stillAllowed('START_REVIEW'))) return;
    if ((await start.run(r.id)).ok) {
      notifyCountsChanged();
      reload();
    }
  };

  const onSubmit = async () => {
    setBlockedNow(null);
    const action = ACTION_DECISION.find(([, d]) => d === decision)?.[0];
    if (!action || !(await stillAllowed(action))) return;
    // 승인할 때 저장 안 한 직접 수정이 있으면 먼저 변경안을 저장해요 (F-OREV-04 → 06)
    if (decision === 'APPROVE' && dirty.length > 0) {
      if (invalid.length > 0) return;
      if (!(await save.run(r.id, r.proposal, draft)).ok) return;
    }
    // 사유는 업체에 보이는 reason 으로 보내요 (내부 메모는 업체 상세의 운영 메모)
    const res = await decide.run(r.id, decision, decision === 'APPROVE' ? '' : reason.trim());
    if (!res.ok) {
      // 상태가 바뀌었으면 최신 상세를 다시 불러요
      if (['REQUEST_STATE_CONFLICT', 'REQUEST_NOT_EDITABLE', 'CONDITION_CHANGED_SINCE_REQUEST', 'ACTION_NOT_ALLOWED_FOR_KIND', 'POLICY_VERSION_CONFLICT', 'INVALID_STATUS_TRANSITION'].includes(res.error.code)) reload();
      return;
    }
    notifyCountsChanged();
    const verb = decision === 'APPROVE' ? '승인했어요' : decision === 'REVISE' ? '보완 요청을 보냈어요' : '반려했어요';
    // 승인일은 서버가 돌려준 conditionCheckedAt 을 써요 (화면이 날짜를 만들지 않아요)
    const checkedAt = decision === 'APPROVE' && res.data.conditionCheckedAt ? ` 조건 확인일 ${formatDate(res.data.conditionCheckedAt)}.` : '';
    navigate('/queue', {
      state: {
        flash: {
          text: `${r.storeName} · ${r.title}을 ${verb}. ${decision === 'REVISE' ? '업체가 다시 낼 때까지 보완 대기로 남아요.' : '대기열에서 빠지고 업체 처리 이력에 기록됐어요.'}${checkedAt}`,
          storeId: r.storeId,
        },
      },
    });
  };

  return (
    <>
      <PageHeader
        breadcrumb={[{ label: '검토 대기열', to: '/queue' }, { label: r.id }]}
        title={`${r.storeName} · ${r.title}`}
        titleAside={
          <Tag tone={statusOf(r.status).tone} shape="pill">
            {statusOf(r.status).label}
          </Tag>
        }
        meta={
          <>
            <span>{isAi ? 'AI 정책 후보' : '업체 변경 요청'}</span>
            <span>접수 {r.submittedAt}</span>
            <span>요청자 {r.requester}</span>
          </>
        }
      />

      <div className={page.split}>
        <div className={page.main}>
          {r.baseChanged && (
            <Notice tone="warning" role="alert">
              요청 뒤 조건이 바뀌었어요. 승인할 수 없으니 최신 조건과 비교해 보완 요청이나 반려로 처리해 주세요.
            </Notice>
          )}
          <div className={styles.twoCards}>
            <Card title="원문 · 근거 자료">
              {r.source.fileName &&
                (r.source.fileUrl ? (
                  <a href={r.source.fileUrl} target="_blank" rel="noopener noreferrer" className={styles.evidenceImage}>
                    {/\.(png|jpe?g|gif|webp)$/i.test(r.source.fileName) ? <img src={r.source.fileUrl} alt={`근거 이미지: ${r.source.fileName}`} className={styles.evidenceImg} /> : <Icon name="file" size={28} />}
                    <span>{r.source.fileName} · 새 창에서 열기</span>
                  </a>
                ) : (
                  <div className={styles.evidenceImage} role="img" aria-label={`근거 이미지: ${r.source.fileName}`}>
                    <Icon name="image" size={28} />
                    {r.source.fileName}
                    <span className={table.muted}>예시 데이터라 파일 주소가 없어요</span>
                  </div>
                ))}
              {(r.source.files?.length ?? 0) > 1 && (
                <ul className={styles.fileList}>
                  {r.source.files?.slice(1).map((f) => (
                    <li key={f.url}>
                      <a href={f.url} target="_blank" rel="noopener noreferrer">
                        {f.fileName}
                      </a>
                    </li>
                  ))}
                </ul>
              )}
              {/* 원문 글자는 명세 응답에 없어요(OR-14). 있을 때만 인용으로 보여 주고, 없으면 링크 · 파일로 안내해요. */}
              {r.source.text.length > 0 ? (
                <blockquote className={styles.quote}>
                  {r.source.text.map(([t, mark], i) => (mark ? <mark key={i}>{t}</mark> : <span key={i}>{t}</span>))}
                </blockquote>
              ) : (
                <p className={page.muted}>
                  {r.source.links.length > 0 || (r.source.files?.length ?? 0) > 0 ? '원문 내용은 첨부 파일이나 링크에서 확인해 주세요.' : '함께 받은 원문 · 근거 자료가 없어요. 필요하면 업체에 보완을 요청해 주세요.'}
                </p>
              )}
              <div className={styles.sourceMeta}>
                {r.source.links.map((link, i) => (
                  <a key={`${i}:${link}`} href={link} target="_blank" rel="noopener noreferrer">
                    {link.replace(/^https?:\/\//, '')}
                  </a>
                ))}
                <span>{r.source.meta}</span>
              </div>
            </Card>

            <Card title={isAi ? 'AI 구조화 결과' : '업체가 요청한 값'} aside={editable ? '값을 눌러 직접 고칠 수 있어요' : isAi ? '[검토 시작] 뒤 고칠 수 있어요' : '업체 요청 값은 고치지 않아요'}>
              {r.warnings.length > 0 && (
                <Notice tone="warning" role="alert">
                  <strong>경계값 충돌 {r.warnings.length}건</strong>
                  <ul className={styles.warningList}>
                    {r.warnings.map((w, i) => (
                      <li key={`${i}:${w}`}>{w}</li>
                    ))}
                  </ul>
                </Notice>
              )}
              {r.fields.length === 0 ? (
                <p className={page.muted}>{isAi ? 'AI가 구조화한 항목이 없어요.' : '요청에 담긴 변경 항목이 없어요.'}</p>
              ) : (
              <table className={`${table.table} ${table.compact} ${styles.innerTable}`}>
                <thead>
                  <tr>
                    <th scope="col">항목</th>
                    <th scope="col">{isAi ? '추출 값' : '요청 값'}</th>
                    <th scope="col">상태</th>
                  </tr>
                </thead>
                <tbody>
                  {r.fields.map((f) => {
                    const isDirty = dirty.includes(f.field);
                    const original = describeValue(f.field, f.originalValue, f.originalUnrestricted);
                    return (
                      <tr key={f.field}>
                        <td>{CONDITION_LABEL[f.field]}</td>
                        <td>
                          {editable ? (
                            <>
                              <ConditionValueInput field={f.field} state={draft} onChange={setDraft} idPrefix={`ex-${r.id}`} disabled={save.pending || decide.pending} />
                              {(f.edited || isDirty) && <span className={table.sub}>처음 받은 값 · {f.originalValue === null && !f.originalUnrestricted ? '원문에 없음' : original}</span>}
                            </>
                          ) : f.originalValue === null && !f.originalUnrestricted && !f.edited ? (
                            <span className={table.muted}>원문에 없음 · 미확인</span>
                          ) : (
                            describeField(r.proposal, f.field)
                          )}
                        </td>
                        <td>
                          {isDirty ? <Tag tone="primary">고치는 중</Tag> : f.edited ? <Tag tone="primary">직접 수정</Tag> : <Tag tone={FIELD_STATUS[f.status].tone}>{FIELD_STATUS[f.status].label}</Tag>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              )}
              {editable && r.fields.length > 0 && (
                <div className={styles.draftBar}>
                  <span className={table.muted}>
                    {invalid.length > 0
                      ? `${invalid.map((f) => CONDITION_LABEL[f]).join(', ')} 값을 입력해 주세요.`
                      : dirty.length > 0
                        ? `저장 안 한 수정 ${dirty.length}개 · 승인하면 함께 저장돼요`
                        : '고친 값은 승인 전까지 입장 조건에 반영되지 않아요.'}
                  </span>
                  <span className={styles.draftButtons}>
                    <button type="button" className={page.retry} disabled={dirty.length === 0 || save.pending} onClick={() => setDraft(structuredClone(r.proposal))}>
                      되돌리기
                    </button>
                    <button type="button" className={page.retry} disabled={dirty.length === 0 || invalid.length > 0 || save.pending} onClick={onSaveDraft}>
                      {save.pending ? '저장 중…' : '변경안 저장'}
                    </button>
                  </span>
                  {save.error && (
                    <span role="alert" className={styles.error}>
                      {save.error}
                    </span>
                  )}
                </div>
              )}
            </Card>
          </div>

          {rows.length > 0 && (
            <Card title="현재 조건과 변경안" padding="none">
              <div className={table.scroll}>
                <table className={table.table}>
                  <thead>
                    <tr>
                      <th scope="col">항목</th>
                      <th scope="col">현재 적용 ({r.checkedAt} 확인)</th>
                      <th scope="col">승인 후</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((f) => {
                      const changed = !sameField(r.current, draft, f);
                      return (
                        <tr key={f}>
                          <td>{CONDITION_LABEL[f]}</td>
                          <td>{changed ? <del className={styles.del}>{describeField(r.current, f)}</del> : describeField(r.current, f)}</td>
                          <td>{changed ? <ins className={styles.ins}>{describeField(draft, f)}</ins> : <span className={table.muted}>변경 없음</span>}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <p className={styles.foot}>승인은 요청 전체 단위예요. 일부 항목만 승인할 수 없어요.</p>
            </Card>
          )}

          {/* 처리할 수 있는 작업이 없으면(처리 끝난 건 · allowedActions: []) 미리보기도 요청하지 않아요 */}
          {canPreview && (
          <Card title="판정 영향 미리보기" aside={impact.loading && impact.dogs ? '다시 계산 중…' : '테스트용 반려견 · 변경안 전체 반영 기준'}>
            {invalid.length > 0 ? (
              <p className={page.muted}>값을 모두 입력하면 판정을 다시 계산해요.</p>
            ) : impact.error ? (
              <p role="alert" className={page.muted}>
                {impact.error}{' '}
                <button type="button" className={page.retry} onClick={() => setImpactTick((t) => t + 1)}>
                  다시 시도
                </button>
              </p>
            ) : !impact.dogs ? (
              <p className={page.muted}>판정을 계산하는 중…</p>
            ) : (
              <div className={styles.impact} aria-busy={impact.loading}>
                {impact.dogs.map((im) => (
                  <div key={im.dogId} className={styles.impactItem}>
                    <span>{im.label}</span>
                    <div className={styles.impactRow}>
                      <JudgmentChip judgment={im.before} />
                      <Icon name="arrowRight" size={16} />
                      <JudgmentChip judgment={im.after} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
          )}
        </div>

        <aside className={page.side}>
          {blockedNow && (
            <Notice tone="warning" role="alert">
              {blockedNow}
            </Notice>
          )}
          {allowed.includes('START_REVIEW') ? (
            <StartReviewPanel pending={start.pending} error={start.error} onStart={onStart} />
          ) : actions.length > 0 ? (
            <DecisionPanel
              actions={actions}
              decision={decision}
              onDecision={setDecision}
              reason={reason}
              onReason={setReason}
              approveLabel="승인 · 조건 반영"
              approveBlock={r.fields.length === 0 ? '변경안 항목이 없어 승인할 수 없어요. 상세를 다시 불러오거나 보완을 요청해 주세요.' : r.baseChanged ? '요청 뒤 조건이 바뀌어 승인할 수 없어요.' : invalid.length > 0 ? '직접 고친 값을 모두 입력해야 승인할 수 있어요.' : undefined}
              pending={decide.pending || save.pending}
              error={decide.error ?? save.error}
              onSubmit={onSubmit}
              hint={
                decision === 'APPROVE' ? (
                  <>
                    승인하면 바로 입장 조건에 반영되고 조건 확인일이 승인일(오늘 <strong>{formatDate(appToday())}</strong>, 한국 시간)로 바뀌어요. 변경 전후와 처리자가 이력에 남고, 대기열에서 사라져요.
                    {(dirty.length > 0 || r.fields.some((f) => f.edited)) && ` 직접 고친 값도 함께 반영돼요.`}
                  </>
                ) : (
                  '지금 적용 중인 조건은 그대로예요. 업체는 처리 결과와 사유를 업체 센터에서 확인해요.'
                )
              }
            />
          ) : (
            <Card title="처리 결과">
              <p className={page.muted}>
                {DONE_TEXT[r.status] ?? '지금은 처리할 수 있는 작업이 없어요.'}
              </p>
            </Card>
          )}
          <Card title="처리 이력">
            {r.history.length > 0 ? <Timeline items={r.history} /> : <p className={page.muted}>처리 이력은 업체 전체 이력에서 볼 수 있어요.</p>}
            <Link to={`/stores/${r.storeId}?tab=history`} className={styles.smallLink}>
              업체 전체 이력 보기
            </Link>
          </Card>
        </aside>
      </div>
    </>
  );
}
