import type { ButtonHTMLAttributes } from 'react';
import { Link, type LinkProps } from 'react-router-dom';
import styles from './Button.module.css';

export type ButtonVariant = 'primary' | 'secondary' | 'dark' | 'danger' | 'ghost' | 'success' | 'caution' | 'dangerSolid';
type Size = 'md' | 'sm' | 'lg';

interface StyleProps {
  variant?: ButtonVariant;
  size?: Size;
  fullWidth?: boolean;
  className?: string;
}

function buttonClass({ variant = 'primary', size = 'md', fullWidth = false, className }: StyleProps) {
  return [styles.button, styles[variant], styles[size], fullWidth ? styles.full : '', className ?? ''].join(' ');
}

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & StyleProps;

/**
 * Figma의 Button 컴포넌트.
 * primary · secondary · dark · danger(빨간 테두리) · ghost(글자만) + 처리 결과용 success · caution · dangerSolid
 */
export function Button({ variant, size, fullWidth, className, type = 'button', ...rest }: ButtonProps) {
  return <button type={type} className={buttonClass({ variant, size, fullWidth, className })} {...rest} />;
}

type ButtonLinkProps = LinkProps & StyleProps;

/** 버튼처럼 보이는 링크 (페이지 이동용) */
export function ButtonLink({ variant, size, fullWidth, className, ...rest }: ButtonLinkProps) {
  return <Link className={buttonClass({ variant, size, fullWidth, className })} {...rest} />;
}
