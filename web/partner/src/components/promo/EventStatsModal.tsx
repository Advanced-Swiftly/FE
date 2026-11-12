import { useState } from 'react';
import { getEventStats } from '@/api/promo';
import { Button, ButtonLink } from '@/components/common/Button';
import { KpiCard } from '@/components/common/KpiCard';
import { LoadState } from '@/components/common/LoadState';
import { Modal } from '@/components/common/Modal';
import { Segmented } from '@/components/common/Segmented';
import { Tag } from '@/components/common/Tag';
import { useCurrentStore } from '@/hooks/useCurrentStore';
import { useFetch } from '@/hooks/useFetch';
import table from '@/styles/table.module.css';
import { formatDate } from '@/utils/format';
import styles from './Promo.module.css';

const STATE_LABEL = { CLOSED: '마감', IN_PROGRESS: '집계 중', SCHEDULED: '예정' } as const;
const monthLabel = (m: string) => `${Number(m.slice(5))}월`;

/** UI-W-018 이벤트 통계 (F-WAD-09) — 달 선택 + 그 달 스탬프 · 여기서 완주, 분기 세 달 월별 표 */
export function EventStatsModal({ eventId, onClose }: { eventId: string; onClose: () => void }) {
  const { store } = useCurrentStore();
  // 처음엔 month 없이 불러 서버 기본 월(selectedMonth)을 쓰고, 달을 바꾸면 month 를 보내 다시 불러요 (F-WAD-09)
  const [month, setMonth] = useState<string | undefined>(undefined);
  const stats = useFetch(`event-stats:${eventId}:${store.id}:${month ?? 'default'}`, () => getEventStats(eventId, store.id, month));
  const s = stats.data;
  const selected = s?.months.find((m) => m.month === s.selectedMonth);

  return (
    <Modal
      open
      onClose={onClose}
      width={680}
      title={s?.periodId ? `${s.periodId} 댕댕로드 이벤트 통계` : '댕댕로드 이벤트 통계'}
      kicker={s ? `이벤트 통계 · ${store.name}${s.periodId ? ` · ${s.periodId}` : ''}` : undefined}
      footer={
        <>
          <ButtonLink to="/stats" variant="secondary" onClick={onClose}>
            QR 인증 통계
          </ButtonLink>
          <Button variant="dark" onClick={onClose}>
            닫기
          </Button>
        </>
      }
    >
      <LoadState status={stats.status} errorText={stats.error?.message ?? '이 분기에 참여한 매장만 이벤트 통계를 볼 수 있어요.'} onRetry={stats.reload} />
      {s?.totals && (
        <div className={styles.kpis}>
          <KpiCard label="QR 인증 방문" value={s.totals.visits ?? '—'} unit="건" caption="이 이벤트 기간 이 매장 방문" />
          <KpiCard label="스탬프 적립" value={s.totals.stampAwards ?? '—'} unit="개" caption="이 매장 QR 인증으로 쌓인 스탬프" />
          <KpiCard label="응모 전환" value={s.totals.drawConversions ?? '—'} unit="건" caption="스탬프를 모아 응모까지 이어진 수" />
        </div>
      )}
      {s && !s.totals && s.months.length === 0 && <p className={styles.muted}>아직 집계된 달이 없어요.</p>}
      {s && selected && (
        <>
          <Segmented
            label="달 선택"
            value={selected.month}
            onChange={(v) => {
              if (s.months.find((m) => m.month === v)?.state !== 'SCHEDULED') setMonth(v);
            }}
            options={s.months.map((m) => ({ value: m.month, label: `${monthLabel(m.month)}${m.state === 'SCHEDULED' ? ' · 예정' : ''}` }))}
          />
          <div className={styles.kpis}>
            <KpiCard label={`${monthLabel(selected.month)} 스탬프 적립`} value={selected.stampCount ?? '—'} unit="개" caption="이 매장 QR 인증으로 쌓인 스탬프" />
            <KpiCard label="여기서 완주" value={selected.completionCount ?? '—'} unit="명" caption="10번째 스탬프를 이 매장에서" />
          </div>
          {selected.aggregatedUntil && (
            <p className={styles.muted}>
              {formatDate(selected.aggregatedUntil)} {selected.state === 'IN_PROGRESS' ? '현재까지 집계했어요' : '까지 집계한 값이에요'}
            </p>
          )}
          <section className={styles.section}>
            <h3 className={styles.h}>분기 월별</h3>
            <table className={`${table.table} ${table.compact}`}>
              <thead>
                <tr>
                  <th scope="col">달</th>
                  <th scope="col">상태</th>
                  <th scope="col" className={table.right}>
                    스탬프
                  </th>
                  <th scope="col" className={table.right}>
                    여기서 완주
                  </th>
                </tr>
              </thead>
              <tbody>
                {s.months.map((m) => (
                  <tr key={m.month}>
                    <td>{monthLabel(m.month)}</td>
                    <td>
                      <Tag tone={m.state === 'IN_PROGRESS' ? 'blue' : 'gray'}>{STATE_LABEL[m.state]}</Tag>
                    </td>
                    <td className={table.right}>{m.stampCount ?? '—'}</td>
                    <td className={table.right}>{m.completionCount ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
          <p className={styles.muted}>PawFit QR 인증 기준이에요. 운영 기간은 분기이고 조회만 월 단위예요. 일별 · 시간대별 방문은 QR 인증 통계에서 볼 수 있어요.</p>
        </>
      )}
    </Modal>
  );
}
