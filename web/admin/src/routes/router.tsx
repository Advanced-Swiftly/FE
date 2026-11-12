import { createBrowserRouter, Navigate } from 'react-router-dom';
import { AdminLayout } from '@/components/layout/AdminLayout';
import { DrawPage } from '@/pages/draw/DrawPage';
import { LoginPage } from '@/pages/auth/LoginPage';
import { NotFoundPage } from '@/pages/NotFoundPage';
import { QnaPage } from '@/pages/qna/QnaPage';
import { ApplyReviewPage } from '@/pages/queue/ApplyReviewPage';
import { PolicyReviewPage } from '@/pages/queue/PolicyReviewPage';
import { QueuePage } from '@/pages/queue/QueuePage';
import { StoreDetailPage } from '@/pages/stores/StoreDetailPage';
import { StoresPage } from '@/pages/stores/StoresPage';
import { VaccinesPage } from '@/pages/vaccines/VaccinesPage';
import { RequireOperator } from './RequireOperator';

// 로그인 화면 밖은 모두 운영자(OPERATOR) 로그인이 필요해요 (SFR-001 · F-OAUTH).
export const router = createBrowserRouter([
  { path: '/', element: <Navigate to="/queue" replace /> },
  { path: '/login', element: <LoginPage /> },
  {
    element: (
      <RequireOperator>
        <AdminLayout />
      </RequireOperator>
    ),
    children: [
      { path: '/queue', element: <QueuePage /> },
      { path: '/queue/policy/:id', element: <PolicyReviewPage /> },
      { path: '/queue/apply/:id', element: <ApplyReviewPage /> },
      { path: '/vaccines', element: <VaccinesPage /> },
      { path: '/stores', element: <StoresPage /> },
      { path: '/stores/:id', element: <StoreDetailPage /> },
      { path: '/stamp-road', element: <DrawPage /> },
      { path: '/qna', element: <QnaPage /> },
    ],
  },
  { path: '*', element: <NotFoundPage /> },
]);
