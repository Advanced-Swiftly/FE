import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { changePassword, deleteAccount, digitsOnly, getAccount, sendPhoneCode, updateAccount, verifyPhoneCode } from '@/api/account';
import { Button } from '@/components/common/Button';
import { Card } from '@/components/common/Card';
import { Choice, Field, InputRow, TextInput } from '@/components/common/Field';
import { InfoList } from '@/components/common/InfoList';
import { LoadState } from '@/components/common/LoadState';
import { Notice } from '@/components/common/Notice';
import { PageHeader } from '@/components/common/PageHeader';
import { useAction } from '@/hooks/useAction';
import { useFetch } from '@/hooks/useFetch';
import page from '@/styles/page.module.css';
import type { Account } from '@/types';
import { PASSWORD_HINT, isValidPassword } from '@/utils/password';
import styles from './AccountPage.module.css';

type Panel = null | 'edit' | 'password' | 'delete';

export function AccountPage() {
  const account = useFetch('account', getAccount);
  const [panel, setPanel] = useState<Panel>(null);
  const [flash, setFlash] = useState('');
  const a = account.data;

  const done = (message: string) => {
    setPanel(null);
    setFlash(message);
    account.reload();
  };

  return (
    <div className={`${page.stack} ${styles.narrow}`}>
      <PageHeader title="계정 정보" description="매장 전환은 왼쪽 위 업체 이름을 눌러서 할 수 있어요." />
      {flash && (
        <Notice tone="success" role="status" onClose={() => setFlash('')}>
          {flash}
        </Notice>
      )}
      <LoadState status={account.status} />

      {a && (
        <>
          <Card
            title="내 계정"
            aside={
              panel !== 'edit' && (
                <Button variant="secondary" size="sm" onClick={() => setPanel('edit')}>
                  정보 수정
                </Button>
              )
            }
          >
            {panel === 'edit' ? (
              <EditForm account={a} onCancel={() => setPanel(null)} onDone={() => done('계정 정보를 저장했어요.')} />
            ) : (
              <InfoList
                labelWidth={130}
                rows={[
                  { label: '이름', value: a.name },
                  { label: '아이디 (이메일)', value: a.loginId },
                  { label: '연락처', value: a.phone },
                  { label: '연결된 업체', value: a.stores ? `${a.stores.total}곳 · 인증 완료 ${a.stores.approved} · 승인 대기 ${a.stores.pending}` : '확인 필요 (계정 정보 응답에 없어요)' },
                  {
                    label: '비밀번호',
                    value: (
                      <button type="button" className={styles.link} onClick={() => setPanel(panel === 'password' ? null : 'password')}>
                        비밀번호 변경
                      </button>
                    ),
                  },
                ]}
              />
            )}
          </Card>

          {panel === 'password' && (
            <Card title="비밀번호 변경">
              <PasswordForm onCancel={() => setPanel(null)} onDone={() => done('비밀번호를 바꿨어요.')} />
            </Card>
          )}

          {panel === 'delete' ? (
            <Card title="회원 탈퇴" tone="warning">
              <DeleteForm onCancel={() => setPanel(null)} />
            </Card>
          ) : (
            <button type="button" className={styles.danger} onClick={() => setPanel('delete')}>
              회원 탈퇴
            </button>
          )}
        </>
      )}
    </div>
  );
}

function EditForm({ account, onCancel, onDone }: { account: Account; onCancel: () => void; onDone: () => void }) {
  const [name, setName] = useState(account.name);
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  // 번호 변경 인증 (purpose CHANGE_PHONE): 마지막으로 받은 요청 ID → 확인 → 토큰
  const [verificationId, setVerificationId] = useState<string | number | null>(null);
  const [phoneToken, setPhoneToken] = useState('');
  const save = useAction(updateAccount);
  const send = useAction(sendPhoneCode);
  const verify = useAction(verifyPhoneCode);
  // 연락처는 새 번호를 입력했을 때만 형식을 봐요. 비워 두면 지금 번호를 그대로 둬요.
  const phoneEntered = phone.trim() !== '';
  const phoneOk = !phoneEntered || /^01\d-?\d{3,4}-?\d{4}$/.test(phone.trim());
  const nameChanged = name.trim() !== '' && name.trim() !== account.name.trim();
  // 새 번호는 인증을 마쳐야 저장할 수 있어요
  const phoneReady = !phoneEntered || phoneToken !== '';
  const changed = nameChanged || (phoneEntered && phoneToken !== '');

  const onPhoneChange = (v: string) => {
    setPhone(v);
    setVerificationId(null);
    setPhoneToken('');
    setCode('');
  };
  const onSendCode = async () => {
    const res = await send.run(phone, 'CHANGE_PHONE');
    if (!res.ok) return;
    setVerificationId(res.data.verificationId);
    setPhoneToken('');
    setCode('');
  };
  const onVerify = async () => {
    if (verificationId === null) return;
    const res = await verify.run(verificationId, code);
    if (res.ok) setPhoneToken(res.data);
  };

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !phoneOk || !phoneReady || !changed) return;
    const res = await save.run({ currentName: account.name, name, phoneVerificationToken: phoneToken || undefined, newPhone: phone.trim() });
    if (res.ok) onDone();
  };

  return (
    <form className={styles.form} onSubmit={onSubmit} noValidate>
      <Field label="이름" htmlFor="ac-name">
        <TextInput id="ac-name" value={name} onChange={(e) => setName(e.target.value)} />
      </Field>
      <Field label="연락처" htmlFor="ac-phone" hint={`지금 번호: ${account.phone} · 바꿀 때만 입력해 주세요`} message={phone && !phoneOk ? { tone: 'error', text: '휴대폰 번호 형식을 확인해 주세요' } : null}>
        <InputRow>
          <TextInput id="ac-phone" type="tel" placeholder="010-0000-0000" value={phone} onChange={(e) => onPhoneChange(e.target.value)} />
          {phoneEntered && (
            <Button variant="secondary" disabled={!phoneOk || digitsOnly(phone).length < 10 || send.pending || phoneToken !== ''} onClick={onSendCode}>
              {verificationId === null ? '인증번호 받기' : '다시 받기'}
            </Button>
          )}
        </InputRow>
      </Field>
      {phoneEntered && verificationId !== null && phoneToken === '' && (
        <Field label="인증번호" htmlFor="ac-code" message={verify.error ? { tone: 'error', text: verify.error } : null}>
          <InputRow>
            <TextInput id="ac-code" inputMode="numeric" maxLength={6} placeholder="인증번호 6자리" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} />
            <Button variant="dark" disabled={code.length !== 6 || verify.pending} onClick={onVerify}>
              확인
            </Button>
          </InputRow>
        </Field>
      )}
      {phoneEntered && phoneToken !== '' && <Notice tone="success">새 번호 인증을 마쳤어요. 저장하면 연락처가 바뀌어요.</Notice>}
      {send.error && <Notice tone="danger" role="alert">{send.error}</Notice>}
      {save.error && <Notice tone="danger" role="alert">{save.error}</Notice>}
      <div className={page.actions}>
        <Button variant="secondary" onClick={onCancel}>
          취소
        </Button>
        <Button type="submit" disabled={!name.trim() || !phoneOk || !phoneReady || !changed || save.pending}>
          저장
        </Button>
      </div>
    </form>
  );
}

function PasswordForm({ onCancel, onDone }: { onCancel: () => void; onDone: () => void }) {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const save = useAction(changePassword);
  const nextOk = isValidPassword(next);
  const match = confirm.length > 0 && next === confirm;

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!current || !nextOk || !match) return;
    if ((await save.run(current, next)).ok) onDone();
  };

  return (
    <form className={styles.form} onSubmit={onSubmit} noValidate>
      <Field label="지금 비밀번호" htmlFor="pw-current">
        <TextInput id="pw-current" type="password" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} />
      </Field>
      <Field label="새 비밀번호" htmlFor="pw-next" hint={PASSWORD_HINT} message={next && !nextOk ? { tone: 'error', text: '규칙에 맞지 않아요' } : null}>
        <TextInput id="pw-next" type="password" autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} />
      </Field>
      <Field
        label="새 비밀번호 확인"
        htmlFor="pw-confirm"
        message={confirm ? (match ? { tone: 'ok', text: '비밀번호가 일치해요' } : { tone: 'error', text: '비밀번호가 달라요' }) : null}
      >
        <TextInput id="pw-confirm" type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
      </Field>
      {save.error && <Notice tone="danger" role="alert">{save.error}</Notice>}
      <div className={page.actions}>
        <Button variant="secondary" onClick={onCancel}>
          취소
        </Button>
        <Button type="submit" disabled={!current || !nextOk || !match || save.pending}>
          비밀번호 바꾸기
        </Button>
      </div>
    </form>
  );
}

function DeleteForm({ onCancel }: { onCancel: () => void }) {
  const navigate = useNavigate();
  const [agree, setAgree] = useState(false);
  const [password, setPassword] = useState('');
  const remove = useAction(deleteAccount);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!agree || !password) return;
    if ((await remove.run(password)).ok) navigate('/login');
  };

  return (
    <form className={styles.form} onSubmit={onSubmit} noValidate>
      <p className={styles.warnText}>탈퇴하면 연결된 매장의 관리 권한이 없어지고, 보호자 지도에서는 운영자가 확인한 입장 조건만 남아요. 진행 중인 광고 · 이벤트 신청은 취소돼요.</p>
      <Choice type="checkbox" label="위 내용을 확인했어요" checked={agree} onChange={(e) => setAgree(e.target.checked)} />
      <Field label="비밀번호" htmlFor="del-pw">
        <TextInput id="del-pw" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
      </Field>
      {remove.error && <Notice tone="danger" role="alert">{remove.error}</Notice>}
      <div className={page.actions}>
        <Button variant="secondary" onClick={onCancel}>
          그만두기
        </Button>
        <Button type="submit" variant="dangerSolid" disabled={!agree || !password || remove.pending}>
          탈퇴하기
        </Button>
      </div>
    </form>
  );
}
