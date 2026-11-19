import { useParams } from 'react-router-dom';
import { getTerms } from '@/api/account';
import { LoadState } from '@/components/common/LoadState';
import { Notice } from '@/components/common/Notice';
import { useFetch } from '@/hooks/useFetch';
import styles from '@/styles/page.module.css';

/**
 * 약관 보기 (예시 모드에서 약관 url 이 가리키는 화면).
 * 실제 서버에서는 F-WAUTH-01 의 terms[].url (약관 본문 주소)을 새 창으로 열어요.
 */
export function TermsPage() {
  const { code = '' } = useParams();
  const terms = useFetch('terms', getTerms);
  if (terms.status !== 'success') return <LoadState status={terms.status} onRetry={terms.reload} />;
  const term = terms.data.find((t) => t.code === code);

  return (
    <main className={styles.page} style={{ maxWidth: 720, margin: '0 auto', padding: 'var(--space-8) var(--space-6)' }}>
      <h1>{term?.title ?? '약관'}</h1>
      {term && <p>버전 {term.version}</p>}
      <Notice>약관 본문은 운영팀이 확정한 뒤 연결돼요. (약관 코드 · 본문은 명세에서 [확인 필요])</Notice>
    </main>
  );
}
