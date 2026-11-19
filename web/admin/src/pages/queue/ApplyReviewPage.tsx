import { useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { decideApplication, getApplicationReview } from '@/api/queue';
import { toApiError } from '@/api/errors';
import { ButtonLink } from '@/components/common/Button';
import { Card } from '@/components/common/Card';
import { Icon } from '@/components/common/Icon';
import { InfoList } from '@/components/common/InfoList';
import { LoadState } from '@/components/common/LoadState';
import { Notice } from '@/components/common/Notice';
import { PageHeader } from '@/components/common/PageHeader';
import { Tag } from '@/components/common/Tag';
import { DecisionPanel } from '@/components/review/DecisionPanel';
import { StartReviewPanel } from '@/components/review/StartReviewPanel';
import { useAction } from '@/hooks/useAction';
import { useFetch } from '@/hooks/useFetch';
import page from '@/styles/page.module.css';
import type { ApplicationAction, ApplyReview, Decision } from '@/types';
import { notifyCountsChanged } from '@/utils/counts';
import { formatDate } from '@/utils/format';
import styles from './Review.module.css';

const CHECK_LABEL: Record<string, string> = {
  REGION: '행사 대상 지역 안 매장',
  BUSINESS_VERIFIED: '업체 인증 승인',
  QR_ACTIVE: '매장 QR 사용 중',
  CONDITION_CHECKED_RECENT: '조건 확인일 30일 이내',
  QR_PLEDGE: 'QR 비치 약속 동의',
};
const STATUS_LABEL: Record<string, string> = {
  RECEIVED: '접수',
  IN_REVIEW: '검토 중',
  APPROVED: '승인',
  REJECTED: '반려',
  CANCELED: '취소',
  CLOSED_NOT_APPROVED: '모집 종료 · 미승인',
};
const dt = (iso: string | null | undefined) => (iso ? `${formatDate(iso)} ${iso.slice(11, 16)}` : '—');

function checkDetail(c: ApplyReview['checks'][number]) {
  if (!c.detail) return null;
  const parts = [c.detail.checkedDate ? `확인일 ${formatDate(c.detail.checkedDate)}` : '확인일 없음', c.detail.daysSince !== null && c.detail.daysSince !== undefined ? `${c.detail.daysSince}일 전` : null, c.detail.reason ?? null];
  return parts.filter(Boolean).join(' · ');
}

/** UI-O-004 이벤트(댕댕로드 참여) · 광고 신청 검토 (/queue/apply/:id) — F-OAPP-01 · 02 */
export function ApplyReviewPage() {
  const { id = '' } = useParams();
  const [params] = useSearchParams();
  // 이벤트(EVENT) · 광고(AD) 신청은 서버 경로가 달라서 종류를 주소에 함께 들고 다녀요
  const kindParam = params.get('type');
  const kind = kindParam === 'EVENT' || kindParam === 'AD' ? kindParam : null;
  const review = useFetch(`apply:${kind ?? '-'}:${id}`, () => getApplicationReview(id, kind));

  return (
    <div className={page.stack}>
      <LoadState status={review.status} errorText={review.error?.message ?? '이미 처리됐거나 상세 정보가 없는 신청이에요.'} onRetry={review.reload} />
      {review.status === 'error' && <Link to="/queue">검토 대기열로 돌아가기</Link>}
      {review.data && <ApplyBody key={`${id}:${review.data.status}:${review.data.allowedActions.join()}`} r={review.data} kind={kind} reload={review.reload} />}
    </div>
  );
}

function ApplyBody({ r, kind, reload }: { r: ApplyReview; kind: 'EVENT' | 'AD' | null; reload: () => void }) {
  const navigate = useNavigate();
  const isEvent = r.type === 'STAMP_ROAD';
  // 승인 · 반려 버튼은 서버 allowedActions 에 있는 것만 보여요 (빈 배열이면 아무것도 못 해요)
  const allowed = r.allowedActions;
  const actions: Decision[] = (['APPROVE', 'REJECT'] as const).filter((a) => allowed.includes(a));
  const [decision, setDecision] = useState<Decision>(actions[0] ?? 'APPROVE');
  const [reason, setReason] = useState('');
  const [blockedNow, setBlockedNow] = useState<string | null>(null);
  const decide = useAction(decideApplication);
  const start = useAction(decideApplication);

  const failedNow = r.checks.filter((c) => !c.passed);
  const shownStatus = r.displayStatus ?? r.status;

  /** 처리 직전에 상세를 다시 읽어 그 작업이 아직 허용되는지 확인해요 */
  const stillAllowed = async (action: ApplicationAction) => {
    try {
      const latest = await getApplicationReview(r.id, kind);
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
    if ((await start.run(r.id, 'START_REVIEW', '', kind)).ok) {
      notifyCountsChanged();
      reload();
    }
  };

  const onSubmit = async () => {
    if (decision === 'REVISE') return;
    setBlockedNow(null);
    if (!(await stillAllowed(decision))) return;
    const res = await decide.run(r.id, decision, decision === 'REJECT' ? reason : '', kind);
    if (!res.ok) {
      if (['APPLICATION_STATE_CONFLICT', 'APPROVAL_DEADLINE_PASSED', 'ELIGIBILITY_NOT_MET'].includes(res.error.code)) reload();
      return;
    }
    notifyCountsChanged();
    const verb = decision === 'APPROVE' ? '승인했어요' : '반려했어요';
    const next = res.data.nextApplicationId ?? r.nextApplicationId;
    if (next && next !== r.id) navigate(`/queue/apply/${encodeURIComponent(next)}${kind ? `?type=${kind}` : ""}`);
    else navigate('/queue', { state: { flash: { text: `${r.storeName} 신청을 ${verb}.`, storeId: r.storeId } } });
  };

  const title = r.title ?? (isEvent ? `${r.stampRoad?.title ?? '댕댕로드'} 참여` : `지도 추천 노출 · ${r.ad?.region ?? ''}`);
  const hint =
    decision === 'APPROVE'
      ? isEvent
        ? '승인하면 이 분기 참여 자격이 생기고, 업체 신청 내역이 ‘승인’으로 바뀌어요. 처리한 신청은 대기열에서 사라져요.'
        : '승인하면 업체 신청 내역이 ‘승인’으로 바뀌어요. 결제 · 노출 처리는 정해지지 않았어요.'
      : '업체 신청 내역에 ‘반려’와 사유가 표시돼요. 모집 기간 안이면 업체가 새로 신청할 수 있어요.';

  return (
    <>
      <div className={styles.topRow}>
        <nav aria-label="현재 위치" className={page.muted}>
          <Link to="/queue">검토 대기열</Link> / {r.id}
        </nav>
        <div className={styles.pager}>
          {r.prevApplicationId ? (
            <Link to={`/queue/apply/${encodeURIComponent(r.prevApplicationId)}${kind ? `?type=${kind}` : ""}`} aria-label="이전 신청">
              <Icon name="chevronLeft" />
            </Link>
          ) : (
            <span aria-disabled="true">
              <Icon name="chevronLeft" />
            </span>
          )}
          {r.nextApplicationId ? (
            <Link to={`/queue/apply/${encodeURIComponent(r.nextApplicationId)}${kind ? `?type=${kind}` : ""}`} aria-label="다음 신청">
              <Icon name="chevronRight" />
            </Link>
          ) : (
            <span aria-disabled="true">
              <Icon name="chevronRight" />
            </span>
          )}
        </div>
      </div>

      <PageHeader
        title={title}
        titleAside={
          <>
            <Tag tone={isEvent ? 'orange' : 'blue'}>{isEvent ? '댕댕로드 참여 신청' : '광고 신청'}</Tag>
            <Tag shape="pill" tone={shownStatus === 'IN_REVIEW' ? 'blue' : 'gray'}>
              {STATUS_LABEL[shownStatus] ?? shownStatus}
            </Tag>
          </>
        }
        meta={
          <>
            <span>{r.storeName}</span>
            <span>신청 {dt(r.submittedAt)}</span>
            {r.reviewStartedAt && <span>검토 시작 {dt(r.reviewStartedAt)}</span>}
            {isEvent && r.stampRoad && <span>모집 마감 {dt(r.stampRoad.recruitment.endAt)}</span>}
          </>
        }
      />

      <div className={page.split}>
        <div className={page.main}>
          {allowed.length === 0 && (
            <Notice tone="warning" role="status">
              지금은 처리할 수 있는 작업이 없어요. 이미 처리됐거나 모집이 끝났을 수 있어요.
            </Notice>
          )}
          <Card
            title="신청 내용"
            aside={isEvent && r.stampRoad ? `이 분기 신청 ${r.stampRoad.recruitmentStatus.applicationCount} · 승인 ${r.stampRoad.recruitmentStatus.approvedCount}` : undefined}
          >
            {r.details ? (
              <>
                <InfoList labelWidth={96} rows={r.details.map((d) => ({ label: d.label, value: d.href ? <a href={d.href} target="_blank" rel="noreferrer">{d.value}</a> : d.value }))} />
                {r.detailNote && <p className={page.muted}>{r.detailNote}</p>}
              </>
            ) : isEvent && r.stampRoad ? (
              <InfoList
                labelWidth={96}
                rows={[
                  { label: '행사', value: `${r.stampRoad.title} · ${r.stampRoad.periodId}` },
                  { label: '대상 지역', value: r.stampRoad.regions.join(' · ') },
                  { label: '모집 기간', value: `${dt(r.stampRoad.recruitment.startAt)} ~ ${dt(r.stampRoad.recruitment.endAt)} 전` },
                  { label: 'QR 비치 약속', value: r.stampRoad.qrPledgeAgreed ? '동의함' : '동의 안 함' },
                  {
                    label: '한 줄 소개',
                    value: (
                      <>
                        {r.stampRoad.intro}{' '}
                        {r.introCheck && (
                          <Tag tone={r.introCheck.passed ? 'green' : 'red'}>
                            {r.introCheck.length} / {r.introCheck.maxLength}자
                          </Tag>
                        )}
                      </>
                    ),
                  },
                ]}
              />
            ) : r.ad ? (
              <InfoList
                labelWidth={96}
                rows={[
                  { label: '상품', value: '지도 추천 노출 · 1주 단위' },
                  { label: '노출 지역', value: r.ad.region },
                  { label: '기간', value: `${formatDate(r.ad.startDate)} – ${formatDate(r.ad.endDate)} (${r.ad.weeks}주)` },
                ]}
              />
            ) : (
              <p className={page.muted}>신청 내용이 없어요.</p>
            )}
            {isEvent && !r.details && <p className={page.muted}>40자는 서버가 확인해요. 입장 조건과 다른 위험한 표현이 없는지는 운영자가 확인해 주세요.</p>}
          </Card>

          {isEvent && (r.checks.length > 0 || r.eligibilityAtSubmit.length > 0) && (
            <Card title="조건 자동 확인" aside={r.checkedAt ? `지금 기준 · ${dt(r.checkedAt)}` : '지금 기준'}>
              <ul className={styles.checks}>
                {r.checks.map((c) => {
                  const atSubmit = r.eligibilityAtSubmit.find((e) => e.code === c.code);
                  return (
                    <li key={c.code}>
                      <Icon name={c.passed ? 'checkCircle' : 'warning'} size={18} className={c.passed ? styles.ok : styles.warn} />
                      <span>
                        <strong>{CHECK_LABEL[c.code] ?? c.code}</strong>
                        <small>
                          {[checkDetail(c), atSubmit ? `신청 때 ${atSubmit.passed ? '통과' : '미통과'}` : null].filter(Boolean).join(' · ') || (c.passed ? '통과' : '미통과')}
                        </small>
                      </span>
                    </li>
                  );
                })}
                {r.eligibilityAtSubmit
                  .filter((e) => !r.checks.some((c) => c.code === e.code))
                  .map((e) => (
                    <li key={`submit-${e.code}`}>
                      <Icon name={e.passed ? 'checkCircle' : 'warning'} size={18} className={e.passed ? styles.ok : styles.warn} />
                      <span>
                        <strong>{CHECK_LABEL[e.code] ?? e.code}</strong>
                        <small>신청 때 {e.passed ? '통과' : '미통과'}</small>
                      </span>
                    </li>
                  ))}
              </ul>
              {failedNow.length > 0 && <p className={page.muted}>지금 기준으로 맞지 않는 조건이 있으면 서버가 승인을 막아요.</p>}
            </Card>
          )}

          <Card>
            <div className={styles.storeBox}>
              <div>
                <h2 className={page.subTitle}>{r.storeName}</h2>
              </div>
              <ButtonLink to={`/stores/${encodeURIComponent(r.storeId)}`} variant="secondary" size="sm">
                업체 상세 보기
              </ButtonLink>
            </div>
          </Card>
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
              hint={hint}
              pending={decide.pending}
              error={decide.error}
              onSubmit={onSubmit}
            />
          ) : (
            <Card title="처리 결과">
              <p className={page.muted}>처리할 수 있는 작업이 없어요.</p>
            </Card>
          )}
        </aside>
      </div>
    </>
  );
}
