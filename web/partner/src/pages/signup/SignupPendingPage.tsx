import { useEffect, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { getVerifications } from '@/api/account';
import { updateSession } from '@/api/session';
import { USE_MOCK } from '@/api/client';
import { ButtonLink } from '@/components/common/Button';
import { Card } from '@/components/common/Card';
import { Icon, type IconName } from '@/components/common/Icon';
import { InfoList } from '@/components/common/InfoList';
import { LoadState } from '@/components/common/LoadState';
import { Notice } from '@/components/common/Notice';
import { Segmented } from '@/components/common/Segmented';
import { StatusChip } from '@/components/common/StatusChip';
import { useFetch } from '@/hooks/useFetch';
import { formatDateTime } from '@/utils/format';
import type { SignupStatus } from '@/types';
import { SignupSteps } from './SignupSteps';
import styles from './Signup.module.css';

type VerifyStatus = 'RECEIVED' | 'IN_REVIEW' | 'NEEDS_INFO' | 'APPROVED' | 'REJECTED';

/** 업체 인증 상태 5가지 (명세 5.3절) — 화면 글자 · 아이콘 */
const VIEW: Record<VerifyStatus, { title: string; text: string; icon: IconName; chip: string }> = {
  RECEIVED: {
    title: '업체 인증 요청을 받았어요',
    // 서버에는 접수 상태 수정 API 가 없어요 (보완 요청을 받으면 다시 제출할 수 있어요)
    text: USE_MOCK ? '운영자가 확인을 시작하기 전까지는 제출한 내용을 고칠 수 있어요. 보통 1–2일 안에 확인이 끝나요.' : '운영자가 확인하고 있어요. 보완이 필요하면 이 화면에 사유가 표시되고 다시 제출할 수 있어요.',
    icon: 'clock',
    chip: '접수',
  },
  IN_REVIEW: {
    title: '운영자가 업체 정보를 확인하고 있어요',
    text: '보통 1–2일 안에 끝나요. 승인되면 바로 입장 조건과 매장 QR을 관리할 수 있어요.',
    icon: 'clock',
    chip: '확인 중',
  },
  NEEDS_INFO: {
    title: '업체 정보를 조금 보완해 주세요',
    text: '아래 사유를 보고 [보완하기]로 다시 제출해 주세요. 다시 제출하면 접수 상태로 돌아가요.',
    icon: 'warning',
    chip: '보완 요청',
  },
  APPROVED: {
    title: '업체 인증이 끝났어요',
    text: '이제 업체 센터를 쓸 수 있어요.',
    icon: 'check',
    chip: '승인',
  },
  REJECTED: {
    title: '업체 인증이 반려됐어요',
    text: '사유를 확인한 뒤 [다시 신청하기]로 새로 신청할 수 있어요.',
    icon: 'close',
    chip: '반려',
  },
};

/** UI-W-004 운영자 승인 대기 (F-WAUTH-11) */
export function SignupPendingPage() {
  // F-WAUTH-11 은 최근 제출 순 목록이에요. 화면은 가장 최근 요청을 보여 주고, 버튼은 그 요청의 ID 와 서버 플래그로 열어요.
  const list = useFetch('verifications', getVerifications);
  const status = { ...list, data: list.data ? (list.data[0] ?? null) : null };
  const others = list.data?.slice(1) ?? [];
  // 시안 확인용: 예시 데이터일 때 상태를 바꿔 볼 수 있어요.
  const [preview, setPreview] = useState<VerifyStatus | null>(null);

  const approved = status.data?.status === 'APPROVED';
  // 승인되면 업체 센터 화면에 들어갈 수 있게 로그인 정보도 바꿔요.
  useEffect(() => {
    if (approved) updateSession({ hasApprovedPlace: true });
  }, [approved]);

  if (list.status !== 'success') return <LoadState status={list.status} errorText={list.error?.message} onRetry={list.reload} />;
  // 아직 업체 인증 요청을 안 보냈으면 업체 인증으로
  if (!status.data) return <Navigate to="/signup/business" replace />;
  const s: SignupStatus = preview
    ? {
        ...status.data,
        status: preview,
        reason:
          preview === 'NEEDS_INFO'
            ? '사업자등록증의 상호가 잘 보이게 다시 올려 주세요.'
            : preview === 'REJECTED'
              ? '성수 · 건대 · 서울숲 지역 밖에 있는 매장이에요.'
              : undefined,
      }
    : status.data;
  const view = VIEW[s.status as VerifyStatus] ?? VIEW.RECEIVED;

  return (
    <>
      <SignupSteps current={3} />

      {USE_MOCK && (
        <div className={styles.previewBar}>
          <span>시안 미리보기 · 상태</span>
          <Segmented
            label="미리볼 상태"
            value={(preview ?? s.status) as VerifyStatus}
            onChange={setPreview}
            options={(Object.keys(VIEW) as VerifyStatus[]).map((k) => ({ value: k, label: VIEW[k].chip }))}
          />
        </div>
      )}

      <section aria-labelledby="wait-title" className={styles.hero}>
        <span aria-hidden="true" className={`${styles.heroIcon} ${s.status === 'APPROVED' ? styles.heroIconOk : ''} ${s.status === 'NEEDS_INFO' || s.status === 'REJECTED' ? styles.heroIconWarn : ''}`}>
          <Icon name={view.icon} size={36} />
        </span>
        <h1 id="wait-title" className={styles.heroTitle}>
          {view.title}
        </h1>
        <p className={styles.heroText}>{view.text}</p>
        <StatusChip status={s.status} label={s.submittedAt ? `${view.chip} · ${formatDateTime(s.submittedAt)} 제출` : view.chip} />
      </section>

      {s.reason && (s.status === 'NEEDS_INFO' || s.status === 'REJECTED') && (
        <Notice tone={s.status === 'REJECTED' ? 'danger' : 'warning'} role="alert">
          <strong>{s.status === 'REJECTED' ? '반려 사유' : '보완 요청 사유'}</strong> · {s.reason}
        </Notice>
      )}

      {s.status === 'APPROVED' && (
        <ButtonLink to="/signup/approved" size="lg" fullWidth>
          시작하기
        </ButtonLink>
      )}

      <Card
        title="제출한 정보"
        aside={
          // 미리보기 중에는 버튼을 숨겨요 (버튼은 서버가 준 실제 상태 · 플래그로만 열어요)
          preview ? undefined : s.canEdit ? (
            <ButtonLink to={`/signup/business?mode=edit&id=${encodeURIComponent(s.verificationId)}`} variant="secondary" size="sm">
              수정하기
            </ButtonLink>
          ) : s.canResubmit ? (
            <ButtonLink to={`/signup/business?mode=resubmit&id=${encodeURIComponent(s.verificationId)}`} size="sm">
              보완하기
            </ButtonLink>
          ) : s.canReapply ? (
            <ButtonLink to={`/signup/business?mode=reapply&id=${encodeURIComponent(s.verificationId)}`} size="sm">
              다시 신청하기
            </ButtonLink>
          ) : undefined
        }
      >
        <InfoList rows={s.info} />
        <p className={styles.small}>
          {s.status === 'RECEIVED'
            ? USE_MOCK ? '운영자가 확인을 시작하면 고칠 수 없어요.' : '보완 요청을 받으면 다시 제출할 수 있어요.'
            : s.status === 'IN_REVIEW'
              ? '확인 중에는 고칠 수 없어요. 보완이 필요하면 이 화면에 사유가 표시돼요.'
              : s.status === 'REJECTED'
                ? '다시 신청하면 새 요청으로 접수돼요.'
                : '결과는 이 화면에서 확인할 수 있어요.'}
        </p>
      </Card>

      {others.length > 0 && (
        <Card title={`다른 업체 인증 요청 ${others.length}건`}>
          <ul className={styles.otherList}>
            {others.map((v) => (
              <li key={v.verificationId}>
                <span>
                  {v.form.name}
                  {v.lastSubmittedAt ? ` · ${formatDateTime(v.lastSubmittedAt)}` : ''}
                </span>
                <StatusChip status={v.status} />
              </li>
            ))}
          </ul>
        </Card>
      )}

      <div className={styles.center}>
        <span>궁금한 점이 있나요?</span>
        {/* 승인 전 계정도 문의하기는 쓸 수 있어요 (명세 4.2절) */}
        <Link to="/signup/inquiry">운영팀에 문의하기</Link>
      </div>
    </>
  );
}
