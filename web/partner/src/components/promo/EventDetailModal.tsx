import { getEvent } from '@/api/promo';
import { Button } from '@/components/common/Button';
import { Icon } from '@/components/common/Icon';
import { LoadState } from '@/components/common/LoadState';
import { Modal } from '@/components/common/Modal';
import { Notice } from '@/components/common/Notice';
import { StatusChip } from '@/components/common/StatusChip';
import { Tag } from '@/components/common/Tag';
import { useCurrentStore } from '@/hooks/useCurrentStore';
import { useFetch } from '@/hooks/useFetch';
import { BLOCKED_LABEL, ELIGIBILITY_LABEL, PHASE_LABEL, periodText, recruitmentText } from '@/utils/promo';
import styles from './Promo.module.css';

interface Props {
  eventId: string;
  onClose: () => void;
  onApply: () => void;
  onStats: () => void;
  onApplication: (id: string) => void;
}

/** UI-W-014 이벤트 상세 (F-WAD-02) */
export function EventDetailModal({ eventId, onClose, onApply, onStats, onApplication }: Props) {
  const { store } = useCurrentStore();
  const ev = useFetch(`event:${eventId}:${store.id}`, () => getEvent(eventId, store.id));
  const e = ev.data;

  return (
    <Modal
      open
      onClose={onClose}
      title={e?.title ?? '댕댕로드'}
      kicker={e ? `지역 이벤트 · 댕댕로드 · ${e.periodId}` : undefined}
      titleAside={
        e && (
          <Tag tone={e.phase === 'RECRUITING' ? 'blue' : e.phase === 'IN_PROGRESS' ? 'orange' : 'gray'} shape="pill">
            {e.participation && e.phase === 'IN_PROGRESS' ? '참여 중' : PHASE_LABEL[e.phase]}
          </Tag>
        )
      }
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            닫기
          </Button>
          {e?.participation ? (
            <Button onClick={onStats}>이벤트 통계 보기</Button>
          ) : e?.myApplication ? (
            <Button onClick={() => onApplication(e.myApplication!.applicationId)}>내 신청 보기</Button>
          ) : (
            e?.phase !== 'ENDED' && (
              <Button onClick={onApply} disabled={!e?.canApply}>
                참여 신청
              </Button>
            )
          )}
        </>
      }
    >
      <LoadState status={ev.status} />
      {e && (
        <>
          {e.description && <p className={styles.lead}>{e.description}</p>}
          <div className={styles.facts}>
            <div>
              <span>운영 기간</span>
              <strong>{periodText(e.period)}</strong>
            </div>
            <div>
              <span>참여 신청 기간</span>
              <strong>{recruitmentText(e)}</strong>
            </div>
            <div>
              <span>대상 지역</span>
              <strong>{e.regions.join(' · ')}</strong>
            </div>
          </div>
          <section className={styles.section}>
            <h3 className={styles.h}>참여 조건</h3>
            <ul className={styles.checks}>
              {e.conditions.map((c) => (
                <li key={c}>
                  <Icon name="check" size={16} />
                  {c === 'REGION' ? `${ELIGIBILITY_LABEL.REGION} (${e.regions.join(' · ')})` : ELIGIBILITY_LABEL[c]}
                </li>
              ))}
            </ul>
            <p className={styles.muted}>경쟁 선발 · 정원은 없어요. 신청하면 운영자가 조건을 다시 확인하고 승인해요.</p>
          </section>
          {e.myApplication && (
            <div className={styles.rowBetween}>
              <span className={styles.muted}>이 매장의 신청</span>
              <StatusChip status={e.myApplication.displayStatus} />
            </div>
          )}
          {!e.canApply && e.applyBlockedReason && !e.participation && e.phase !== 'ENDED' && (
            <Notice tone="info">{BLOCKED_LABEL[e.applyBlockedReason]}</Notice>
          )}
          <p className={styles.muted}>보호자는 참여 여부와 관계없이 유효한 PawFit 매장 QR로 스탬프를 모아요. 참여 매장은 이벤트 통계를 볼 수 있어요.</p>
        </>
      )}
    </Modal>
  );
}
