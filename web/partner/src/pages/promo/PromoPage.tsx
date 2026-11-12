import { useState } from 'react';
import { getPromoOverview } from '@/api/promo';
import { USE_MOCK } from '@/api/client';
import { getRequestPage } from '@/api/requests';
import { Button } from '@/components/common/Button';
import { Card } from '@/components/common/Card';
import { Icon } from '@/components/common/Icon';
import { LoadState } from '@/components/common/LoadState';
import { PageHeader } from '@/components/common/PageHeader';
import { StatusChip } from '@/components/common/StatusChip';
import { Tag } from '@/components/common/Tag';
import { PromoModals } from '@/components/promo/PromoModals';
import type { PromoModalState } from '@/components/promo/promoModalState';
import { useCurrentStore } from '@/hooks/useCurrentStore';
import { useCursorList } from '@/hooks/useCursorList';
import { useFetch } from '@/hooks/useFetch';
import page from '@/styles/page.module.css';
import { formatDate } from '@/utils/format';
import { periodText, phaseBadge, recruitmentText } from '@/utils/promo';
import styles from './PromoPage.module.css';

/** UI-W-013 광고 · 이벤트 — 행사 F-WAD-01 (모집 중 · 참여 중), 신청 내역 F-WREQ-01 type=EVENT_AD */
export function PromoPage() {
  const { store } = useCurrentStore();
  const promo = useFetch(`promo:${store.id}`, () => getPromoOverview(store.id));
  // 신청 내역 목록은 F-WREQ-01 줄 요약(summaryText)을 그대로 쓰고, 누르면 F-WAD-06 상세를 열어요 (목록에서 상세를 미리 부르지 않아요)
  const apps = useCursorList(`promo-apps:${store.id}`, (cursor) => getRequestPage(store.id, { type: 'EVENT_AD', cursor }));
  const [modal, setModal] = useState<PromoModalState>(null);
  const p = promo.data;
  const reload = () => {
    promo.reload();
    apps.reload();
  };

  return (
    <div className={page.stack}>
      <PageHeader title="광고 · 이벤트" description="배너를 누르면 분기별 댕댕로드 행사의 자세한 내용을 볼 수 있어요." />
      <LoadState status={promo.status} errorText={promo.error?.message} onRetry={promo.reload} />

      {p && (
        <section aria-labelledby="ev-title" className={page.stackSm}>
          <div className={page.actionsBetween}>
            <h2 id="ev-title" className={styles.h2}>
              지역 이벤트 · 댕댕로드
            </h2>
            {USE_MOCK && <span className={page.muted}>시안 기준 시각 {formatDate(p.serverTime)}</span>}
          </div>
          {p.recruiting.length === 0 && p.participating.length === 0 ? (
            <p className={page.muted}>지금 모집 중이거나 참여 중인 행사가 없어요.</p>
          ) : (
            <div className={styles.banners}>
              {p.recruiting.map((ev) => (
                <div key={ev.id} className={`${styles.banner} ${styles.blue}`}>
                  <button type="button" className={styles.bannerMain} onClick={() => setModal({ kind: 'event', eventId: ev.id })}>
                    <span className={styles.bannerBadge}>{phaseBadge(ev, p.serverTime)}</span>
                    <span className={styles.bannerTitle}>{ev.title}</span>
                    <span className={styles.bannerSub}>
                      {periodText(ev.period)} · {ev.regions.join(' · ')}
                    </span>
                    <span className={styles.bannerSub}>참여 신청 {recruitmentText(ev)}</span>
                    {!ev.placeInRegion && <span className={styles.bannerSub}>이 매장은 대상 지역 밖이에요</span>}
                    {ev.myApplication && (
                      <span className={styles.bannerSub}>
                        내 신청 <StatusChip status={ev.myApplication.displayStatus} />
                      </span>
                    )}
                    <span className={styles.bannerMore}>
                      자세히 보기 <Icon name="chevronRight" size={16} />
                    </span>
                    <Icon name="paw" size={96} strokeWidth={1.2} className={styles.bannerArt} />
                  </button>
                </div>
              ))}
              {p.participating.map((ev) => (
                <div key={ev.id} className={`${styles.banner} ${ev.phase === 'IN_PROGRESS' ? styles.orange : styles.gray}`}>
                  <button type="button" className={styles.bannerMain} onClick={() => setModal({ kind: 'event', eventId: ev.id })}>
                    <span className={styles.bannerBadge}>{phaseBadge({ ...ev, participating: true }, p.serverTime)}</span>
                    <span className={styles.bannerTitle}>{ev.title}</span>
                    <span className={styles.bannerSub}>
                      {periodText(ev.period)} · {formatDate(ev.approvedAt, true)} 참여 승인
                    </span>
                    <Icon name="paw" size={96} strokeWidth={1.2} className={styles.bannerArt} />
                  </button>
                  <div className={styles.bannerActions}>
                    <button type="button" className={styles.bannerButton} onClick={() => setModal({ kind: 'stats', eventId: ev.id })}>
                      이벤트 통계 보기
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      <section aria-labelledby="ad-title" className={page.stackSm}>
        <h2 id="ad-title" className={styles.h2}>
          광고 · 혜택
        </h2>
        <div className={styles.adGrid}>
          <article className={styles.adCard}>
            <div className={styles.adText}>
              <Tag tone="blue">광고 · 상시 접수</Tag>
              <h3>지도 추천 노출</h3>
              <p>1주 단위로 신청해요. 입장 판정 색상은 광고와 관계없이 그대로예요. 비용 · 결제 · 노출 시작은 정해지면 안내해요.</p>
            </div>
            <Button onClick={() => setModal({ kind: 'applyAd' })}>광고 신청</Button>
          </article>
          <article className={`${styles.adCard} ${styles.disabled}`}>
            <div className={styles.adText}>
              <Tag>제휴 쿠폰 · 준비 중</Tag>
              <h3>스탬프 완주 리워드 쿠폰</h3>
              <p>댕댕로드 완주 보호자에게 쿠폰을 주는 기능은 다음 버전에서 열려요.</p>
            </div>
          </article>
        </div>
      </section>

      <Card title="신청 내역" aside="눌러서 자세히 보기" padding="none">
        <LoadState status={apps.status} errorText={apps.error ?? undefined} onRetry={apps.reload} />
        {apps.status === 'success' &&
          (apps.items.length === 0 ? (
            <p className={styles.empty}>아직 신청한 내역이 없어요.</p>
          ) : (
            <ul className={styles.list}>
              {apps.items.map((a) => (
                <li key={a.id}>
                  <button type="button" className={styles.row} onClick={() => setModal({ kind: 'application', id: a.id, ids: apps.items.filter((x) => x.appKind === a.appKind).map((x) => x.id), appKind: a.appKind })}>
                    <span className={styles.date}>{formatDate(a.submittedAt)}</span>
                    <span className={styles.kind}>
                      <Tag tone="orange">{a.appKind === 'AD' ? '광고' : a.appKind === 'EVENT' ? '이벤트' : '이벤트 · 광고'}</Tag>
                    </span>
                    <span className={styles.title}>{a.summaryText ?? '신청'}</span>
                    <StatusChip status={a.status} />
                    <Icon name="chevronRight" />
                  </button>
                </li>
              ))}
            </ul>
          ))}
        {apps.hasMore && (
          <div className={styles.loadMore}>
            <Button variant="secondary" size="sm" onClick={apps.loadMore} disabled={apps.loadingMore}>
              {apps.loadingMore ? '불러오는 중…' : '더 보기'}
            </Button>
          </div>
        )}
      </Card>

      <PromoModals modal={modal} onChange={setModal} onChanged={reload} />
    </div>
  );
}
