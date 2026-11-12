import { USE_MOCK } from '@/api/client';
import { useEffect, useState } from 'react';
import { findDrawRunIdFromEntries, getDrawRun, getStampEntryPage, getStampPeriods, getStampPrizes, startDraw } from '@/api/stampRoad';
import { Button } from '@/components/common/Button';
import { Card } from '@/components/common/Card';
import { Choice } from '@/components/common/Field';
import { Icon } from '@/components/common/Icon';
import { InfoList } from '@/components/common/InfoList';
import { KpiCard } from '@/components/common/KpiCard';
import { LoadState } from '@/components/common/LoadState';
import { Modal } from '@/components/common/Modal';
import { Notice } from '@/components/common/Notice';
import { PageHeader } from '@/components/common/PageHeader';
import { Segmented } from '@/components/common/Segmented';
import { StatGrid } from '@/components/common/StatGrid';
import { Tag, type TagTone } from '@/components/common/Tag';
import { useAction } from '@/hooks/useAction';
import { useCursorList } from '@/hooks/useCursorList';
import { useFetch } from '@/hooks/useFetch';
import page from '@/styles/page.module.css';
import table from '@/styles/table.module.css';
import type { DrawRun, DrawStatus, EntryResult, PeriodPhase, StampEntry, StampPeriod } from '@/types';
import { formatDate, formatDateTime } from '@/utils/format';
import { ContactModal } from './ContactModal';
import styles from './DrawPage.module.css';

const PHASE_LABEL: Record<PeriodPhase, string> = { UPCOMING: '예정', OPEN: '응모 중', CLOSED: '마감' };

type ResultFilter = 'ALL' | EntryResult;
const RESULT_CHIP: Record<EntryResult, { tone: TagTone; label: string }> = {
  PENDING: { tone: 'blue', label: '… 추첨 전' },
  WON: { tone: 'green', label: '✓ 당첨' },
  NOT_WON: { tone: 'gray', label: '– 미당첨' },
};

/** UI-O-012 댕댕로드 추첨 — 분기 기간 · 상품 조회, 추첨 실행, 응모 · 당첨자 목록 (F-ODRAW-01 ~ 04) */
export function DrawPage() {
  const periods = useFetch('stamp-periods', getStampPeriods);
  const [periodId, setPeriodId] = useState<string | null>(null);

  const list = periods.data ?? [];
  const current = list.find((p) => p.periodId === periodId) ?? list[0];

  return (
    <div className={page.stack}>
      <PageHeader title="댕댕로드 추첨" description="분기별 응모를 추첨하고 당첨자 연락을 기록해요. 결과는 발표일에 자동으로 공개돼요." />
      <LoadState status={periods.status} errorText={periods.error?.message} onRetry={periods.reload} />
      {list.length > 0 && (
        <Segmented
          variant="outline"
          label="분기"
          value={current.periodId}
          onChange={setPeriodId}
          options={list.map((p) => ({ value: p.periodId, label: `${p.periodId} · ${PHASE_LABEL[p.phase]}` }))}
        />
      )}
      {current && <PeriodDetail key={current.periodId} period={current} onChanged={periods.reload} />}
    </div>
  );
}

function publishText(p: StampPeriod): string {
  if (p.publishedAt) return `공개됨 · ${formatDateTime(p.publishedAt)}`;
  if (p.drawStatus === 'SUCCEEDED') return '자동 공개 대기';
  if (p.phase === 'CLOSED') return '추첨이 끝나야 공개돼요';
  return '추첨 뒤 발표일에 공개';
}

function PeriodDetail({ period, onChanged }: { period: StampPeriod; onChanged: () => void }) {
  const pid = period.periodId;
  const prizes = useFetch(`stamp-prizes:${pid}`, () => getStampPrizes(pid));
  // 실행 ID: 방금 시작한 실행(응답 · 충돌 응답의 details.drawRunId) 또는 결과가 정해진 분기의 응모 목록에서 찾은 값
  const [startedRunId, setStartedRunId] = useState<string | null>(null);
  const recovered = useFetch(`stamp-run-id:${pid}:${period.drawStatus ?? 'none'}`, () =>
    period.drawStatus === 'SUCCEEDED' ? findDrawRunIdFromEntries(pid) : Promise.resolve(null),
  );
  const runId = startedRunId ?? recovered.data ?? null;
  const run = useFetch(`stamp-run:${pid}:${runId ?? 'none'}`, () => (runId ? getDrawRun(runId) : Promise.resolve(null)));
  const [includeCanceled, setIncludeCanceled] = useState(false);
  const [filter, setFilter] = useState<ResultFilter>('ALL');
  const entries = useCursorList(`stamp-entries:${pid}:${includeCanceled}:${filter}`, (cursor) =>
    getStampEntryPage(pid, { includeCanceled, result: filter === 'ALL' ? undefined : filter, cursor }),
  );
  const [confirm, setConfirm] = useState(false);
  const [contactEntry, setContactEntry] = useState<StampEntry | null>(null);
  const [flash, setFlash] = useState('');
  const draw = useAction(startDraw);

  // 상태는 실행 기록이 있으면 그 값, 없으면 분기 목록(F-ODRAW-01)의 drawStatus
  const status: DrawStatus | null = run.data?.status ?? period.drawStatus;
  const running = status === 'RUNNING';
  const { reload: reloadRun } = run;
  const { reload: reloadEntries } = entries;

  // 추첨 중이면 실행 기록(ID 를 알 때) 또는 분기 목록(모를 때)을 다시 불러와요. 끝나면 목록 · 분기 요약도 새로 불러와요.
  useEffect(() => {
    if (!running) return;
    const t = setInterval(async () => {
      if (!runId) {
        onChanged();
        return;
      }
      const latest = await getDrawRun(runId).catch(() => null);
      if (!latest || latest.status === 'RUNNING') return;
      clearInterval(t);
      reloadRun();
      reloadEntries();
      onChanged();
      if (latest.status === 'SUCCEEDED') setFlash(`${period.name} 추첨을 마쳤어요. 결과는 발표일(${formatDate(period.announceDate)}) 이후 자동으로 공개돼요.`);
    }, runId ? 1000 : 3000);
    return () => clearInterval(t);
  }, [running, runId, reloadRun, reloadEntries, onChanged, period.name, period.announceDate]);

  const prizeCount = prizes.data?.length ?? period.prizeCount;
  // 진행 중 · 정상 완료된 분기는 새로 실행하지 않아요 (분기당 정상 완료 하나 · 재추첨 API 없음). 실패면 다시 시도할 수 있어요.
  const canStartNew = status === null || status === 'FAILED';
  const blockReason =
    status === 'RUNNING'
      ? '추첨이 진행 중이에요'
      : status === 'SUCCEEDED'
        ? '이 분기는 추첨을 마쳤어요. 다시 추첨할 수 없어요'
        : period.phase !== 'CLOSED'
          ? `응모 마감(${formatDateTime(period.entryDeadline)})이 지나야 추첨할 수 있어요`
          : prizeCount === 0
            ? '당첨 상품을 먼저 등록해 주세요'
            : period.entryCount === 0
              ? '추첨할 응모가 없어요'
              : null;

  const published = Boolean(period.publishedAt);
  const unknownRun = status !== null && status !== 'FAILED' && !runId && recovered.status !== 'loading';

  return (
    <>
      {flash && (
        <Notice tone="success" role="status" onClose={() => setFlash('')}>
          {flash}
        </Notice>
      )}

      <StatGrid label="기간 요약">
        <KpiCard label="기간" value={`${formatDate(period.startDate, true)} ~ ${formatDate(period.endDate, true)}`} caption={period.name} />
        <KpiCard
          label="응모 마감"
          value={formatDate(period.entryDeadline)}
          caption={`${formatDateTime(period.entryDeadline).slice(11)} · ${period.phase === 'OPEN' ? '응모 받는 중' : period.phase === 'UPCOMING' ? '시작 전' : '응모 마감됨'}`}
        />
        <KpiCard label="발표일" value={formatDate(period.announceDate)} caption={publishText(period)} />
        <KpiCard label="유효 응모" value={period.entryCount ?? '–'} unit="건" />
        <KpiCard label="당첨 상품" value={prizeCount} unit="종" />
      </StatGrid>

      <div className={page.half}>
        <Card title="추첨" aside={<RunChip status={status} published={published} />}>
          <div className={page.stackSm}>
            <LoadState status={run.status} errorText={run.error?.message} onRetry={run.reload} />
            {unknownRun && (
              <Notice tone="info" role="status">
                {status === 'SUCCEEDED' ? '추첨은 끝났지만' : '추첨이 진행 중이지만'} 실행 기록 ID 를 읽을 방법이 없어 상세를 보여 주지 못해요. (분기 목록 응답에 실행 ID 가 없어요 · 백엔드 확인 중)
              </Notice>
            )}
            {run.status === 'success' && canStartNew && (
              <>
                {run.data?.status === 'FAILED' && (
                  <Notice tone="danger" role="alert">
                    추첨하지 못했어요. 이번 실행은 되돌렸어요. {run.data.failure?.message}
                  </Notice>
                )}
                <div className={styles.runRow}>
                  <Button variant="dark" disabled={Boolean(blockReason) || draw.pending || !canStartNew} onClick={() => setConfirm(true)}>
                    <Icon name="arrowRight" size={18} />
                    추첨 실행
                  </Button>
                  <span className={blockReason ? styles.reasonBlocked : styles.reasonOk}>{blockReason ?? '응모가 마감됐어요. 추첨을 실행할 수 있어요'}</span>
                </div>
              </>
            )}
            {running && runId && (
              <Notice tone="info" role="status">
                추첨하고 있어요. 끝나면 결과가 목록에 바로 반영돼요.
              </Notice>
            )}
            {run.data?.status === 'SUCCEEDED' && <RunResult run={run.data} period={period} />}
            {draw.error && (
              <Notice tone="danger" role="alert">
                {draw.error}
              </Notice>
            )}
          </div>
        </Card>

        <Card title="당첨 상품">
          <LoadState status={prizes.status} />
          {prizes.data && prizes.data.length === 0 && <p className={page.muted}>등록된 상품이 없어요</p>}
          {prizes.data && prizes.data.length > 0 && (
            <ul className={styles.prizes}>
              {prizes.data.map((z) => (
                <li key={z.prizeId}>
                  <span className={styles.prizeIcon} aria-hidden="true">
                    <Icon name="paw" size={20} />
                  </span>
                  <span className={styles.prizeName}>
                    <strong>{z.name}</strong>
                    <span className={page.muted}>{z.brand ?? '제휴사 없음'}</span>
                  </span>
                  <span>{z.quantity === null ? '수량 [미정]' : `${z.quantity}개`}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <Card
        title="응모 · 당첨자"
        padding="none"
        aside={
          <Choice
            type="checkbox"
            // 서버의 CANCELED 는 당첨 취소(CANCEL_WIN)예요
            label={USE_MOCK ? '탈퇴로 취소된 응모 포함' : '당첨 취소된 응모 포함'}
            checked={includeCanceled}
            onChange={(e) => {
              setIncludeCanceled(e.target.checked);
              setFilter('ALL');
            }}
          />
        }
      >
        <div className={styles.filters}>
          <Segmented
            variant="outline"
            label="결과"
            value={filter}
            onChange={setFilter}
            options={[
              { value: 'ALL', label: '전체' },
              { value: 'PENDING', label: '추첨 전' },
              { value: 'WON', label: '당첨' },
              { value: 'NOT_WON', label: '미당첨' },
            ]}
          />
          <span className={page.muted}>
            유효 응모 {period.entryCount ?? '–'}건{run.data?.wonCount !== null && run.data?.wonCount !== undefined ? ` · 당첨 ${run.data.wonCount}건` : ''}
          </span>
        </div>
        <LoadState status={entries.status} errorText={entries.error ?? undefined} onRetry={entries.reload} />
        {entries.status === 'success' &&
          (entries.items.length === 0 ? (
            <p className={styles.empty}>{filter === 'ALL' ? '아직 응모가 없어요' : '해당하는 응모가 없어요'}</p>
          ) : (
            <div className={table.scroll}>
              <table className={`${table.table} ${styles.table}`}>
                <thead>
                  <tr>
                    <th scope="col">응모 ID</th>
                    <th scope="col">응모 시각</th>
                    <th scope="col">연락처</th>
                    <th scope="col">응모 배송지</th>
                    <th scope="col">결과</th>
                    <th scope="col">당첨 상품</th>
                    <th scope="col">당첨 연락</th>
                  </tr>
                </thead>
                <tbody>
                  {entries.items.map((e) => (
                    <tr key={e.entryId}>
                      <td>
                        <strong>{e.entryId}</strong>
                      </td>
                      <td>{e.enteredAt ? formatDateTime(e.enteredAt) : '—'}</td>
                      <td>{e.contactPhoneMasked}</td>
                      <td>{e.hasAddressSnapshot === null ? '—' : e.hasAddressSnapshot ? '있음' : '없음'}</td>
                      <td>
                        {e.canceled ? (
                          <Tag tone="red" shape="pill">
                            {e.canceledKind === 'WIN' ? '× 당첨 취소' : '× 응모 취소'}
                          </Tag>
                        ) : (
                          <Tag tone={RESULT_CHIP[e.result].tone} shape="pill">
                            {RESULT_CHIP[e.result].label}
                          </Tag>
                        )}
                      </td>
                      <td>{e.awardedPrize?.name ?? '—'}</td>
                      <td>
                        {e.result !== 'WON' || e.canceled ? (
                          <span className={table.muted}>—</span>
                        ) : published ? (
                          <Button variant="secondary" size="sm" onClick={() => setContactEntry(e)}>
                            연락 기록
                          </Button>
                        ) : (
                          <span className={table.muted}>결과 공개 뒤 기록할 수 있어요</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        {entries.hasMore && (
          <div className={styles.more}>
            <Button variant="secondary" size="sm" onClick={entries.loadMore} disabled={entries.loadingMore}>
              {entries.loadingMore ? '불러오는 중…' : '더 보기'}
            </Button>
          </div>
        )}
        <p className={styles.foot}>연락처는 가려서 보여 줘요. 전체 번호는 당첨 연락 기록에서만 볼 수 있어요.</p>
      </Card>

      <Modal
        open={confirm}
        onClose={() => setConfirm(false)}
        kicker={`추첨 실행 · ${pid}`}
        title={`${period.name} 추첨을 실행할까요?`}
        width={520}
        footer={
          <div className={page.actions}>
            <Button variant="secondary" onClick={() => setConfirm(false)}>
              취소
            </Button>
            <Button
              variant="dark"
              disabled={draw.pending}
              onClick={async () => {
                if (!canStartNew) return;
                const res = await draw.run(pid);
                setConfirm(false);
                if (!res.ok) return;
                // 실행 응답 또는 충돌 응답(details.drawRunId)의 ID 로 실행 기록을 불러요
                if (res.data === runId) reloadRun();
                else setStartedRunId(res.data);
                // 새 명세에서는 추첨이 바로 끝나서 진행 중 확인을 건너뛰어요. 응모자 표를 바로 다시 불러와요
                entries.reload();
                onChanged();
              }}
            >
              {draw.pending ? '시작하는 중…' : '추첨 실행'}
            </Button>
          </div>
        }
      >
        <Notice tone="warning">
          유효 응모 {period.entryCount}건으로 당첨을 정해요. 정상 완료되면 다시 추첨할 수 없어요. 결과는 발표일({formatDate(period.announceDate)}) 이후 보호자에게 공개돼요.
        </Notice>
      </Modal>

      {contactEntry && <ContactModal periodId={pid} entry={contactEntry} onClose={() => setContactEntry(null)} />}
    </>
  );
}

function RunChip({ status, published }: { status: DrawStatus | null; published: boolean }) {
  if (!status) return <Tag tone="gray" shape="pill">추첨 전</Tag>;
  if (status === 'RUNNING') return <Tag tone="blue" shape="pill">추첨 중</Tag>;
  if (status === 'FAILED') return <Tag tone="red" shape="pill">! 추첨 실패</Tag>;
  return published ? (
    <Tag tone="green" shape="pill">
      ✓ 결과 공개됨
    </Tag>
  ) : (
    <Tag tone="yellow" shape="pill">
      ! 추첨 완료 · 공개 대기
    </Tag>
  );
}

function RunResult({ run, period }: { run: DrawRun; period: StampPeriod }) {
  return (
    <div className={page.stackSm}>
      <div className={styles.runStats}>
        <div>
          <span>추첨 대상</span>
          <strong>{run.eligibleCount ?? '–'}</strong>
        </div>
        <div>
          <span>당첨</span>
          <strong className={styles.won}>{run.wonCount ?? '–'}</strong>
        </div>
        <div>
          <span>미당첨</span>
          <strong>{run.notWonCount ?? '–'}</strong>
        </div>
        <div>
          <span>{run.canceledWinCount != null ? '당첨 취소' : '실행 중 취소'}</span>
          <strong>{run.canceledWinCount ?? run.canceledDuringRunCount ?? '–'}</strong>
        </div>
      </div>
      <InfoList
        labelWidth={90}
        rows={[
          { label: '실행 ID', value: run.drawRunId },
          { label: '실행', value: run.requestedAt ? `${formatDateTime(run.requestedAt)} · ${run.requestedBy.type === 'SYSTEM' ? '자동' : (run.requestedBy.operatorId ?? '운영자')}` : '— (서버 응답에 실행 기록 없음)' },
          { label: '완료', value: run.finishedAt ? formatDateTime(run.finishedAt) : '—' },
          {
            label: '결과 공개',
            value: run.publication.publishedAt
              ? `${formatDateTime(run.publication.publishedAt)} · 발표 알림 ${run.publication.notificationsQueued}건 예약`
              : period.announceDate
                ? `발표일(${formatDate(period.announceDate)}) 이후 자동으로 공개돼요`
                : '— (서버 응답에 결과 공개 정보 없음)',
          },
        ]}
      />
      <p className={page.muted}>정상 완료된 추첨은 분기마다 한 번이고, 다시 추첨할 수 없어요.</p>
    </div>
  );
}
