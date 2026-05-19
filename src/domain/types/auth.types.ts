export interface User {
  id: string;
  email: string;
  name: string | null;
  identityProvider: string;
  settings: UserSettings;
}

export interface UserSettings {
  theme?: string;
  defaultFlowId?: string;
  [key: string]: unknown;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface LoginPayload {
  email: string;
  password: string;
}

export interface RegisterPayload {
  email: string;
  password: string;
  name?: string;
}

export interface RefreshPayload {
  refreshToken: string;
}

export interface UpdateSettingsPayload {
  settings: UserSettings;
}
