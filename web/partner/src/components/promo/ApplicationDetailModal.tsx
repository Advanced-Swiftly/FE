import { useState, type MouseEvent } from 'react';
import { fileUrl } from '@/api/files';
import { cancelApplication, getApplication, updateAdPeriod, type ApplicationContext } from '@/api/promo';
import { Button } from '@/components/common/Button';
import { Field, Select, TextInput } from '@/components/common/Field';
import { Icon } from '@/components/common/Icon';
import { InfoList } from '@/components/common/InfoList';
import { LoadState } from '@/components/common/LoadState';
import { Modal } from '@/components/common/Modal';
import { Notice } from '@/components/common/Notice';
import { StatusChip } from '@/components/common/StatusChip';
import { Timeline, type TimelineItem } from '@/components/common/Timeline';
import type { Area } from '@/constants/status';
import { useAction } from '@/hooks/useAction';
import { useCurrentStore } from '@/hooks/useCurrentStore';
import { useFetch } from '@/hooks/useFetch';
import type { Application } from '@/types';
import { formatDate } from '@/utils/format';
import { addDaysISO, adPeriodDays, periodText, recruitmentText } from '@/utils/promo';
import styles from './Promo.module.css';

interface Props {
  id: string;
  /** 신청 종류 — 서버 모드에서 상세 · 취소 경로를 고를 때 써요 */
  appKind?: 'EVENT' | 'AD' | null;
  /** 신청 목록에서 이어받은 이벤트 ID · 매장 ID */
  context?: ApplicationContext;
  /** 이전 · 다음으로 넘겨 볼 신청 번호들 */
  ids: string[];
  onMove: (id: string) => void;
  onClose: () => void;
  onChanged?: () => void;
  onOpenStats: (eventId: string) => void;
  onReapplyEvent: (eventId: string) => void;
  onReapplyAd: (area: Area) => void;
}

function at(iso: string) {
  const d = new Date(iso);
  return `${formatDate(d, true)} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/** 진행 단계 — 참여 신청: 접수 → 검토 중 → 승인 / 반려 · 모집 종료 · 미승인, 광고: 접수 → 운영자 검토 → 승인 · 결제 → 노출 시작 */
function steps(a: Application): TimelineItem[] {
  const when = (s: Application['status']) => a.history.find((h) => h.status === s);
  const shown = a.displayStatus ?? a.status;
  // 접수 시각이 응답에 없으면 비워 둬요
  const received: TimelineItem = { title: '신청 접수', meta: a.submittedAt ? at(a.submittedAt) : undefined, state: 'done' };
  if (shown === 'CANCELED') return [received, { title: '신청 취소', meta: when('CANCELED') && at(when('CANCELED')!.at), state: 'danger' }];
  if (a.type === 'STAMP_ROAD') {
    const review: TimelineItem =
      shown === 'RECEIVED'
        ? { title: '검토 중', meta: '운영자가 검토를 시작하면 표시돼요', state: 'todo' }
        : { title: '검토 중', meta: when('IN_REVIEW') && at(when('IN_REVIEW')!.at), state: shown === 'IN_REVIEW' ? 'current' : 'done' };
    const result: TimelineItem =
      shown === 'APPROVED'
        ? { title: '승인 · 참여 확정', meta: when('APPROVED') && at(when('APPROVED')!.at), state: 'done' }
        : shown === 'REJECTED'
          ? { title: '반려', meta: when('REJECTED') && at(when('REJECTED')!.at), state: 'danger' }
          : shown === 'CLOSED_NOT_APPROVED'
            ? { title: '모집 종료 · 미승인', meta: '모집이 끝날 때까지 승인되지 않았어요', state: 'danger' }
            : { title: '승인 / 반려', state: 'todo' };
    return [received, review, result];
  }
  // 광고: BE 상태(접수 · 검토 · 승인 · 반려)만 보여 줘요
  return [
    received,
    { title: '운영자 검토', state: shown === 'APPROVED' || shown === 'REJECTED' ? 'done' : 'current' },
    shown === 'APPROVED' ? { title: '승인', state: 'done' } : shown === 'REJECTED' ? { title: '반려', state: 'danger' } : { title: '승인 / 반려', state: 'todo' },
  ];
}

/** 광고 소재 — 누를 때 임시 열람 주소를 받아 새 탭으로 열어요 */
function CreativeLink({ url }: { url: string }) {
  const [failed, setFailed] = useState(false);
  const open = async (e: MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();
    setFailed(false);
    // 주소를 기다린 뒤에 열면 브라우저가 팝업으로 막아서, 누른 순간 탭을 먼저 열어요
    const tab = window.open('', '_blank');
    if (!tab) {
      setFailed(true);
      return;
    }
    tab.opener = null;
    try {
      tab.location.href = await fileUrl(url);
    } catch {
      tab.close();
      setFailed(true);
    }
  };
  return (
    <>
      <a href={url} target="_blank" rel="noopener noreferrer" onClick={open}>
        소재 열기
      </a>
      {failed && <span role="alert"> · 소재를 열지 못했어요. 다시 시도해 주세요.</span>}
    </>
  );
}

/** UI-W-017 신청 내역 상세 (F-WAD-06 · 07 · 08) */
export function ApplicationDetailModal({ id, appKind = null, context, ids, onMove, onClose, onChanged, onOpenStats, onReapplyEvent, onReapplyAd }: Props) {
  const { store: current, stores } = useCurrentStore();
  // 목록에서 연 신청은 그 줄의 매장 ID 를 쓰고, 이벤트 화면에서 연 신청만 지금 보고 있는 매장 기준이에요
  const contextStoreId = context?.storeId ?? current.id;
  const app = useFetch(`application:${appKind ?? '-'}:${id}:${context?.eventId ?? ''}:${contextStoreId}`, () => getApplication(id, appKind, { eventId: context?.eventId, storeId: contextStoreId }));
  const cancel = useAction(cancelApplication);
  const period = useAction(updateAdPeriod);
  const [editing, setEditing] = useState(false);
  const [start, setStart] = useState('');
  /** null: 주 단위가 아닌 지금 기간을 그대로 유지 */
  const [weeks, setWeeks] = useState<number | null>(2);
  const [confirmCancel, setConfirmCancel] = useState(false);
  // 오늘 0시 (팝업을 연 시점 기준)
  const [today] = useState(() => new Date(new Date().toDateString()).getTime());

  const a = app.data;
  const pos = ids.indexOf(id);
  const shown = a ? (a.displayStatus ?? a.status) : null;

  const onCancel = async () => {
    if (!(await cancel.run(id, appKind)).ok) return;
    setConfirmCancel(false);
    app.reload();
    onChanged?.();
  };

  const adPeriod = a?.ad ?? null;
  const currentDays = adPeriod ? adPeriodDays(adPeriod.startDate, adPeriod.endDate) : 0;
  const startChanged = Boolean(adPeriod && start && start !== adPeriod.startDate);
  const weeksChanged = Boolean(adPeriod && weeks !== null && weeks !== adPeriod.weeks);
  const startDay = new Date(`${start}T00:00:00`);
  const startError = !startChanged ? null : startDay.getDay() !== 1 ? '월요일을 골라 주세요' : startDay.getTime() < today ? '지난 날짜는 고를 수 없어요' : null;
  const canSavePeriod = (startChanged || weeksChanged) && !startError && !period.pending;
  const nextDays = weeksChanged && weeks !== null ? weeks * 7 : currentDays;

  const onSavePeriod = async () => {
    if (!canSavePeriod) return;
    // 바뀐 값만 보내요. 시작일만 바꾸면 서버가 기존 일수를 그대로 유지해요
    const change = { ...(startChanged ? { startDate: start } : {}), ...(weeksChanged && weeks !== null ? { weeks } : {}) };
    if (!(await period.run(id, change)).ok) return;
    setEditing(false);
    app.reload();
    onChanged?.();
  };

  const step = (delta: number) => onMove(ids[(pos + delta + ids.length) % ids.length]);

  // 응답에 매장명이 없으면 신청의 매장 ID 로 내 매장 목록에서 찾아요 (지금 고른 매장 이름을 대신 쓰지 않아요)
  const storeName = a ? a.storeName || stores.find((s) => s.id === a.storeId)?.name || '—' : '—';
  const info = a
    ? a.type === 'AD' && a.ad
      ? [
          { label: '매장', value: storeName },
          ...(a.adType ? [{ label: '광고 종류', value: a.adType === 'BANNER' ? '배너' : '지도 추천 노출' }] : []),
          ...(a.ad.region ? [{ label: '노출 지역', value: a.ad.region }] : []),
          { label: '기간', value: `${periodText({ startDate: a.ad.startDate, endDate: a.ad.endDate })} (${a.ad.weeks ? `${a.ad.weeks}주` : `${currentDays}일`})` },
          ...(a.creativeUrl && /^https?:\/\//.test(a.creativeUrl)
            ? [{ label: '광고 소재', value: <CreativeLink url={a.creativeUrl} /> }]
            : []),
          ...(a.message ? [{ label: '전달사항', value: a.message }] : []),
        ]
      : a.stampRoad
        ? [
            { label: '매장', value: storeName },
            ...(a.stampRoad.periodId ? [{ label: '분기', value: `${a.stampRoad.periodId} · ${periodText(a.stampRoad.period)}` }] : []),
            ...(a.stampRoad.recruitment.startAt ? [{ label: '신청 기간', value: recruitmentText(a.stampRoad) }] : []),
            ...(a.stampRoad.intro ? [{ label: '전달사항', value: a.stampRoad.intro }] : []),
          ]
        : []
    : [];

  return (
    <Modal
      open
      onClose={onClose}
      title={a ? (a.type === 'AD' ? (a.ad?.region ? `지도 추천 노출 · ${a.ad.region}` : a.adType === 'BANNER' ? '배너 광고' : '지도 추천 노출') : a.stampRoad?.title || '참여 신청') : '신청 내역'}
      kicker={a ? `${a.type === 'AD' ? '광고' : '댕댕로드 참여'} · ${a.id}${a.submittedAt ? ` · ${formatDate(a.submittedAt)} 신청` : ''}` : undefined}
      titleAside={shown && <StatusChip status={shown} label={shown === 'APPROVED' && a?.type === 'STAMP_ROAD' ? '승인 · 참여 중' : undefined} />}
      footer={
        <div className={styles.footerBetween}>
          {ids.length > 1 ? (
            <div className={styles.pager}>
              <button type="button" aria-label="이전 신청" onClick={() => step(-1)}>
                <Icon name="chevronLeft" />
              </button>
              <span>
                {pos + 1} / {ids.length}
              </span>
              <button type="button" aria-label="다음 신청" onClick={() => step(1)}>
                <Icon name="chevronRight" />
              </button>
            </div>
          ) : (
            <span />
          )}
          <div className={styles.footerButtons}>
            {a?.canCancel && !confirmCancel && (
              <Button variant="danger" onClick={() => setConfirmCancel(true)}>
                신청 취소
              </Button>
            )}
            {a?.canEditPeriod && a.type === 'AD' && !confirmCancel && (
              <Button
                variant="secondary"
                onClick={() => {
                  setStart(a.ad?.startDate ?? '');
                  setWeeks(a.ad?.weeks && a.ad.weeks <= 4 ? a.ad.weeks : null);
                  setEditing((v) => !v);
                }}
              >
                기간 수정
              </Button>
            )}
            {confirmCancel && (
              <>
                <span className={styles.confirmText}>정말 취소할까요?</span>
                <Button variant="dangerSolid" disabled={cancel.pending} onClick={onCancel}>
                  신청 취소하기
                </Button>
                <Button variant="secondary" onClick={() => setConfirmCancel(false)}>
                  아니요
                </Button>
              </>
            )}
            {a?.type === 'STAMP_ROAD' && shown === 'APPROVED' && a.stampRoad && <Button onClick={() => onOpenStats(a.stampRoad!.eventId)}>이벤트 통계 보기</Button>}
            {a?.type === 'STAMP_ROAD' && a.canReapply && a.stampRoad && <Button onClick={() => onReapplyEvent(a.stampRoad!.eventId)}>다시 신청</Button>}
            {a?.type === 'AD' && shown === 'REJECTED' && <Button onClick={() => onReapplyAd(a.ad!.region)}>다시 신청</Button>}
            <Button variant="dark" onClick={onClose}>
              닫기
            </Button>
          </div>
        </div>
      }
    >
      <LoadState status={app.status} />
      {a && (
        <>
          {(shown === 'REJECTED' || shown === 'CLOSED_NOT_APPROVED') && (
            <Notice tone="danger">
              <strong>{shown === 'REJECTED' ? '반려 사유' : '모집 종료 · 미승인'}</strong>
              <br />
              {shown === 'REJECTED' ? (a.rejectReason ?? '반려 사유를 불러오지 못했어요. 문의하기로 확인해 주세요.') : '모집이 끝날 때까지 승인되지 않았어요.'}
              {a.type === 'STAMP_ROAD' && (a.canReapply ? ' 모집 기간 안이라 다시 신청할 수 있어요.' : ' 다음 분기 모집 때 다시 신청해 주세요.')}
              {a.type === 'AD' && ' 내용을 고쳐 새로 신청할 수 있어요.'}
            </Notice>
          )}

          {editing && a.type === 'AD' && (
            <section className={styles.editBox}>
              <div className={styles.twoCol}>
                <Field label="새 시작일 (월요일)" htmlFor="ap-new-start" message={startError ? { tone: 'error', text: startError } : null}>
                  <TextInput id="ap-new-start" type="date" value={start} onChange={(e) => setStart(e.target.value)} />
                </Field>
                <Field label="기간" htmlFor="ap-new-weeks" hint={start ? `종료일 ${addDaysISO(start, nextDays - 1)} (시작일 · 종료일 포함 ${nextDays}일)` : undefined}>
                  <Select id="ap-new-weeks" value={weeks ?? ''} onChange={(e) => setWeeks(e.target.value ? Number(e.target.value) : null)}>
                    {(!a.ad?.weeks || a.ad.weeks > 4) && <option value="">지금 기간 유지 ({currentDays}일)</option>}
                    {[1, 2, 3, 4].map((w) => (
                      <option key={w} value={w}>
                        {w}주
                      </option>
                    ))}
                  </Select>
                </Field>
              </div>
              <div className={styles.footerButtons}>
                <Button variant="secondary" size="sm" onClick={() => setEditing(false)}>
                  그만두기
                </Button>
                <Button size="sm" disabled={!canSavePeriod} onClick={onSavePeriod}>
                  기간 저장
                </Button>
              </div>
            </section>
          )}

          <section className={styles.section}>
            <h3 className={styles.h}>진행 단계</h3>
            <Timeline items={steps(a)} />
          </section>

          <section className={styles.section}>
            <h3 className={styles.h}>신청 정보</h3>
            <InfoList labelWidth={96} rows={info} />
          </section>

          {a.canCancel && <Notice>운영자 검토가 시작되기 전까지 {a.type === 'AD' ? '기간을 바꾸거나 ' : ''}신청을 취소할 수 있어요.</Notice>}
          {(cancel.error || period.error) && (
            <Notice tone="danger" role="alert">
              {cancel.error ?? period.error}
            </Notice>
          )}
        </>
      )}
    </Modal>
  );
}
