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

interface ApiUserResponse {
  id: string;
  email: string;
  name: string | null;
  identity_provider: string;
  settings?: Record<string, unknown>;
}

interface ApiTokenResponse {
  access_token: string;
}

function mapUser(raw: ApiUserResponse): User {
  return {
    id: raw.id,
    email: raw.email,
    name: raw.name,
    identityProvider: raw.identity_provider,
    settings: raw.settings ?? {},
  };
}

/** Local (email/password) auth repository — used when AUTH_STRATEGY=local. */
export class AuthRepository implements IAuthRepository {
  constructor(private readonly http: AxiosInstance) {}

  async register(payload: RegisterPayload): Promise<User> {
    // POST /api/users creates a new user account (CLAUDE.md §9 — register
    // is creation of a User resource, not an action on auth).
    const { data } = await this.http.post<ApiUserResponse>('/api/users', {
      email: payload.email, password: payload.password, name: payload.name,
    });
    return mapUser(data);
  }

  async login(payload: LoginPayload): Promise<AuthTokens> {
    // POST /api/auth/sessions creates a session (login). Returns 201.
    const { data } = await this.http.post<ApiTokenResponse>('/api/auth/sessions', {
      email: payload.email, password: payload.password,
    });
    return { accessToken: data.access_token };
  }

  initiateSocialLogin(_connection: string): void {
    throw new Error('Social login is not supported with the local auth strategy.');
  }

  async completeOAuthCallback(_code: string, _codeVerifier: string, _redirectUri: string): Promise<AuthTokens> {
    throw new Error('OAuth callback is not supported with the local auth strategy.');
  }

  async fetchSocialConnections(): Promise<SocialConnection[]> {
    return [];
  }

  async me(): Promise<User> {
    const { data } = await this.http.get<ApiUserResponse>('/api/auth/me');
    return mapUser(data);
  }

  async updateSettings(payload: UpdateSettingsPayload): Promise<User> {
    const { data } = await this.http.patch<ApiUserResponse>('/api/auth/me/settings', {
      settings: payload.settings,
    });
    return mapUser(data);
  }
}
