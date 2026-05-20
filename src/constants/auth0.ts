// All import.meta.env reads for Auth0 are centralised here — no other file may access them.

export const AUTH0_DOMAIN = import.meta.env.VITE_AUTH0_DOMAIN ?? '';
export const AUTH0_CLIENT_ID = import.meta.env.VITE_AUTH0_CLIENT_ID ?? '';
export const AUTH0_AUDIENCE = import.meta.env.VITE_AUTH0_AUDIENCE ?? '';

export const AUTH0_SCOPE = 'openid profile email offline_access';

// sessionStorage keys used to carry PKCE state across the redirect → callback round-trip
export const PKCE_VERIFIER_KEY = 'pragna_pkce_verifier';
export const PKCE_STATE_KEY    = 'pragna_pkce_state';

// Auth0's fixed name for the built-in email/password database connection.
// This is a well-known Auth0 constant, not a deployment variable.
export const AUTH0_DB_CONNECTION = 'Username-Password-Authentication';

// Path in this SPA that the OAuth popup is redirected to after Auth0 authorises the user.
export const AUTH0_CALLBACK_PATH = '/auth-callback';

// Strategies that identify a social or enterprise connection (not a local database connection).
export const SOCIAL_STRATEGIES = new Set([
  'google-oauth2',
  'github',
  'twitter',
  'facebook',
  'apple',
  'microsoft',
  'linkedin',
  'windowslive',
  'yahoo',
  'salesforce',
  'salesforce-sandbox',
  'waad',  // Azure AD
  'adfs',
  'oauth2',
  'samlp',
  'oidc',
]);

export const SOCIAL_DISPLAY_NAMES: Record<string, string> = {
  'google-oauth2': 'Google',
  'github': 'GitHub',
  'twitter': 'Twitter / X',
  'facebook': 'Facebook',
  'apple': 'Apple',
  'microsoft': 'Microsoft',
  'linkedin': 'LinkedIn',
  'windowslive': 'Microsoft',
  'yahoo': 'Yahoo',
  'salesforce': 'Salesforce',
  'salesforce-sandbox': 'Salesforce Sandbox',
  'waad': 'Azure AD',
  'adfs': 'ADFS',
};
