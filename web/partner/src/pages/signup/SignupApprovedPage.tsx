import { useNavigate, useSearchParams } from 'react-router-dom';
import { getVerifications } from '@/api/account';
import { ButtonLink } from '@/components/common/Button';
import { Icon } from '@/components/common/Icon';
import { LoadState } from '@/components/common/LoadState';
import { Notice } from '@/components/common/Notice';
import { StatusChip } from '@/components/common/StatusChip';
import { useFetch } from '@/hooks/useFetch';
import { formatDateTime } from '@/utils/format';
import styles from './Signup.module.css';

/**
 * UI-W-005 승인 완료 — 매장명 · 승인 시각은 F-WAUTH-11 의 승인 건(businessName · approvedAt)을 보여 줘요.
 * ?id= 가 있으면 그 요청, 없으면 승인 시각이 가장 늦은 승인 건을 골라요.
 * F-WAUTH-11 응답에는 연결된 매장 ID(placeId)가 없어서 매장 QR 을 이 화면에서 부르지 않아요.
 * 매장 이름이나 목록 첫 항목으로 매장을 추측하지 않고, 대시보드의 매장 QR 로 안내해요.
 */
export function SignupApprovedPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const id = params.get('id');
  const list = useFetch('verifications:approved', getVerifications);

  if (list.status !== 'success') return <LoadState status={list.status} errorText={list.error?.message} onRetry={list.reload} />;
  // 승인 시각은 목록 응답 예시에 없어서, 없으면 '승인'만 보여 줘요
  const approved = list.data.filter((v) => v.status === 'APPROVED');
  const v = id ? approved.find((x) => x.verificationId === id) : [...approved].sort((a, b) => (b.approvedAt ?? '').localeCompare(a.approvedAt ?? ''))[0];

  if (!v) {
    return (
      <>
        <Notice tone="warning">승인된 업체 인증 요청을 찾지 못했어요. 승인 대기 화면에서 상태를 확인해 주세요.</Notice>
        <ButtonLink to="/signup/pending" variant="secondary">
          승인 대기 화면으로
        </ButtonLink>
      </>
    );
  }

  const steps = [
    { title: '입장 조건 확인하기', desc: '운영자가 정리한 조건이 맞는지 보고, 다르면 수정 요청을 보내요', onClick: () => navigate('/conditions') },
    { title: '대시보드에서 매장 QR 보기', desc: '대시보드 위쪽 [매장 QR]에서 내려받아 붙이면 보호자가 방문 인증하고 스탬프를 모아요', onClick: () => navigate('/dashboard') },
    { title: '지역 이벤트 둘러보기', desc: '댕댕로드 스탬프 이벤트에 참여할 수 있어요', onClick: () => navigate('/promo'), optional: true },
  ];

  return (
    <>
      <section aria-labelledby="ok-title" className={styles.hero}>
        <span aria-hidden="true" className={`${styles.heroIcon} ${styles.heroIconOk}`}>
          <Icon name="check" size={36} strokeWidth={2.4} />
        </span>
        <h1 id="ok-title" className={styles.heroTitle}>
          {v.form.name} 인증이 끝났어요
        </h1>
        <p className={styles.heroText}>이제 업체 센터를 쓸 수 있어요. 보호자 지도에 매장이 정확하게 보이도록 아래 세 가지만 먼저 해 주세요.</p>
        <StatusChip status="APPROVED" label={v.approvedAt ? `승인 · ${formatDateTime(v.approvedAt)}` : '승인'} />
      </section>

      <section aria-labelledby="next-title" className={styles.nextSection}>
        <h2 id="next-title" className={styles.sectionTitle}>
          처음 할 일
        </h2>
        <ol className={styles.nextList}>
          {steps.map((s, i) => (
            <li key={s.title}>
              <button type="button" className={styles.nextItem} onClick={s.onClick}>
                <span className={`${styles.nextNum} ${s.optional ? styles.nextNumOptional : ''}`}>{i + 1}</span>
                <span className={styles.nextText}>
                  <strong>
                    {s.title}
                    {s.optional && <span> · 선택</span>}
                  </strong>
                  <span>{s.desc}</span>
                </span>
                <Icon name="chevronRight" />
              </button>
            </li>
          ))}
        </ol>
      </section>

      <ButtonLink to="/dashboard" size="lg" fullWidth>
        대시보드로 가기
      </ButtonLink>
    </>
  );
}
