const REFRESH_TOKEN_KEY = 'pragna_rt';

let _accessToken: string | null = null;

export const tokenStorage = {
  getAccessToken(): string | null {
    return _accessToken;
  },

  setAccessToken(token: string): void {
    _accessToken = token;
  },

  clearAccessToken(): void {
    _accessToken = null;
  },

  getRefreshToken(): string | null {
    try {
      return sessionStorage.getItem(REFRESH_TOKEN_KEY);
    } catch {
      return null;
    }
  },

  setRefreshToken(token: string): void {
    try {
      sessionStorage.setItem(REFRESH_TOKEN_KEY, token);
    } catch {
      // sessionStorage unavailable (private browsing restrictions)
    }
  },

  clearRefreshToken(): void {
    try {
      sessionStorage.removeItem(REFRESH_TOKEN_KEY);
    } catch {
      // ignore
    }
  },

  clearAll(): void {
    _accessToken = null;
    try {
      sessionStorage.removeItem(REFRESH_TOKEN_KEY);
    } catch {
      // ignore
    }
  },
};
