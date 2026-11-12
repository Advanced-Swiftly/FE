import { useState, type FormEvent } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { adminLogin } from '@/api/auth';
import { Button } from '@/components/common/Button';
import { Field, TextInput } from '@/components/common/Field';
import { Icon } from '@/components/common/Icon';
import { useAction } from '@/hooks/useAction';
import styles from './LoginPage.module.css';

/** 운영자 로그인 (시안 없음 · 업체 로그인과 같은 형식으로 만들었어요) */
export function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from;
  const [id, setId] = useState('');
  const [password, setPassword] = useState('');
  const login = useAction(adminLogin);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if ((await login.run(id.trim(), password)).ok) navigate(from && from !== '/login' ? from : '/queue', { replace: true });
  };

  return (
    <main className={styles.page}>
      <form className={styles.card} aria-labelledby="admin-login-title" onSubmit={onSubmit} noValidate>
        <div className={styles.brand}>
          <Icon name="paw" size={28} />
          <span>PawFit</span>
          <span className={styles.badge}>운영자</span>
        </div>
        <h1 id="admin-login-title" className={styles.title}>
          운영자 로그인
        </h1>
        <Field label="아이디" htmlFor="admin-id">
          <TextInput id="admin-id" autoComplete="username" value={id} onChange={(e) => setId(e.target.value)} />
        </Field>
        <Field label="비밀번호" htmlFor="admin-pw">
          <TextInput id="admin-pw" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
        </Field>
        {login.error && (
          <p role="alert" className={styles.error}>
            {login.error}
          </p>
        )}
        <Button type="submit" variant="dark" size="lg" fullWidth disabled={!id || !password || login.pending}>
          {login.pending ? '로그인 중…' : '로그인'}
        </Button>
        <p className={styles.muted}>운영자 계정은 PawFit 운영팀만 쓸 수 있어요. 열람 · 처리 기록이 남아요.</p>
      </form>
    </main>
  );
}
