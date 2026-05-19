import type { AxiosInstance } from 'axios';
import type { IAuthRepository } from '@/application/ports/IAuthRepository';
import type {
  AuthTokens,
  LoginPayload,
  RefreshPayload,
  RegisterPayload,
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
  refresh_token: string;
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

function mapTokens(raw: ApiTokenResponse): AuthTokens {
  return {
    accessToken: raw.access_token,
    refreshToken: raw.refresh_token,
  };
}

export class AuthRepository implements IAuthRepository {
  constructor(private readonly http: AxiosInstance) {}

  async register(payload: RegisterPayload): Promise<User> {
    const { data } = await this.http.post<ApiUserResponse>('/api/auth/register', {
      email: payload.email,
      password: payload.password,
      name: payload.name,
    });
    return mapUser(data);
  }

  async login(payload: LoginPayload): Promise<AuthTokens> {
    const { data } = await this.http.post<ApiTokenResponse>('/api/auth/login', {
      email: payload.email,
      password: payload.password,
    });
    return mapTokens(data);
  }

  async refresh(payload: RefreshPayload): Promise<AuthTokens> {
    const { data } = await this.http.post<ApiTokenResponse>('/api/auth/refresh', {
      refresh_token: payload.refreshToken,
    });
    return mapTokens(data);
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
