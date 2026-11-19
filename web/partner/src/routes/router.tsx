import { createBrowserRouter, Navigate } from 'react-router-dom';
import { SignupLayout } from '@/components/layout/SignupLayout';
import { PartnerLayout } from '@/components/layout/PartnerLayout';
import { AccountPage } from '@/pages/account/AccountPage';
import { LoginPage } from '@/pages/auth/LoginPage';
import { ConditionEditPage } from '@/pages/conditions/ConditionEditPage';
import { ConditionsPage } from '@/pages/conditions/ConditionsPage';
import { DashboardPage } from '@/pages/dashboard/DashboardPage';
import { InquiryPage } from '@/pages/inquiry/InquiryPage';
import { NotFoundPage } from '@/pages/NotFoundPage';
import { PromoPage } from '@/pages/promo/PromoPage';
import { RequestsPage } from '@/pages/requests/RequestsPage';
import { SignupAccountPage } from '@/pages/signup/SignupAccountPage';
import { SignupApprovedPage } from '@/pages/signup/SignupApprovedPage';
import { SignupBusinessPage } from '@/pages/signup/SignupBusinessPage';
import { SignupPendingPage } from '@/pages/signup/SignupPendingPage';
import { StatsPage } from '@/pages/stats/StatsPage';
import { TermsPage } from '@/pages/terms/TermsPage';
import { RequireAuth } from './RequireAuth';

// 화면 진입 규칙 (명세 4.2절 · F-WAUTH 접근 범위)
// - 로그인 · 가입 1단계 · 약관: 누구나
// - 업체 인증 · 승인 대기 · 승인 완료: 로그인한 업체 계정
// - 사이드바 화면: 승인된 매장이 있는 업체 계정 (아니면 승인 대기 · 업체 인증으로 보내요)
// - 문의하기는 승인 전 계정도 쓸 수 있어요 (UI-W-004 ⑤)
export const router = createBrowserRouter([
  { path: '/', element: <Navigate to="/dashboard" replace /> },
  { path: '/login', element: <LoginPage /> },
  { path: '/terms/:code', element: <TermsPage /> },
  {
    element: <SignupLayout />,
    children: [
      { path: '/signup', element: <SignupAccountPage /> },
      { path: '/signup/business', element: <RequireAuth level="pending"><SignupBusinessPage /></RequireAuth> },
      { path: '/signup/pending', element: <RequireAuth level="pending"><SignupPendingPage /></RequireAuth> },
      // 승인 전 계정의 문의하기 (UI-W-004 ⑤) — 매장이 없어 관련 요청 고르기는 빠져요
      { path: '/signup/inquiry', element: <RequireAuth level="pending"><InquiryPage /></RequireAuth> },
      { path: '/signup/approved', element: <RequireAuth level="approved"><SignupApprovedPage /></RequireAuth> },
    ],
  },
  {
    element: (
      <RequireAuth level="approved">
        <PartnerLayout />
      </RequireAuth>
    ),
    children: [
      { path: '/dashboard', element: <DashboardPage /> },
      { path: '/requests', element: <RequestsPage /> },
      { path: '/conditions', element: <ConditionsPage /> },
      { path: '/conditions/edit', element: <ConditionEditPage /> },
      { path: '/stats', element: <StatsPage /> },
      { path: '/promo', element: <PromoPage /> },
      { path: '/inquiry', element: <InquiryPage /> },
      { path: '/account', element: <AccountPage /> },
    ],
  },
  { path: '*', element: <NotFoundPage /> },
]);
