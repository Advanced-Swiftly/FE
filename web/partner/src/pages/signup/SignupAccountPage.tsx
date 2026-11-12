import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { checkLoginIdAvailable, createAccount, digitsOnly, getTerms, sendPhoneCode, verifyPhoneCode } from '@/api/account';
import { Button } from '@/components/common/Button';
import { Choice, Field, InputRow, TextInput } from '@/components/common/Field';
import { Icon } from '@/components/common/Icon';
import { useAction } from '@/hooks/useAction';
import { useFetch } from '@/hooks/useFetch';
import { passwordRules } from '@/utils/password';
import { SignupSteps } from './SignupSteps';
import styles from './Signup.module.css';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
/** F-WAUTH-03 응답 초 값 — 없거나 이상하면 0 (고정값으로 추측하지 않아요) */
const toSeconds = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) && v > 0 ? Math.floor(v) : 0);


/** 가입 1단계 · 계정 만들기 */
export function SignupAccountPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [emailOk, setEmailOk] = useState<boolean | null>(null);
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  /** 인증번호 유효 시간 (expiresInSec) */
  const [secondsLeft, setSecondsLeft] = useState(0);
  /** 다시 받기까지 기다릴 시간 (resendAfterSec) — 유효 시간과 따로 세요 */
  const [resendLeft, setResendLeft] = useState(0);
  const [codeSent, setCodeSent] = useState(false);
  const [phoneOk, setPhoneOk] = useState<boolean | null>(null);
  /** 마지막으로 받은 인증번호의 요청 ID — 확인 요청에 보내요 (다시 받으면 새 값) */
  const [verificationId, setVerificationId] = useState<string | number | null>(null);
  /** 인증번호 확인에서 받은 토큰 — 회원가입 phoneVerificationToken 으로 보내요 */
  const [verificationToken, setVerificationToken] = useState('');
  const [agreed, setAgreed] = useState<Record<string, boolean>>({});
  const termsList = useFetch('terms', getTerms);
  const terms = termsList.data ?? [];

  const check = useAction(checkLoginIdAvailable);
  const send = useAction(sendPhoneCode);
  const verify = useAction(verifyPhoneCode);
  const submit = useAction(createAccount);

  // 인증번호 남은 시간
  useEffect(() => {
    if (secondsLeft <= 0) return;
    const t = setTimeout(() => setSecondsLeft((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [secondsLeft]);

  // 다시 받기 대기 시간
  useEffect(() => {
    if (resendLeft <= 0) return;
    const t = setTimeout(() => setResendLeft((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [resendLeft]);

  const rules = passwordRules(pw);
  const pwValid = rules.every((r) => !r.required || r.met);
  const pwMatch = pw2.length > 0 && pw === pw2;
  const requiredTerms = terms.filter((t) => t.required);
  const requiredAgreed = requiredTerms.length > 0 && requiredTerms.every((t) => agreed[t.code]);
  const canSubmit = emailOk === true && pwValid && pwMatch && name.trim().length > 0 && phoneOk === true && verificationToken !== '' && requiredAgreed;

  const onCheckEmail = async () => {
    if (!EMAIL_RE.test(email)) {
      setEmailOk(false);
      return;
    }
    const res = await check.run(email);
    setEmailOk(res.ok ? res.data : null);
  };

  const onSendCode = async () => {
    const res = await send.run(phone);
    if (!res.ok) return;
    setCodeSent(true);
    setPhoneOk(null);
    setVerificationToken('');
    setVerificationId(res.data.verificationId);
    // 성공한 발송(처음 · 다시 받기)마다 두 타이머를 서버 값으로 새로 시작해요.
    setSecondsLeft(toSeconds(res.data.expiresInSec));
    setResendLeft(toSeconds(res.data.resendAfterSec));
    setCode('');
  };

  const onVerify = async () => {
    if (verificationId === null) return;
    const res = await verify.run(verificationId, code);
    setPhoneOk(res.ok);
    if (res.ok) {
      setVerificationToken(res.data);
      setSecondsLeft(0);
    }
  };

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    const agreements = terms.map((t) => ({ code: t.code, termId: t.termId, version: t.version, agreed: Boolean(agreed[t.code]) }));
    const res = await submit.run({ loginId: email.trim(), password: pw, name: name.trim(), phone: digitsOnly(phone), verificationToken, agreements });
    if (res.ok) navigate('/signup/business');
    // 인증 결과가 만료됐으면 휴대폰 인증을 다시 하게 해요.
    else if (res.error.code === 'VERIFICATION_INVALID') {
      setPhoneOk(null);
      setVerificationToken('');
      setCodeSent(false);
    } else if (res.error.code === 'EMAIL_TAKEN' || res.error.code === 'LOGIN_ID_TAKEN') setEmailOk(false);
  };

  const emailMessage =
    emailOk === true
      ? { tone: 'ok' as const, text: '사용할 수 있는 아이디예요' }
      : emailOk === false
        ? { tone: 'error' as const, text: EMAIL_RE.test(email) ? '이미 사용 중인 아이디예요' : '이메일 형식을 확인해 주세요' }
        : null;

  const mm = Math.floor(secondsLeft / 60);
  const ss = String(secondsLeft % 60).padStart(2, '0');

  return (
    <>
      <div className={styles.titleBox}>
        <h1 className={styles.title}>계정 만들기</h1>
        <p className={styles.lead}>업체 센터에 로그인할 아이디와 비밀번호를 정해 주세요.</p>
      </div>
      <SignupSteps current={1} />

      <form aria-label="계정 정보" className={styles.form} onSubmit={onSubmit} noValidate>
        <Field label="아이디 (이메일)" htmlFor="su-email" message={emailMessage}>
          <InputRow>
            <TextInput
              id="su-email"
              type="email"
              autoComplete="username"
              value={email}
              aria-invalid={emailOk === false}
              onChange={(e) => {
                setEmail(e.target.value);
                setEmailOk(null);
              }}
            />
            <Button variant="secondary" disabled={!email || check.pending} onClick={onCheckEmail}>
              중복 확인
            </Button>
          </InputRow>
        </Field>

        <Field label="비밀번호" htmlFor="su-pw">
          <TextInput id="su-pw" type="password" autoComplete="new-password" aria-describedby="su-pw-rules" value={pw} onChange={(e) => setPw(e.target.value)} />
          <ul id="su-pw-rules" className={styles.rules}>
            {rules.map((r) => (
              <li key={r.label} className={r.met ? styles.met : ''}>
                <Icon name={r.met ? 'check' : 'info'} size={15} />
                {r.label}
              </li>
            ))}
          </ul>
        </Field>

        <Field
          label="비밀번호 확인"
          htmlFor="su-pw2"
          message={pw2 ? (pwMatch ? { tone: 'ok', text: '비밀번호가 일치해요' } : { tone: 'error', text: '비밀번호가 달라요' }) : null}
        >
          <TextInput id="su-pw2" type="password" autoComplete="new-password" value={pw2} aria-invalid={pw2.length > 0 && !pwMatch} onChange={(e) => setPw2(e.target.value)} />
        </Field>

        <div className={styles.divider} />

        <Field label="담당자 이름" htmlFor="su-name">
          <TextInput id="su-name" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} />
        </Field>

        <Field
          label="휴대폰 번호"
          htmlFor="su-phone"
          message={
            phoneOk === true
              ? { tone: 'ok', text: '휴대폰 인증이 끝났어요' }
              : phoneOk === false
                ? { tone: 'error', text: verify.error ?? '인증번호가 맞지 않아요' }
                : send.error
                  ? { tone: 'error', text: send.error }
                  : null
          }
          hint={
            <>
              요청 처리 결과와 승인 알림을 이 번호로 보내요
              {secondsLeft > 0 && (
                <span className={styles.timer}>
                  {' '}
                  · 남은 시간 {mm}:{ss}
                </span>
              )}
            </>
          }
        >
          <InputRow>
            <TextInput
              id="su-phone"
              type="tel"
              autoComplete="tel"
              placeholder="010-0000-0000"
              value={phone}
              onChange={(e) => {
                setPhone(e.target.value);
                setPhoneOk(null);
                setVerificationToken('');
              }}
            />
            <Button
              variant="secondary"
              disabled={digitsOnly(phone).length < 10 || send.pending || phoneOk === true || (codeSent && resendLeft > 0)}
              onClick={onSendCode}
            >
              {codeSent ? (resendLeft > 0 ? `${resendLeft}초 뒤 다시 받기` : '다시 받기') : '인증번호 받기'}
            </Button>
          </InputRow>
          {codeSent && phoneOk !== true && (
            <InputRow>
              <label htmlFor="su-code" className="sr-only">
                인증번호
              </label>
              <TextInput id="su-code" inputMode="numeric" maxLength={6} placeholder="인증번호 6자리" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} />
              <Button variant="dark" disabled={code.length !== 6 || secondsLeft === 0 || verify.pending} onClick={onVerify}>
                확인
              </Button>
            </InputRow>
          )}
        </Field>

        <fieldset className={styles.fieldset}>
          <legend>약관 동의</legend>
          {termsList.status === 'error' && (
            <p role="alert" className={styles.lead}>
              약관을 불러오지 못했어요.{' '}
              <button type="button" className={styles.termLink} onClick={termsList.reload}>
                다시 시도
              </button>
            </p>
          )}
          <Choice
            type="checkbox"
            className={styles.allAgree}
            label="필수 약관 모두 동의"
            checked={requiredAgreed}
            disabled={requiredTerms.length === 0}
            // 필수 약관만 켜고 꺼요. 선택 약관은 사용자가 고른 값을 그대로 둬요.
            onChange={(e) => {
              const on = e.target.checked;
              setAgreed((a) => ({ ...a, ...Object.fromEntries(requiredTerms.map((t) => [t.code, on])) }));
            }}
          />
          {terms.map((t) => (
            <div key={t.code} className={styles.termRow}>
              <Choice
                type="checkbox"
                label={`${t.title} (${t.required ? '필수' : '선택'})`}
                checked={Boolean(agreed[t.code])}
                onChange={(e) => setAgreed((a) => ({ ...a, [t.code]: e.target.checked }))}
              />
              {t.url && (
                <a href={t.url} target="_blank" rel="noopener noreferrer" className={styles.termLink} aria-label={`${t.title} 보기 (새 창)`}>
                  보기
                </a>
              )}
            </div>
          ))}
        </fieldset>

        {submit.error && (
          <p role="alert" className={styles.lead}>
            {submit.error}
          </p>
        )}
        <Button type="submit" size="lg" fullWidth disabled={!canSubmit || submit.pending}>
          다음 · 업체 인증
        </Button>
        {!canSubmit && <p className={styles.lead}>아이디 중복 확인, 비밀번호, 휴대폰 인증, 필수 약관 동의를 마치면 다음으로 넘어갈 수 있어요.</p>}
      </form>
    </>
  );
}
