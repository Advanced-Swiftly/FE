import styles from '@/styles/page.module.css';

interface LoadStateProps {
  status: 'loading' | 'error' | 'success';
  /** 실패했을 때 문구 */
  errorText?: string;
  /** 있으면 실패했을 때 [다시 시도] 버튼을 보여 줘요 */
  onRetry?: () => void;
}

/** useFetch 결과가 로딩 · 실패일 때 보여줄 문구. 성공이면 아무것도 안 그려요. */
export function LoadState({ status, errorText = '정보를 불러오지 못했어요. 잠시 후 다시 시도해 주세요.', onRetry }: LoadStateProps) {
  if (status === 'loading') return <p className={styles.loading}>불러오는 중…</p>;
  if (status === 'error')
    return (
      <p className={styles.loading} role="alert">
        {errorText}
        {onRetry && (
          <>
            {' '}
            <button type="button" className={styles.retry} onClick={onRetry}>
              다시 시도
            </button>
          </>
        )}
      </p>
    );
  return null;
}
