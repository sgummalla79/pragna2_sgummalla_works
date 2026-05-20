/**
 * Centralised error catalog.
 *
 * Every user-facing error and every loggable error condition in the application
 * is defined here. Use the code for log correlation, the message for UI display.
 *
 * Prefixes
 *   AUTH  – authentication / session
 *   PRV   – LLM provider management
 *   MDL   – model management
 *   FLW   – flow (pipeline) management
 *   SKL   – skill management
 *   CNV   – conversation / usage
 *   CHT   – chat interface
 *   NET   – network / HTTP layer
 */

export const ERRORS = {
  // ── Authentication ────────────────────────────────────────────────────────
  AUTH_001: { code: 'AUTH_001', message: 'No active session. Please sign in.', severity: 'warn' },
  AUTH_002: { code: 'AUTH_002', message: 'Unable to read your profile from the sign-in token.', severity: 'error' },
  AUTH_003: { code: 'AUTH_003', message: 'Session refresh failed. Please sign in again.', severity: 'warn' },
  AUTH_004: { code: 'AUTH_004', message: 'Popup blocked. Allow popups for this site and try again.', severity: 'warn' },
  AUTH_005: { code: 'AUTH_005', message: 'Sign-in was cancelled.', severity: 'info' },
  AUTH_006: { code: 'AUTH_006', message: 'Social sign-in failed. Please try again.', severity: 'error' },
  AUTH_007: { code: 'AUTH_007', message: 'Invalid email or password.', severity: 'warn' },
  AUTH_008: { code: 'AUTH_008', message: 'Registration failed. This email may already be in use.', severity: 'warn' },
  AUTH_009: { code: 'AUTH_009', message: 'Sign-in timed out. Please try again.', severity: 'warn' },
  AUTH_010: { code: 'AUTH_010', message: 'Token exchange failed. Please try again.', severity: 'error' },

  // ── Providers ─────────────────────────────────────────────────────────────
  PRV_001: { code: 'PRV_001', message: 'Failed to load providers.', severity: 'error' },
  PRV_002: { code: 'PRV_002', message: 'This provider is already registered.', severity: 'warn' },
  PRV_003: { code: 'PRV_003', message: 'Failed to add provider. Check your API key and try again.', severity: 'error' },
  PRV_004: { code: 'PRV_004', message: 'Failed to remove provider.', severity: 'error' },

  // ── Models ────────────────────────────────────────────────────────────────
  MDL_001: { code: 'MDL_001', message: 'Failed to load models.', severity: 'error' },
  MDL_002: { code: 'MDL_002', message: 'Failed to register model.', severity: 'error' },
  MDL_003: { code: 'MDL_003', message: 'Failed to remove model.', severity: 'error' },

  // ── Flows ─────────────────────────────────────────────────────────────────
  FLW_001: { code: 'FLW_001', message: 'Failed to load flows.', severity: 'error' },
  FLW_002: { code: 'FLW_002', message: 'A flow with this name already exists.', severity: 'warn' },
  FLW_003: { code: 'FLW_003', message: 'Failed to create flow.', severity: 'error' },
  FLW_004: { code: 'FLW_004', message: 'Failed to delete flow.', severity: 'error' },
  FLW_005: { code: 'FLW_005', message: 'Failed to add node to flow.', severity: 'error' },
  FLW_006: { code: 'FLW_006', message: 'Failed to add edge to flow.', severity: 'error' },

  // ── Skills ────────────────────────────────────────────────────────────────
  SKL_001: { code: 'SKL_001', message: 'Failed to load skills.', severity: 'error' },
  SKL_002: { code: 'SKL_002', message: 'Failed to create skill.', severity: 'error' },
  SKL_003: { code: 'SKL_003', message: 'Failed to remove skill.', severity: 'error' },

  // ── Conversations ─────────────────────────────────────────────────────────
  CNV_001: { code: 'CNV_001', message: 'Failed to load conversations.', severity: 'error' },
  CNV_002: { code: 'CNV_002', message: 'Failed to load usage details.', severity: 'error' },

  // ── Chat ──────────────────────────────────────────────────────────────────
  CHT_001: { code: 'CHT_001', message: 'No LLM provider connected. Add a provider to start chatting.', severity: 'warn' },
  CHT_002: { code: 'CHT_002', message: 'No model configured. Add a model to start chatting.', severity: 'warn' },
  CHT_003: { code: 'CHT_003', message: 'Chat is unavailable. Check your provider and model configuration.', severity: 'error' },

  // ── Network / HTTP ────────────────────────────────────────────────────────
  NET_401: { code: 'NET_401', message: 'Your session has expired. Please sign in again.', severity: 'warn' },
  NET_403: { code: 'NET_403', message: 'You do not have permission to perform this action.', severity: 'warn' },
  NET_404: { code: 'NET_404', message: 'The requested resource was not found.', severity: 'warn' },
  NET_409: { code: 'NET_409', message: 'This resource already exists.', severity: 'warn' },
  NET_500: { code: 'NET_500', message: 'A server error occurred. Please try again later.', severity: 'error' },
} as const;

export type ErrorCode = keyof typeof ERRORS;
export type ErrorEntry = typeof ERRORS[ErrorCode];
