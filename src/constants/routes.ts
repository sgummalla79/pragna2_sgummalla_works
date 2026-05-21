export const ROUTES = {
  // ── Auth ─────────────────────────────────────────────────────────────────
  LOGIN:          '/login',
  REGISTER:       '/register',
  AUTH_CALLBACK:  '/auth-callback',

  // ── Main ─────────────────────────────────────────────────────────────────
  CHAT:           '/chat',

  // ── Settings ─────────────────────────────────────────────────────────────
  SETTINGS:           '/settings',
  SETTINGS_PROVIDERS: '/settings/providers',
  SETTINGS_MODELS:    '/settings/models',
  SETTINGS_FLOWS:     '/settings/flows',
  SETTINGS_SKILLS:    '/settings/skills',
  SETTINGS_PROFILE:   '/settings/profile',

  // ── Dev / Design system ───────────────────────────────────────────────────
  UI_FRAMEWORK:  '/ui',

  // ── Legacy (kept for any existing links) ─────────────────────────────────
  PROVIDERS:     '/providers',
  MODELS:        '/models',
  FLOWS:         '/flows',
  FLOW_DETAIL:   '/flows/:flowId',
  SKILLS:        '/skills',
  CONVERSATIONS: '/conversations',
} as const;

export type AppRoute = (typeof ROUTES)[keyof typeof ROUTES];
