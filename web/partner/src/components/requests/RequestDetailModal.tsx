import { getBreedNames, getStorePolicy } from '@/api/policy';
import { ConditionChanges, PolicyRulesView } from '@/components/policy/PolicyRules';
import { useState } from 'react';
import { cancelRequest, getRequestDetail } from '@/api/requests';
import { Button, ButtonLink } from '@/components/common/Button';
import { Icon } from '@/components/common/Icon';
import { LoadState } from '@/components/common/LoadState';
import { Modal } from '@/components/common/Modal';
import { Notice } from '@/components/common/Notice';
import { StatusChip } from '@/components/common/StatusChip';
import { Timeline, type TimelineItem } from '@/components/common/Timeline';
import { useAction } from '@/hooks/useAction';
import { useFetch } from '@/hooks/useFetch';
import type { ConditionRequestDetail } from '@/types';
import { CONDITION_LABEL, describeValue } from '@/utils/conditions';
import { formatDate } from '@/utils/format';
import styles from './RequestDetailModal.module.css';

interface RequestDetailModalProps {
  /** 열 요청 번호 (null 이면 닫힘) */
  requestId: string | null;
  onClose: () => void;
  /** 취소 등으로 목록을 다시 불러와야 할 때 */
  onChanged?: () => void;
}

function time(iso: string) {
  const d = new Date(iso);
  return `${formatDate(d, true)} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/** 처리 단계: 접수 → 검토 시작 → 반영 (반려 · 취소 · 보완 요청 표시) — 명세 UI-W-010 ④ */
function steps(d: ConditionRequestDetail): TimelineItem[] {
  const at = (action: string) => d.history.filter((h) => h.action === action).pop();
  const submit = at('RESUBMIT') ?? at('SUBMIT');
  const review = at('START_REVIEW');
  // 서버 상세에는 단계별 이력이 없어서 접수 시각과 마지막 처리 시각을 써요
  const receivedAt = submit?.at ?? d.submittedAt;
  const reviewedAt = d.reviewedAt ? time(d.reviewedAt) : undefined;
  const items: TimelineItem[] = [{ title: at('RESUBMIT') ? '보완 제출 · 접수' : '요청 접수', meta: receivedAt ? time(receivedAt) : undefined, state: 'done' }];
  switch (d.status) {
    case 'RECEIVED':
      return [...items, { title: '검토 시작', meta: '운영자가 확인을 시작하면 표시돼요', state: 'current' }, { title: '반영 · 확인일 갱신', state: 'todo' }];
    case 'IN_REVIEW':
      return [...items, { title: '검토 중', meta: review ? time(review.at) : reviewedAt, state: 'current' }, { title: '반영 · 확인일 갱신', meta: '승인되면 보호자 화면에 바로 반영', state: 'todo' }];
    case 'NEEDS_INFO':
      return [...items, { title: '검토 시작', meta: review && time(review.at), state: 'done' }, { title: '보완 요청', meta: reviewedAt ? `${reviewedAt} · 아래 사유를 보고 보완해 주세요` : '아래 사유를 보고 보완해 주세요', state: 'current' }];
    case 'APPROVED':
      return [...items, { title: '검토 시작', meta: review && time(review.at), state: 'done' }, { title: '반영 · 확인일 갱신', meta: at('APPROVE') ? time(at('APPROVE')!.at) : reviewedAt, state: 'done' }];
    case 'REJECTED':
      return [...items, { title: '검토 시작', meta: review && time(review.at), state: 'done' }, { title: '반려', meta: at('REJECT') ? time(at('REJECT')!.at) : reviewedAt, state: 'danger' }];
    case 'CANCELED':
      return [...items, { title: '요청 취소', meta: at('CANCEL') && time(at('CANCEL')!.at), state: 'danger' }];
    default:
      return items;
  }
}

/** UI-W-010 입장 조건 변경 요청 상세 팝업 (F-WREQ-04 · 05) */
export function RequestDetailModal({ requestId, onClose, onChanged }: RequestDetailModalProps) {
  return requestId ? <RequestDetailBody key={requestId} requestId={requestId} onClose={onClose} onChanged={onChanged} /> : null;
}

function RequestDetailBody({ requestId, onClose, onChanged }: { requestId: string; onClose: () => void; onChanged?: () => void }) {
  const detail = useFetch(`request:${requestId}`, () => getRequestDetail(requestId));
  const cancel = useAction(cancelRequest);
  const [confirming, setConfirming] = useState(false);

  const d = detail.data;
  // 서버에 요청 당시 조건 기록이 없어, 진행 중이고 기준 버전이 지금 정책과 같을 때만 변경 전후를 비교해요
  const inProgress = d ? ['RECEIVED', 'IN_REVIEW', 'NEEDS_INFO'].includes(d.status) : false;
  const canCompare = Boolean(d?.requestedPolicy && d.storeId && inProgress);
  const base = useFetch(`request-base:${requestId}:${d?.storeId ?? ''}:${canCompare}`, () => (canCompare && d ? getStorePolicy(d.storeId) : Promise.resolve(null)));
  const basePolicy = base.data && d?.baseVersion === base.data.version ? base.data : null;
  const breeds = useFetch(`request-breeds:${Boolean(d?.requestedPolicy)}`, () => (d?.requestedPolicy ? getBreedNames() : Promise.resolve(new Map<string, string>())));
  const changeReason = d?.requestedPolicy?.conditions?.changeReason?.trim();
  const title = d ? (d.requestedPolicy ? '입장 조건 변경 요청' : d.changes.length === 1 ? `${CONDITION_LABEL[d.changes[0].field]} 변경` : `입장 조건 ${d.changes.length}개 항목 변경`) : '요청 상세';

  const onCancel = async () => {
    if (!(await cancel.run(requestId)).ok) return;
    onChanged?.();
    onClose();
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={title}
      kicker={d ? `요청 상세 · ${d.id} · ${d.submittedAt ? formatDate(d.submittedAt) : '–'} 접수` : undefined}
      titleAside={d && <StatusChip status={d.status} />}
      footer={
        <div className={styles.footer}>
          {d?.canCancel &&
            (confirming ? (
              <span className={styles.confirm}>
                정말 취소할까요?
                <Button variant="danger" size="sm" disabled={cancel.pending} onClick={onCancel}>
                  요청 취소하기
                </Button>
                <Button variant="secondary" size="sm" onClick={() => setConfirming(false)}>
                  아니요
                </Button>
              </span>
            ) : (
              <button type="button" className={styles.cancel} onClick={() => setConfirming(true)}>
                요청 취소
              </button>
            ))}
          <span className={styles.grow} />
          {d?.canResubmit && (
            <ButtonLink to={`/conditions/edit?request=${d.id}`} variant="primary">
              보완하기
            </ButtonLink>
          )}
          <Button variant="dark" onClick={onClose}>
            닫기
          </Button>
        </div>
      }
    >
      <LoadState status={detail.status} />
      {d && (
        <>
          {(d.status === 'NEEDS_INFO' || d.status === 'REJECTED') && d.reason && (
            <Notice tone={d.status === 'REJECTED' ? 'danger' : 'warning'} role="note">
              <strong>보완 · 반려 사유</strong>
              <br />
              {d.reason}
            </Notice>
          )}
          {d.baseChanged && d.status === 'NEEDS_INFO' && <Notice tone="info">요청한 뒤 확정 조건이 바뀌었어요. 보완할 때 최신 조건과 비교해 주세요.</Notice>}

          <section className={styles.section} aria-labelledby="rq-content">
            <h3 id="rq-content" className={styles.h}>
              요청 내용
            </h3>
            {d.requestedPolicy && basePolicy && <ConditionChanges before={basePolicy.conditions} after={d.requestedPolicy.conditions} />}
            {d.requestedPolicy && !basePolicy && base.status !== 'loading' && <p className={styles.muted}>요청 당시 조건 기록이 없어 요청한 내용만 보여 드려요.</p>}
            {d.requestedPolicy && <PolicyRulesView rules={d.requestedPolicy} compareTo={basePolicy ?? undefined} breeds={breeds.data ?? new Map()} />}
            {changeReason && (
              <p className={styles.sourceText}>
                <strong>변경 사유</strong>
                <br />
                {changeReason}
              </p>
            )}
            {d.sourceText?.trim() && (
              <p className={styles.sourceText}>
                <strong>정책 원문</strong>
                <br />
                {d.sourceText}
              </p>
            )}
            {d.requestNote?.effectiveFrom && (
              <p className={styles.sourceText}>
                <strong>적용 시작일</strong>
                <br />
                {d.requestNote.effectiveFrom}
              </p>
            )}
            {d.requestNote?.notice && (
              <p className={styles.sourceText}>
                <strong>공지 문장</strong>
                <br />
                {d.requestNote.notice}
              </p>
            )}
            {d.requestNote?.changeReason && (
              <p className={styles.sourceText}>
                <strong>변경 사유</strong>
                <br />
                {d.requestNote.changeReason}
              </p>
            )}
            {d.changes.map((ch) => (
              <div key={ch.field} className={styles.changeRow}>
                <span className={styles.changeLabel}>{CONDITION_LABEL[ch.field]}</span>
                <div className={styles.compare}>
                  <div className={styles.before}>
                    <span>요청할 때</span>
                    <strong>{describeValue(ch.field, ch.currentValue, ch.currentUnrestricted)}</strong>
                  </div>
                  <Icon name="arrowRight" size={16} />
                  <div className={styles.after}>
                    <span>요청</span>
                    <strong>{describeValue(ch.field, ch.requestedValue, ch.requestedUnrestricted)}</strong>
                  </div>
                </div>
                {d.baseChanged && (ch.latestValue !== ch.currentValue || ch.latestUnrestricted !== ch.currentUnrestricted) && (
                  <span className={styles.latest}>지금 확정 조건: {describeValue(ch.field, ch.latestValue, ch.latestUnrestricted)}</span>
                )}
              </div>
            ))}
          </section>

          <section className={styles.section} aria-labelledby="rq-files">
            <h3 id="rq-files" className={styles.h}>
              첨부한 근거
            </h3>
            {d.evidences.length === 0 ? (
              <p className={styles.muted}>첨부한 근거가 없어요.</p>
            ) : (
              <div className={styles.files}>
                {d.evidences.map((a, i) =>
                  a.href ? (
                    <a key={`${a.href}:${i}`} href={a.href} target="_blank" rel="noopener noreferrer" className={styles.file}>
                      <Icon name={a.kind === 'link' ? 'link' : 'image'} size={16} />
                      {a.name}
                    </a>
                  ) : (
                    <span key={`${a.name}:${i}`} className={styles.file}>
                      <Icon name="image" size={16} />
                      {a.name}
                    </span>
                  ),
                )}
              </div>
            )}
          </section>

          <section className={styles.section} aria-labelledby="rq-steps">
            <h3 id="rq-steps" className={styles.h}>
              처리 단계
            </h3>
            <Timeline items={steps(d)} />
          </section>
          {cancel.error && <Notice tone="danger" role="alert">{cancel.error}</Notice>}
        </>
      )}
    </Modal>
  );
}
