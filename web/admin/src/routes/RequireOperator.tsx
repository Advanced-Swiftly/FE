import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useSession } from '@/hooks/useSession';

/**
 * 운영자(OPERATOR)로 로그인해야 들어가는 화면.
 * 화면만 막는 거라 실제 권한 검사는 서버가 매 요청 다시 해요 (UNAUTHORIZED · FORBIDDEN).
 */
export function RequireOperator({ children }: { children: ReactNode }) {
  const session = useSession();
  const location = useLocation();
  if (!session || session.role !== 'OPERATOR') return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  return <>{children}</>;
}
