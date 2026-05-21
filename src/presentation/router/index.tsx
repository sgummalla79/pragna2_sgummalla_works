import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { ROUTES } from '@/constants/routes';
import { ProtectedRoute } from './ProtectedRoute';
import { GuestOnlyRoute } from './GuestOnlyRoute';
import { SettingsLayout } from '@/presentation/components/settings/SettingsLayout/SettingsLayout';

// ── Auth pages ──────────────────────────────────────────────────────────────
const LoginView        = lazy(() => import('@/presentation/views/auth/LoginView'));
const RegisterView     = lazy(() => import('@/presentation/views/auth/RegisterView'));
const AuthCallbackView = lazy(() => import('@/presentation/views/auth/AuthCallbackView'));

// ── Chat ─────────────────────────────────────────────────────────────────────
const ChatView          = lazy(() => import('@/presentation/views/chat/ChatView'));
const ConversationsView = lazy(() => import('@/presentation/views/chat/ConversationsView'));
const ChatSessionView   = lazy(() => import('@/presentation/views/chat/ChatSessionView'));

// ── Settings sections ────────────────────────────────────────────────────────
const ProvidersView    = lazy(() => import('@/presentation/views/settings/ProvidersView/ProvidersView'));
const FlowBuilderView  = lazy(() => import('@/presentation/views/settings/FlowBuilderView/FlowBuilderView'));
const SkillsView       = lazy(() => import('@/presentation/views/settings/SkillsView/SkillsView'));
const ProfileView      = lazy(() => import('@/presentation/views/settings/ProfileView/ProfileView'));

// ── Dev / Design system ──────────────────────────────────────────────────────
const UIFrameworkView = lazy(() => import('@/presentation/views/UIFrameworkView/UIFrameworkView'));


export function AppRoutes() {
  return (
    <Suspense fallback={null}>
      <Routes>
        {/* ── Guest-only ── */}
        <Route path={ROUTES.LOGIN}    element={<GuestOnlyRoute><LoginView /></GuestOnlyRoute>} />
        <Route path={ROUTES.REGISTER} element={<GuestOnlyRoute><RegisterView /></GuestOnlyRoute>} />

        {/* ── OAuth callback (no auth guard — handles the redirect) ── */}
        <Route path={ROUTES.AUTH_CALLBACK} element={<AuthCallbackView />} />

        {/* ── Chat (layout shell + nested sub-views) ── */}
        <Route
          path={ROUTES.CHAT}
          element={<ProtectedRoute><ChatView /></ProtectedRoute>}
        >
          <Route index element={<ConversationsView />} />
          <Route path="new" element={<ChatSessionView />} />
          {/* Resume a persisted conversation. ChatSessionView reads :id
              via useParams and hydrates the agent with the message log. */}
          <Route path=":id" element={<ChatSessionView />} />
        </Route>

        {/* ── Settings (2-panel layout with sidebar) ── */}
        <Route
          path={ROUTES.SETTINGS}
          element={<ProtectedRoute><SettingsLayout /></ProtectedRoute>}
        >
          {/* /settings → redirect to providers */}
          <Route index element={<Navigate to={ROUTES.SETTINGS_PROVIDERS} replace />} />
          <Route path={ROUTES.SETTINGS_PROVIDERS} element={<ProvidersView />} />
          <Route path={ROUTES.SETTINGS_FLOWS}     element={<FlowBuilderView />} />
          <Route path={ROUTES.SETTINGS_SKILLS}    element={<SkillsView />} />
          <Route path={ROUTES.SETTINGS_PROFILE}   element={<ProfileView />} />
        </Route>

        {/* ── Legacy redirects — point old standalone routes into settings ── */}
        <Route path={ROUTES.PROVIDERS}     element={<Navigate to={ROUTES.SETTINGS_PROVIDERS} replace />} />
        <Route path={ROUTES.FLOWS}         element={<Navigate to={ROUTES.SETTINGS_FLOWS}     replace />} />
        <Route path={ROUTES.FLOW_DETAIL}   element={<Navigate to={ROUTES.SETTINGS_FLOWS}     replace />} />
        <Route path={ROUTES.SKILLS}        element={<Navigate to={ROUTES.SETTINGS_SKILLS}    replace />} />
        <Route path={ROUTES.CONVERSATIONS} element={<Navigate to={ROUTES.CHAT} replace />} />

        {/* ── Design system showcase (no auth guard — dev only) ── */}
        <Route path={ROUTES.UI_FRAMEWORK} element={<UIFrameworkView />} />

        {/* ── Fallback ── */}
        <Route path="*" element={<Navigate to={ROUTES.LOGIN} replace />} />
      </Routes>
    </Suspense>
  );
}
