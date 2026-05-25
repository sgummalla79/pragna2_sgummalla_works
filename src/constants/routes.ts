export const ROUTES = {
  // ── Auth ─────────────────────────────────────────────────────────────────
  LOGIN:          '/login',
  REGISTER:       '/register',
  AUTH_CALLBACK:  '/auth-callback',

  // ── Main ─────────────────────────────────────────────────────────────────
  CHAT:           '/chat',

  // ── Settings ─────────────────────────────────────────────────────────────
  // Models do not have a top-level page — they are managed inside the
  // provider modal on /settings/providers (auto-discovered + edited
  // inline via the bulk PATCH endpoint).
  SETTINGS:             '/settings',
  SETTINGS_APPEARANCE:  '/settings/appearance',
  SETTINGS_PROVIDERS:   '/settings/providers',
  SETTINGS_AGENTS:           '/settings/agents',
  SETTINGS_AGENT_EDITOR_NEW: '/settings/agents/new',
  SETTINGS_AGENT_EDITOR:     '/settings/agents/:agentId/edit',
  SETTINGS_FLOWS:           '/settings/flows',
  SETTINGS_FLOW_EDITOR_NEW: '/settings/flows/new',
  SETTINGS_FLOW_EDITOR:     '/settings/flows/:flowId/edit',
  SETTINGS_SKILLS:    '/settings/skills',
  /** Wedge B.2 — MCP server registrations + per-tool toggle. */
  SETTINGS_MCP_SERVERS: '/settings/mcp-servers',
  SETTINGS_PROFILE:   '/settings/profile',

  // ── Dev / Design system ───────────────────────────────────────────────────
  UI_FRAMEWORK:  '/ui',

  // ── Legacy (kept for any existing links) ─────────────────────────────────
  PROVIDERS:     '/providers',
  FLOWS:         '/flows',
  FLOW_DETAIL:   '/flows/:flowId',
  SKILLS:        '/skills',
  CONVERSATIONS: '/conversations',
} as const;

export type AppRoute = (typeof ROUTES)[keyof typeof ROUTES];
