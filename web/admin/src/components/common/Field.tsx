import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react';
import { Icon } from './Icon';
import styles from './Field.module.css';

interface FieldProps {
  label: ReactNode;
  htmlFor?: string;
  /** 회색 안내 문구 */
  hint?: ReactNode;
  /** 확인 결과 문구 (초록 ✓ / 빨강 !) */
  message?: { tone: 'ok' | 'error'; text: string } | null;
  /** 라벨을 화면에서 숨길 때 */
  hideLabel?: boolean;
  className?: string;
  children: ReactNode;
}

/** 라벨 + 입력 + 안내 문구 묶음 */
export function Field({ label, htmlFor, hint, message, hideLabel, className, children }: FieldProps) {
  return (
    <div className={`${styles.field} ${className ?? ''}`}>
      <label htmlFor={htmlFor} className={hideLabel ? 'sr-only' : styles.label}>
        {label}
      </label>
      {children}
      {message && (
        <span className={message.tone === 'ok' ? styles.ok : styles.error} role={message.tone === 'error' ? 'alert' : 'status'}>
          <Icon name={message.tone === 'ok' ? 'check' : 'warning'} size={16} />
          {message.text}
        </span>
      )}
      {hint && <span className={styles.hint}>{hint}</span>}
    </div>
  );
}

/** 입력칸 + 오른쪽 버튼 (중복 확인 · 조회 등) */
export function InputRow({ children }: { children: ReactNode }) {
  return <div className={styles.row}>{children}</div>;
}

export function TextInput({ className, ...rest }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={`${styles.control} ${className ?? ''}`} {...rest} />;
}

export function Select({ className, ...rest }: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={`${styles.control} ${styles.select} ${className ?? ''}`} {...rest} />;
}

export function TextArea({ className, ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={`${styles.control} ${styles.textarea} ${className ?? ''}`} {...rest} />;
}

interface ChoiceProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  type: 'radio' | 'checkbox';
  label: ReactNode;
  /** 테두리 있는 버튼 모양 */
  boxed?: boolean;
}

/** 라디오 · 체크박스 + 글자 */
export function Choice({ type, label, boxed, className, ...rest }: ChoiceProps) {
  const cls = [styles.choice, boxed ? styles.boxed : '', boxed && rest.checked ? styles.boxedOn : '', className ?? ''].join(' ');
  return (
    <label className={cls}>
      <input type={type} {...rest} />
      <span>{label}</span>
    </label>
  );
}
