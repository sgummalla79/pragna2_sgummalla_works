import type {
  AuthTokens,
  LoginPayload,
  RegisterPayload,
  RefreshPayload,
  UpdateSettingsPayload,
  User,
} from '@/domain/types/auth.types';

export interface IAuthRepository {
  register(payload: RegisterPayload): Promise<User>;
  login(payload: LoginPayload): Promise<AuthTokens>;
  refresh(payload: RefreshPayload): Promise<AuthTokens>;
  me(): Promise<User>;
  updateSettings(payload: UpdateSettingsPayload): Promise<User>;
}
