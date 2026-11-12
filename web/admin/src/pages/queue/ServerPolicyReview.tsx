import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { adminStoreName } from '@/api/queue';
import { conditionActions, getAdminConditionReview, getBreedNames, reviewAdminCondition, sameRules, type AdminConditionReview, type ConditionReviewAction, type RuleSet } from '@/api/policy';
import { Button } from '@/components/common/Button';
import { Card } from '@/components/common/Card';
import { Choice, Field, TextArea } from '@/components/common/Field';
import { InfoList } from '@/components/common/InfoList';
import { LoadState } from '@/components/common/LoadState';
import { Notice } from '@/components/common/Notice';
import { PageHeader } from '@/components/common/PageHeader';
import { Tag } from '@/components/common/Tag';
import { PolicyRulesEditor, PolicyRulesView } from '@/components/policy/PolicyRules';
import { useAction } from '@/hooks/useAction';
import { useFetch } from '@/hooks/useFetch';
import page from '@/styles/page.module.css';
import { notifyCountsChanged } from '@/utils/counts';
import { formatDate } from '@/utils/format';

const STATUS_LABEL: Record<string, string> = { RECEIVED: '접수', IN_REVIEW: '검토 중', NEEDS_SUPPLEMENT: '보완 요청', APPROVED: '승인', REJECTED: '반려', CANCELED: '취소' };
const KIND_LABEL: Record<string, string> = { CONDITION_REQUEST: '업체 변경 요청', AI_CANDIDATE: 'AI 정책 후보', OPERATOR_DIRECT: '운영자 직접 변경', RECHECK: '재확인 요청' };
const ACTION_LABEL: Record<ConditionReviewAction, string> = { START_REVIEW: '검토 시작', APPROVE: '승인', NEEDS_INFO: '보완 요청', REJECT: '반려' };

/** 서버 모드 UI-O-003 입장 조건 요청 검토 (GET · PATCH /admin/condition-requests/{requestId}) */
export function ServerPolicyReviewPage() {
  const { id = '' } = useParams();
  const review = useFetch(`server-policy:${id}`, () => getAdminConditionReview(id));
  const breeds = useFetch('breeds', getBreedNames);
  return (
    <div className={page.stack}>
      <LoadState status={review.status} errorText={review.error?.message ?? '요청을 불러오지 못했어요.'} onRetry={review.reload} />
      {review.status === 'error' && <Link to="/queue">검토 대기열로 돌아가기</Link>}
      {review.data && <Body key={`${review.data.id}:${review.data.status}`} r={review.data} breeds={breeds.data ?? new Map()} reload={review.reload} />}
    </div>
  );
}

function Body({ r, breeds, reload }: { r: AdminConditionReview; breeds: Map<string, string>; reload: () => void }) {
  const navigate = useNavigate();
  const storeName = useFetch(`store-name:${r.storeId}`, () => (r.storeId ? adminStoreName(r.storeId) : Promise.resolve(null)));
  const actions = conditionActions(r.status);
  const decisions = actions.filter((a) => a !== 'START_REVIEW');
  const [action, setAction] = useState<ConditionReviewAction | null>(decisions[0] ?? null);
  const [comment, setComment] = useState('');
  // 승인 정책을 고치면 요청 정책 '전체'에서 시작해요 (고치지 않은 조건이 빠지지 않게)
  const [editPolicy, setEditPolicy] = useState(false);
  const [approved, setApproved] = useState<RuleSet>({ breedRules: [...r.requested.breedRules], equipmentRules: [...r.requested.equipmentRules], vaccineRules: [...r.requested.vaccineRules] });
  const run = useAction(reviewAdminCondition);
  const versionMismatch = r.baseVersion !== null && r.currentVersion !== null && r.baseVersion !== r.currentVersion;
  const needsComment = action === 'NEEDS_INFO' || action === 'REJECT';
  const canDecide = action !== null && (!needsComment || comment.trim().length > 0) && comment.trim().length <= 500 && !run.pending;

  const onStart = async () => {
    if ((await run.run(r.id, 'START_REVIEW', '', null)).ok) {
      notifyCountsChanged();
      reload();
    }
  };
  const onDecide = async () => {
    if (!action || !canDecide) return;
    const policy = action === 'APPROVE' && editPolicy && !sameRules(approved, r.requested) ? approved : null;
    const res = await run.run(r.id, action, comment, policy);
    if (!res.ok) {
      if (['INVALID_REQUEST_STATE', 'POLICY_VERSION_CONFLICT', 'CONFLICT'].includes(res.error.code)) reload();
      return;
    }
    notifyCountsChanged();
    const name = storeName.data ?? `업체 ${r.storeId}`;
    navigate('/queue', { state: { flash: { text: `${name} 요청을 ${ACTION_LABEL[action]} 처리했어요${res.data.appliedPolicyVersion ? ` (정책 버전 ${res.data.appliedPolicyVersion})` : ''}.`, storeId: r.storeId } } });
  };

  return (
    <>
      <nav aria-label="현재 위치" className={page.muted}>
        <Link to="/queue">검토 대기열</Link> / {r.id}
      </nav>
      <PageHeader
        title={KIND_LABEL[r.kind] ?? r.kind}
        titleAside={
          <Tag shape="pill" tone={r.status === 'IN_REVIEW' ? 'blue' : 'gray'}>
            {STATUS_LABEL[r.status] ?? r.status}
          </Tag>
        }
        meta={
          <>
            <span>{storeName.data ?? (r.storeId ? `업체 ${r.storeId}` : '—')}</span>
            <span>접수 {r.createdAt ? formatDate(r.createdAt) : '—'}</span>
            <span>기준 버전 {r.baseVersion ?? '—'} · 현재 버전 {r.currentVersion ?? '—'}</span>
          </>
        }
      />
      {versionMismatch && (
        <Notice tone="warning">요청 뒤 정책이 바뀌었어요 (기준 {r.baseVersion} → 현재 {r.currentVersion}). 승인하면 요청 정책 전체로 바뀌니 현재 정책과 비교해 주세요.</Notice>
      )}
      <div className={page.split}>
        <div className={page.main}>
          <Card title="요청 정책" aside="현재 정책과 비교">
            <PolicyRulesView rules={r.requested} compareTo={r.current} breeds={breeds} />
          </Card>
          <Card title="현재 정책">
            <PolicyRulesView rules={r.current} breeds={breeds} />
          </Card>
          <Card title="원문 · 근거">
            <InfoList
              labelWidth={96}
              rows={[
                { label: '정책 원문', value: r.sourceText || '—' },
                {
                  label: '근거 주소',
                  value: r.evidenceUrls.length ? (
                    <ul className={page.stackSm}>
                      {r.evidenceUrls.map((u) => (
                        <li key={u}>
                          <a href={u} target="_blank" rel="noreferrer">
                            {u}
                          </a>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    '—'
                  ),
                },
                ...(r.reviewNote ? [{ label: '처리 사유', value: r.reviewNote }] : []),
              ]}
            />
          </Card>
        </div>
        <div className={page.side}>
          <Card title="처리">
            {actions.length === 0 && <p className={page.muted}>지금 상태({STATUS_LABEL[r.status] ?? r.status})에서는 처리할 수 있는 작업이 없어요.</p>}
            {actions.includes('START_REVIEW') && (
              <Button onClick={onStart} disabled={run.pending}>
                {run.pending ? '처리 중…' : '검토 시작'}
              </Button>
            )}
            {decisions.length > 0 && (
              <div className={page.stackSm}>
                <div role="radiogroup" aria-label="처리 결과" className={page.stackSm}>
                  {decisions.map((a) => (
                    <Choice key={a} type="radio" name="decision" label={ACTION_LABEL[a]} checked={action === a} onChange={() => setAction(a)} />
                  ))}
                </div>
                {action === 'APPROVE' && (
                  <>
                    <Choice type="checkbox" label="승인할 정책을 고치기 (요청 정책 전체를 기준으로 보내요)" checked={editPolicy} onChange={(e) => setEditPolicy(e.target.checked)} />
                    {editPolicy && <PolicyRulesEditor value={approved} onChange={setApproved} breeds={breeds} />}
                  </>
                )}
                <Field label={needsComment ? '사유 (업체에 보여요)' : '메모 (선택)'} htmlFor="sv-comment" hint={`${comment.trim().length}/500`}>
                  <TextArea id="sv-comment" rows={3} maxLength={500} value={comment} onChange={(e) => setComment(e.target.value)} />
                </Field>
                <Button onClick={onDecide} disabled={!canDecide}>
                  {run.pending ? '처리 중…' : action ? `${ACTION_LABEL[action]}하기` : '처리'}
                </Button>
              </div>
            )}
            {run.error && (
              <Notice tone="danger" role="alert">
                {run.error}
              </Notice>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}
