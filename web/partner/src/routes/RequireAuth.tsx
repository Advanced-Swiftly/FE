import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useSession } from '@/hooks/useSession';

interface RequireAuthProps {
  /** approved: 승인된 매장이 있어야 들어가는 화면 (대시보드 등) / pending: 로그인만 하면 되는 화면 (승인 대기 · 업체 인증) */
  level: 'approved' | 'pending';
  children: ReactNode;
}

/**
 * 로그인 · 승인 상태에 따라 화면 진입을 막아요 (명세 4.2절).
 * 화면만 막는 거라 실제 권한 검사는 서버가 매 요청 다시 해요 (BUSINESS_NOT_APPROVED · NOT_FOUND).
 */
export function RequireAuth({ level, children }: RequireAuthProps) {
  const session = useSession();
  const location = useLocation();

  if (!session || session.role !== 'BUSINESS') return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  if (level === 'approved' && !session.hasApprovedPlace) {
    return <Navigate to={session.hasVerificationRequest ? '/signup/pending' : '/signup/business'} replace />;
  }
  return <>{children}</>;
}
