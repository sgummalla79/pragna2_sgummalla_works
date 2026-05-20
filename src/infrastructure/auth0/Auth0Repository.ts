import type { AxiosInstance } from 'axios';
import type { IAuthRepository } from '@/application/ports/IAuthRepository';
import type {
  AuthTokens,
  LoginPayload,
  RegisterPayload,
  SocialConnection,
  UpdateSettingsPayload,
  User,
} from '@/domain/types/auth.types';
import { userFromIdToken } from '@/domain/utils/parseJwt';
import { tokenStorage } from '@/infrastructure/storage/tokenStorage';
import { ERRORS } from '@/constants/errors';
import { PragnaError } from '@/domain/errors/PragnaError';
import {
  AUTH0_AUDIENCE,
  AUTH0_CALLBACK_PATH,
  AUTH0_CLIENT_ID,
  AUTH0_DB_CONNECTION,
  AUTH0_DOMAIN,
  AUTH0_SCOPE,
  PKCE_VERIFIER_KEY,
  PKCE_STATE_KEY,
  SOCIAL_DISPLAY_NAMES,
  SOCIAL_STRATEGIES,
} from '@/constants/auth0';
import { generateCodeChallenge, generateCodeVerifier } from './auth0Pkce';

interface Auth0ClientConfig {
  strategies?: Array<{ name: string; connections: Array<{ name: string }> }>;
  connections?: Array<{ name: string; strategy?: string }>;
}

interface Auth0TokenResponse {
  access_token: string;
  id_token?: string;
}

export class Auth0Repository implements IAuthRepository {
  private readonly domain   = AUTH0_DOMAIN;
  private readonly clientId = AUTH0_CLIENT_ID;
  private readonly audience = AUTH0_AUDIENCE;
  private readonly dbConn   = AUTH0_DB_CONNECTION;

  constructor(private readonly http: AxiosInstance) {}

  // ── Register ──────────────────────────────────────────────────────────────

  async register(payload: RegisterPayload): Promise<User> {
    const res = await fetch(`https://${this.domain}/dbconnections/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id:  this.clientId,
        connection: this.dbConn,
        email:      payload.email,
        password:   payload.password,
        ...(payload.name ? { given_name: payload.name } : {}),
      }),
    });
    if (!res.ok) {
      const b = await res.json().catch(() => ({}));
      throw new Error((b as { description?: string }).description ?? 'Registration failed');
    }
    return { id: '', email: payload.email, name: payload.name ?? null, identityProvider: 'auth0', settings: {} };
  }

  // ── Email / Password (ROPG) ───────────────────────────────────────────────

  async login(payload: LoginPayload): Promise<AuthTokens> {
    const res = await fetch(`https://${this.domain}/oauth/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        grant_type: 'password',
        client_id:  this.clientId,
        username:   payload.email,
        password:   payload.password,
        audience:   this.audience,
        scope:      AUTH0_SCOPE,
      }),
    });
    if (!res.ok) {
      const b = await res.json().catch(() => ({}));
      throw new Error((b as { error_description?: string }).error_description ?? 'Login failed');
    }
    const data = (await res.json()) as Auth0TokenResponse;
    return { accessToken: data.access_token, idToken: data.id_token };
  }

  // ── Social login — full-page redirect with PKCE ───────────────────────────
  // Redirecting keeps the Auth0 session cookie in the main browser context
  // so consent is only shown once. Popups lose the session on close.

  initiateSocialLogin(connection: string): void {
    const codeVerifier = generateCodeVerifier();
    const state = crypto.randomUUID();
    sessionStorage.setItem(PKCE_VERIFIER_KEY, codeVerifier);
    sessionStorage.setItem(PKCE_STATE_KEY, state);

    generateCodeChallenge(codeVerifier).then((codeChallenge) => {
      const redirectUri = `${window.location.origin}${AUTH0_CALLBACK_PATH}`;
      const params = new URLSearchParams({
        response_type:         'code',
        client_id:             this.clientId,
        connection,
        redirect_uri:          redirectUri,
        scope:                 AUTH0_SCOPE,
        audience:              this.audience,
        state,
        code_challenge:        codeChallenge,
        code_challenge_method: 'S256',
      });
      window.location.href = `https://${this.domain}/authorize?${params.toString()}`;
    });
  }

  // ── OAuth callback — exchange code for session token ─────────────────────

  async completeOAuthCallback(
    code: string,
    codeVerifier: string,
    redirectUri: string
  ): Promise<AuthTokens> {
    const res = await fetch(`https://${this.domain}/oauth/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        grant_type:    'authorization_code',
        client_id:     this.clientId,
        code,
        code_verifier: codeVerifier,
        redirect_uri:  redirectUri,
      }),
    });
    if (!res.ok) throw new PragnaError(ERRORS.AUTH_010);
    const data = (await res.json()) as Auth0TokenResponse;
    return { accessToken: data.access_token, idToken: data.id_token };
  }

  // ── Social connections — JSONP (no CORS issues) ───────────────────────────

  fetchSocialConnections(): Promise<SocialConnection[]> {
    return new Promise<SocialConnection[]>((resolve) => {
      const script = document.createElement('script');
      const prev = (window as unknown as Record<string, unknown>).Auth0;
      (window as unknown as Record<string, unknown>).Auth0 = {
        setClient: (config: Auth0ClientConfig) => {
          (window as unknown as Record<string, unknown>).Auth0 = prev;
          script.remove();
          resolve(this.parseSocialConnections(config));
        },
      };
      script.src = `https://${this.domain}/client/${this.clientId}.js`;
      script.onerror = () => { (window as unknown as Record<string, unknown>).Auth0 = prev; script.remove(); resolve([]); };
      document.head.appendChild(script);
    });
  }

  private parseSocialConnections(config: Auth0ClientConfig): SocialConnection[] {
    if (config.strategies?.length) {
      return config.strategies
        .filter((s) => SOCIAL_STRATEGIES.has(s.name))
        .flatMap((s) => s.connections.map((c) => ({
          name: c.name, strategy: s.name, displayName: SOCIAL_DISPLAY_NAMES[s.name] ?? s.name,
        })));
    }
    if (config.connections?.length) {
      return config.connections
        .filter((c) => SOCIAL_STRATEGIES.has(c.strategy ?? c.name))
        .map((c) => {
          const strategy = c.strategy ?? c.name;
          return { name: c.name, strategy, displayName: SOCIAL_DISPLAY_NAMES[strategy] ?? strategy };
        });
    }
    return [];
  }

  // ── User profile ──────────────────────────────────────────────────────────
  // Decode from the stored ID token (no network). Fall back to Auth0's
  // /userinfo endpoint using the access token — covers the case where the
  // token exchange did not include an id_token.

  async me(): Promise<User> {
    const idToken = tokenStorage.getIdToken();
    if (idToken) {
      const user = userFromIdToken(idToken);
      if (user) return user;
    }
    const accessToken = tokenStorage.getAccessToken();
    if (!accessToken) throw new PragnaError(ERRORS.AUTH_001);
    return this.fetchUserInfo(accessToken);
  }

  private async fetchUserInfo(accessToken: string): Promise<User> {
    const res = await fetch(`https://${this.domain}/userinfo`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) throw new PragnaError(ERRORS.AUTH_001);
    const d = await res.json() as Record<string, unknown>;
    const sub = (d.sub as string) ?? '';
    return {
      id:               sub,
      email:            (d.email as string | undefined) ?? '',
      name:             (d.name as string | undefined) ?? (d.nickname as string | undefined) ?? null,
      identityProvider: sub.split('|')[0],
      settings:         {},
    };
  }

  async updateSettings(payload: UpdateSettingsPayload): Promise<User> {
    await this.http.patch('/api/auth/me/settings', { settings: payload.settings });
    return this.me();
  }
}
