import { useState } from 'react';
import { cancelApplication, getApplication, updateAdPeriod } from '@/api/promo';
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
import { useFetch } from '@/hooks/useFetch';
import type { Application } from '@/types';
import { formatDate } from '@/utils/format';
import { periodText, recruitmentText } from '@/utils/promo';
import styles from './Promo.module.css';

interface Props {
  id: string;
  /** 신청 종류 — 서버 모드에서 상세 · 취소 경로를 고를 때 써요 */
  appKind?: 'EVENT' | 'AD' | null;
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
  // 광고: 결제 · 노출 단계는 후순위 (명세 WAD-7)
  return [
    received,
    shown === 'RECEIVED' || shown === 'IN_REVIEW'
      ? { title: '운영자 검토', meta: '보통 1–2일', state: 'current' }
      : { title: '운영자 검토', meta: shown === 'REJECTED' ? '반려' : '승인', state: shown === 'REJECTED' ? 'danger' : 'done' },
    { title: '승인 · 결제', meta: '결제 안내는 준비 중이에요', state: 'todo' },
    { title: '노출 시작', meta: a.ad ? formatDate(a.ad.startDate, true) : undefined, state: 'todo' },
  ];
}

/** UI-W-017 신청 내역 상세 (F-WAD-06 · 07 · 08) */
export function ApplicationDetailModal({ id, appKind = null, ids, onMove, onClose, onChanged, onOpenStats, onReapplyEvent, onReapplyAd }: Props) {
  const app = useFetch(`application:${appKind ?? '-'}:${id}`, () => getApplication(id, appKind));
  const cancel = useAction(cancelApplication);
  const period = useAction(updateAdPeriod);
  const [editing, setEditing] = useState(false);
  const [start, setStart] = useState('');
  const [weeks, setWeeks] = useState(2);
  const [confirmCancel, setConfirmCancel] = useState(false);

  const a = app.data;
  const pos = ids.indexOf(id);
  const shown = a ? (a.displayStatus ?? a.status) : null;

  const onCancel = async () => {
    if (!(await cancel.run(id, appKind)).ok) return;
    setConfirmCancel(false);
    app.reload();
    onChanged?.();
  };

  const onSavePeriod = async () => {
    if (!(await period.run(id, start, weeks)).ok) return;
    setEditing(false);
    app.reload();
    onChanged?.();
  };

  const step = (delta: number) => onMove(ids[(pos + delta + ids.length) % ids.length]);

  const info = a
    ? a.type === 'AD' && a.ad
      ? [
          { label: '매장', value: a.storeName },
          { label: '노출 지역', value: a.ad.region },
          { label: '기간', value: `${periodText({ startDate: a.ad.startDate, endDate: a.ad.endDate })} (${a.ad.weeks}주)` },
        ]
      : a.stampRoad
        ? [
            { label: '매장', value: a.storeName },
            { label: '분기', value: `${a.stampRoad.periodId} · ${periodText(a.stampRoad.period)}` },
            { label: '신청 기간', value: recruitmentText(a.stampRoad) },
            { label: '한 줄 소개', value: a.stampRoad.intro },
            { label: 'QR 비치 약속', value: a.stampRoad.qrPledgeAgreed ? '동의함' : '—' },
          ]
        : []
    : [];

  return (
    <Modal
      open
      onClose={onClose}
      title={a ? (a.type === 'AD' ? (a.ad?.region ? `지도 추천 노출 · ${a.ad.region}` : '지도 추천 노출') : a.stampRoad?.title || '참여 신청') : '신청 내역'}
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
                  setWeeks(a.ad?.weeks ?? 2);
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
              {shown === 'REJECTED' ? a.rejectReason : '모집이 끝날 때까지 승인되지 않았어요.'}
              {a.type === 'STAMP_ROAD' && (a.canReapply ? ' 모집 기간 안이라 다시 신청할 수 있어요.' : ' 다음 분기 모집 때 다시 신청해 주세요.')}
              {a.type === 'AD' && ' 내용을 고쳐 새로 신청할 수 있어요.'}
            </Notice>
          )}

          {editing && a.type === 'AD' && (
            <section className={styles.editBox}>
              <div className={styles.twoCol}>
                <Field label="새 시작일 (월요일)" htmlFor="ap-new-start">
                  <TextInput id="ap-new-start" type="date" value={start} onChange={(e) => setStart(e.target.value)} />
                </Field>
                <Field label="기간" htmlFor="ap-new-weeks">
                  <Select id="ap-new-weeks" value={weeks} onChange={(e) => setWeeks(Number(e.target.value))}>
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
                <Button size="sm" disabled={!start || new Date(`${start}T00:00:00`).getDay() !== 1 || period.pending} onClick={onSavePeriod}>
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
