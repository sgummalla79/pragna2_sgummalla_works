import type { IAuthRepository } from '@/application/ports/IAuthRepository';
import type {
  AuthTokens,
  LoginPayload,
  RegisterPayload,
  UpdateSettingsPayload,
  User,
} from '@/domain/types/auth.types';
import { tokenStorage } from '@/infrastructure/storage/tokenStorage';

export class AuthService {
  constructor(private readonly authRepository: IAuthRepository) {}

  async register(payload: RegisterPayload): Promise<User> {
    return this.authRepository.register(payload);
  }

  async login(payload: LoginPayload): Promise<{ user: User; tokens: AuthTokens }> {
    const tokens = await this.authRepository.login(payload);
    tokenStorage.setAccessToken(tokens.accessToken);
    tokenStorage.setRefreshToken(tokens.refreshToken);
    const user = await this.authRepository.me();
    return { user, tokens };
  }

  async me(): Promise<User> {
    return this.authRepository.me();
  }

  async updateSettings(payload: UpdateSettingsPayload): Promise<User> {
    return this.authRepository.updateSettings(payload);
  }

  logout(): void {
    tokenStorage.clearAll();
  }
}
