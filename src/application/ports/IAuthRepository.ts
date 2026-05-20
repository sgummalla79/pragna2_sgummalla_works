import type {
  AuthTokens,
  LoginPayload,
  RegisterPayload,
  SocialConnection,
  UpdateSettingsPayload,
  User,
} from '@/domain/types/auth.types';

export interface IAuthRepository {
  register(payload: RegisterPayload): Promise<User>;
  login(payload: LoginPayload): Promise<AuthTokens>;

  /** Initiates a social login by redirecting the browser to Auth0's /authorize. Never returns. */
  initiateSocialLogin(connection: string): void;

  /** Completes the OAuth callback by exchanging the code for tokens. Called from the callback route. */
  completeOAuthCallback(code: string, codeVerifier: string, redirectUri: string): Promise<AuthTokens>;

  fetchSocialConnections(): Promise<SocialConnection[]>;
  me(): Promise<User>;
  updateSettings(payload: UpdateSettingsPayload): Promise<User>;
}
