import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { getRequestPage, type RequestStatusFilter, type RequestTypeFilter } from '@/api/requests';
import { Button, ButtonLink } from '@/components/common/Button';
import { Icon } from '@/components/common/Icon';
import { KpiCard } from '@/components/common/KpiCard';
import { LoadState } from '@/components/common/LoadState';
import { Notice } from '@/components/common/Notice';
import { PageHeader } from '@/components/common/PageHeader';
import { Segmented } from '@/components/common/Segmented';
import { StatGrid } from '@/components/common/StatGrid';
import { StatusChip } from '@/components/common/StatusChip';
import { Tag } from '@/components/common/Tag';
import { PromoModals } from '@/components/promo/PromoModals';
import type { PromoModalState } from '@/components/promo/promoModalState';
import { RequestDetailModal } from '@/components/requests/RequestDetailModal';
import { useCurrentStore } from '@/hooks/useCurrentStore';
import { useCursorList } from '@/hooks/useCursorList';
import page from '@/styles/page.module.css';
import type { PartnerRequest, RequestPage } from '@/types';
import { formatDate } from '@/utils/format';
import styles from './RequestsPage.module.css';

const KIND = {
  CONDITION: { label: '입장 조건', tone: 'gray' as const },
  EVENT_AD: { label: '이벤트 · 광고', tone: 'orange' as const },
};

/** UI-W-008 요청 처리 현황 (F-WREQ-01) — 거르기 · 다음 페이지는 서버가 해요 */
export function RequestsPage() {
  const { store } = useCurrentStore();
  const [type, setType] = useState<RequestTypeFilter>('ALL');
  const [status, setStatus] = useState<RequestStatusFilter>('ALL');
  const [summary, setSummary] = useState<RequestPage['summary'] | null>(null);
  const list = useCursorList(`requests:${store.id}:${type}:${status}`, async (cursor) => {
    const res = await getRequestPage(store.id, { type, status, cursor });
    if (!cursor) setSummary(res.summary);
    return res;
  });
  const [conditionId, setConditionId] = useState<string | null>(null);
  const [promoModal, setPromoModal] = useState<PromoModalState>(null);
  const location = useLocation();
  const navigate = useNavigate();
  const flash = (location.state as { flash?: string } | null)?.flash;

  const openDetail = (r: PartnerRequest) => {
    if (r.kind === 'CONDITION') setConditionId(r.id);
    // 이전 · 다음 이동은 같은 종류(이벤트 · 광고) 신청끼리만 — 같은 숫자 ID 가 섞이지 않게요
    else setPromoModal({ kind: 'application', id: r.id, ids: list.items.filter((x) => x.kind === 'EVENT_AD' && x.appKind === r.appKind).map((x) => x.id), appKind: r.appKind });
  };

  return (
    <div className={page.stack}>
      <PageHeader
        breadcrumb={[{ label: '대시보드', to: '/dashboard' }, { label: '요청 처리 현황' }]}
        title="요청 처리 현황"
        description="입장 조건 변경 요청과 이벤트 · 광고 신청을 한곳에서 확인해요."
      />
      {flash && (
        <Notice tone="success" role="status" onClose={() => navigate('.', { replace: true, state: null })}>
          {flash}
        </Notice>
      )}

      {summary && (
        <StatGrid label="요약">
          <KpiCard label="진행 중" value={summary.inProgress} unit="건" />
          <KpiCard label="내가 할 일" value={summary.needsAction} unit="건 · 보완 요청" tone="warning" />
          <KpiCard label="완료" value={summary.done} unit="건" />
          <KpiCard
            label="평균 처리"
            value={summary.avgProcessingDays === null ? '–' : summary.avgProcessingDays}
            unit={summary.avgProcessingDays === null ? '' : '일'}
            caption={summary.avgProcessingDays === null ? '끝난 요청이 아직 없어요' : '최근 90일 승인 · 반려 기준'}
          />
        </StatGrid>
      )}

      <section aria-labelledby="list-title" className={styles.card}>
        <h2 id="list-title" className="sr-only">
          요청 목록
        </h2>
        <div className={styles.toolbar}>
          <Segmented
            variant="pill"
            label="종류"
            value={type}
            onChange={setType}
            options={[
              { value: 'ALL', label: '전체' },
              { value: 'CONDITION', label: '입장 조건' },
              { value: 'EVENT_AD', label: '이벤트 · 광고' },
            ]}
          />
          <Segmented
            label="상태"
            value={status}
            onChange={setStatus}
            options={[
              { value: 'ALL', label: '전체' },
              { value: 'IN_PROGRESS', label: '진행 중' },
              { value: 'DONE', label: '완료' },
            ]}
          />
        </div>

        <LoadState status={list.status} errorText={list.error ?? undefined} onRetry={list.reload} />
        {list.status === 'success' &&
          (list.items.length === 0 ? (
            <p className={styles.empty}>해당하는 요청이 없어요.</p>
          ) : (
            <ul className={styles.list}>
              {list.items.map((r) => {
                const fix = r.kind === 'CONDITION' && r.status === 'NEEDS_INFO';
                return (
                  <li key={`${r.kind}:${r.appKind ?? ''}:${r.id}`} className={`${styles.row} ${fix ? styles.fixRow : ''}`}>
                    <span className={styles.date}>{formatDate(r.submittedAt)}</span>
                    <span className={styles.type}>
                      <Tag tone={KIND[r.kind].tone}>{KIND[r.kind].label}</Tag>
                    </span>
                    <span className={styles.text}>
                      <strong>{r.summaryText ?? (r.kind === 'CONDITION' ? '입장 조건 변경 요청' : '이벤트 · 광고 신청')}</strong>
                      {fix && <span className={styles.fixNote}>보완 요청이 왔어요. 사유를 보고 다시 보내 주세요.</span>}
                    </span>
                    <StatusChip status={r.status} />
                    <span className={styles.action}>
                      {fix ? (
                        <ButtonLink to={`/conditions/edit?request=${encodeURIComponent(r.id)}`} variant="secondary" size="sm" className={styles.fixButton}>
                          보완하기
                        </ButtonLink>
                      ) : (
                        <button type="button" className={styles.more} onClick={() => openDetail(r)}>
                          자세히
                          <Icon name="chevronRight" size={16} />
                        </button>
                      )}
                    </span>
                  </li>
                );
              })}
            </ul>
          ))}
        {list.hasMore && (
          <div className={styles.loadMore}>
            <Button variant="secondary" onClick={list.loadMore} disabled={list.loadingMore}>
              {list.loadingMore ? '불러오는 중…' : '더 보기'}
            </Button>
          </div>
        )}
        <p className={styles.foot}>입장 조건 요청은 입장 조건 현황에서, 이벤트 · 광고 신청은 광고 · 이벤트에서 새로 보낼 수 있어요.</p>
      </section>

      <RequestDetailModal requestId={conditionId} onClose={() => setConditionId(null)} onChanged={list.reload} />
      <PromoModals modal={promoModal} onChange={setPromoModal} onChanged={list.reload} />
    </div>
  );
}
