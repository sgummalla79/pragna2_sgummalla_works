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
const ChatLandingView   = lazy(() => import('@/presentation/views/chat/ChatLandingView'));
const ChatSessionView   = lazy(() => import('@/presentation/views/chat/ChatSessionView'));

// ── Settings sections ────────────────────────────────────────────────────────
const AppearanceView   = lazy(() => import('@/presentation/views/settings/AppearanceView/AppearanceView'));
const ProvidersView    = lazy(() => import('@/presentation/views/settings/ProvidersView/ProvidersView'));
const AgentsView       = lazy(() => import('@/presentation/views/settings/AgentsView/AgentsView'));
const AgentEditorView  = lazy(() => import('@/presentation/views/settings/AgentsView/AgentEditorView'));
const FlowBuilderView  = lazy(() => import('@/presentation/views/settings/FlowBuilderView/FlowBuilderView'));
const FlowEditorView   = lazy(() => import('@/presentation/views/settings/FlowEditorView/FlowEditorView'));
const SkillsView       = lazy(() => import('@/presentation/views/settings/SkillsView/SkillsView'));
const McpServersView   = lazy(() => import('@/presentation/views/settings/McpServersView/McpServersView'));
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
          {/* /chat → landing: personalised greeting + centred composer.
              Sending a message from here generates a fresh UUID, stashes
              the text in sessionStorage, and navigates to /chat/{uuid}
              where ChatSessionView picks up the handoff. */}
          <Route index element={<ChatLandingView />} />
          {/* Legacy redirect: /chat/new used to be the active chat
              surface before the landing existed. Bounce back to the
              landing so any stale bookmark still lands somewhere useful. */}
          <Route path="new" element={<Navigate to={ROUTES.CHAT} replace />} />
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
          <Route path={ROUTES.SETTINGS_PROVIDERS}  element={<ProvidersView />} />
          <Route path={ROUTES.SETTINGS_APPEARANCE}        element={<AppearanceView />} />
          <Route path={ROUTES.SETTINGS_AGENTS}            element={<AgentsView />} />
          <Route path={ROUTES.SETTINGS_AGENT_EDITOR_NEW}  element={<AgentEditorView />} />
          <Route path={ROUTES.SETTINGS_AGENT_EDITOR}      element={<AgentEditorView />} />
          <Route path={ROUTES.SETTINGS_FLOWS}           element={<FlowBuilderView />} />
          <Route path={ROUTES.SETTINGS_FLOW_EDITOR_NEW} element={<FlowEditorView />} />
          <Route path={ROUTES.SETTINGS_FLOW_EDITOR}     element={<FlowEditorView />} />
          <Route path={ROUTES.SETTINGS_SKILLS}          element={<SkillsView />} />
          <Route path={ROUTES.SETTINGS_MCP_SERVERS}     element={<McpServersView />} />
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
