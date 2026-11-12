import { USE_MOCK } from '@/api/client';
import { useState, type FormEvent } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { login } from '@/api/account';
import { Button, ButtonLink } from '@/components/common/Button';
import { Choice, Field, TextInput } from '@/components/common/Field';
import { Icon } from '@/components/common/Icon';
import { useAction } from '@/hooks/useAction';
import styles from './LoginPage.module.css';

const POINTS = ['입장 조건을 등록하고 바뀌면 바로 수정 요청', '매장 QR로 실제 방문 인증 수 확인', '댕댕로드 지역 이벤트와 지도 노출 광고 참여'];

export function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from;
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [keep, setKeep] = useState(true);
  const [showFind, setShowFind] = useState(false);
  const action = useAction(login);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const res = await action.run(email.trim(), password, keep);
    if (!res.ok) return;
    // 승인된 계정은 원래 가려던 화면(없으면 대시보드)으로
    if (res.data.hasApprovedPlace) navigate(from && from !== '/login' ? from : '/dashboard', { replace: true });
    else navigate(res.data.hasVerificationRequest ? '/signup/pending' : '/signup/business', { replace: true });
  };

  return (
    <div className={styles.page}>
      <section aria-label="PawFit 업체 센터 소개" className={styles.intro}>
        <div className={styles.brand}>
          <Icon name="paw" size={32} />
          <span>PawFit 업체 센터</span>
        </div>
        <h1 className={styles.headline}>
          반려견 보호자에게
          <br />
          우리 매장 입장 조건을
          <br />
          정확하게 알려 주세요
        </h1>
        <ul className={styles.points}>
          {POINTS.map((p) => (
            <li key={p}>
              <Icon name="check" size={22} />
              <span>{p}</span>
            </li>
          ))}
        </ul>
        <span className={styles.grow} />
        <p className={styles.pilot}>성수 · 건대 · 서울숲 지역 업체 대상 시범 운영 중</p>
      </section>

      <main className={styles.main}>
        <form className={styles.form} aria-labelledby="login-title" onSubmit={onSubmit} noValidate>
          <div className={styles.titleBox}>
            <h2 id="login-title" className={styles.title}>업체 로그인</h2>
            <p className={styles.muted}>업체 관리자 계정으로 로그인하세요.</p>
          </div>
          {/* 서버 로그인은 가입한 휴대폰 번호로 해요 (BE 공통 로그인 phoneNumber) */}
          <Field label={USE_MOCK ? '아이디 (이메일)' : '휴대폰 번호'} htmlFor="login-email">
            <TextInput id="login-email" type={USE_MOCK ? 'email' : 'tel'} inputMode={USE_MOCK ? undefined : 'tel'} placeholder={USE_MOCK ? undefined : '01012345678'} autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </Field>
          <Field label="비밀번호" htmlFor="login-pw">
            <TextInput id="login-pw" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </Field>
          <div className={styles.row}>
            <Choice type="checkbox" label="로그인 상태 유지" checked={keep} onChange={(e) => setKeep(e.target.checked)} />
            {/* TODO: 비밀번호 찾기 화면 (시안 없음) */}
            <button type="button" className={styles.textButton} aria-expanded={showFind} onClick={() => setShowFind((v) => !v)}>
              비밀번호 찾기
            </button>
          </div>
          {showFind && <p className={styles.muted}>비밀번호 찾기는 준비 중이에요. 가입할 때 쓴 휴대폰 번호로 PawFit 운영팀에 연락해 주세요.</p>}
          {action.error && (
            <p className={styles.error} role="alert">
              {action.error}
            </p>
          )}
          <Button type="submit" size="lg" fullWidth disabled={action.pending}>
            {action.pending ? '로그인 중…' : '로그인'}
          </Button>
          <div className={styles.divider}>
            <span />
            처음이신가요?
            <span />
          </div>
          <ButtonLink to="/signup" variant="secondary" size="lg" fullWidth>
            회원가입 · 업체 인증
          </ButtonLink>
          <p className={styles.muted}>업체 계정은 운영자가 사업자 정보를 확인한 뒤 사용할 수 있어요. 보통 1–2일 걸려요.</p>
        </form>
      </main>
    </div>
  );
}
