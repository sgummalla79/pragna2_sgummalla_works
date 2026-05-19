import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { ROUTES } from '@/constants/routes';
import { ProtectedRoute } from './ProtectedRoute';
import { GuestOnlyRoute } from './GuestOnlyRoute';

const LoginView = lazy(() => import('@/presentation/views/LoginView/LoginView'));
const RegisterView = lazy(() => import('@/presentation/views/RegisterView/RegisterView'));
const ChatView = lazy(() => import('@/presentation/views/ChatView/ChatView'));
const ProvidersView = lazy(() => import('@/presentation/views/ProvidersView/ProvidersView'));
const ModelsView = lazy(() => import('@/presentation/views/ModelsView/ModelsView'));
const FlowBuilderView = lazy(() => import('@/presentation/views/FlowBuilderView/FlowBuilderView'));
const SkillsView = lazy(() => import('@/presentation/views/SkillsView/SkillsView'));
const ConversationsView = lazy(
  () => import('@/presentation/views/ConversationsView/ConversationsView')
);

export function AppRoutes() {
  return (
    <Suspense fallback={null}>
      <Routes>
        <Route
          path={ROUTES.LOGIN}
          element={
            <GuestOnlyRoute>
              <LoginView />
            </GuestOnlyRoute>
          }
        />
        <Route
          path={ROUTES.REGISTER}
          element={
            <GuestOnlyRoute>
              <RegisterView />
            </GuestOnlyRoute>
          }
        />
        <Route
          path={ROUTES.CHAT}
          element={
            <ProtectedRoute>
              <ChatView />
            </ProtectedRoute>
          }
        />
        <Route
          path={ROUTES.PROVIDERS}
          element={
            <ProtectedRoute>
              <ProvidersView />
            </ProtectedRoute>
          }
        />
        <Route
          path={ROUTES.MODELS}
          element={
            <ProtectedRoute>
              <ModelsView />
            </ProtectedRoute>
          }
        />
        <Route
          path={ROUTES.FLOW_DETAIL}
          element={
            <ProtectedRoute>
              <FlowBuilderView />
            </ProtectedRoute>
          }
        />
        <Route
          path={ROUTES.FLOWS}
          element={
            <ProtectedRoute>
              <FlowBuilderView />
            </ProtectedRoute>
          }
        />
        <Route
          path={ROUTES.SKILLS}
          element={
            <ProtectedRoute>
              <SkillsView />
            </ProtectedRoute>
          }
        />
        <Route
          path={ROUTES.CONVERSATIONS}
          element={
            <ProtectedRoute>
              <ConversationsView />
            </ProtectedRoute>
          }
        />
        <Route path="*" element={<Navigate to={ROUTES.LOGIN} replace />} />
      </Routes>
    </Suspense>
  );
}
