import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/presentation/store/authStore';
import { useServices } from '@/presentation/providers/ServiceContext';
import { ROUTES } from '@/constants/routes';
import { AUTH0_CALLBACK_PATH, PKCE_STATE_KEY, PKCE_VERIFIER_KEY } from '@/constants/auth0';
import { logger } from '@/infrastructure/logging/logger';

/**
 * Handles the Auth0 redirect callback after social login.
 *
 * Auth0 redirects here with ?code=…&state=… after the user authenticates.
 * This page reads the PKCE verifier from sessionStorage (stored before the
 * redirect in Auth0Repository.initiateSocialLogin), exchanges the code for
 * tokens, updates the auth store, and navigates into the app.
 *
 * Why full-page redirect instead of popup:
 *   Auth0 sets a session cookie in the main browser context on redirect.
 *   Subsequent logins find the existing session and skip consent — the
 *   popup approach created a fresh isolated context every time, causing
 *   the consent screen to appear on every login.
 */
export default function AuthCallbackView() {
  const navigate = useNavigate();
  const setUser = useAuthStore((s) => s.setUser);
  const setAccessToken = useAuthStore((s) => s.setAccessToken);
  const { authService } = useServices();
  const handled = useRef(false);

  useEffect(() => {
    if (handled.current) return;
    handled.current = true;

    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    const state = params.get('state');
    const error = params.get('error');
    const errorDescription = params.get('error_description');

    // Auth0 returned an error — show it on the login page
    if (error) {
      logger.warn('auth:callback:error', { errorCode: 'AUTH_006' });
      navigate(`${ROUTES.LOGIN}?error=${encodeURIComponent(errorDescription ?? error)}`, { replace: true });
      return;
    }

    if (!code) {
      navigate(ROUTES.LOGIN, { replace: true });
      return;
    }

    // Recover the PKCE verifier and validate state to prevent CSRF
    const storedState = sessionStorage.getItem(PKCE_STATE_KEY);
    const codeVerifier = sessionStorage.getItem(PKCE_VERIFIER_KEY);
    sessionStorage.removeItem(PKCE_STATE_KEY);
    sessionStorage.removeItem(PKCE_VERIFIER_KEY);

    if (!codeVerifier || storedState !== state) {
      logger.warn('auth:callback:state-mismatch', { errorCode: 'AUTH_006' });
      navigate(ROUTES.LOGIN, { replace: true });
      return;
    }

    const redirectUri = `${window.location.origin}${AUTH0_CALLBACK_PATH}`;

    authService
      .completeOAuthLogin(code, codeVerifier, redirectUri)
      .then(({ user, tokens }) => {
        setAccessToken(tokens.accessToken);
        setUser(user);
        navigate(ROUTES.SETTINGS, { replace: true });
      })
      .catch((err) => {
        logger.fromError('auth:callback:exchange-failed', err);
        navigate(ROUTES.LOGIN, { replace: true });
      });
  }, [navigate, setUser, setAccessToken, authService]);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="flex items-center gap-3 text-muted-foreground">
        <span
          className="h-5 w-5 animate-spin rounded-full border-2 border-muted border-t-[var(--color-primary)]"
          aria-hidden="true"
        />
        <span className="text-sm">Completing sign-in…</span>
      </div>
    </div>
  );
}
