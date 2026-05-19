import type { AxiosInstance, InternalAxiosRequestConfig } from 'axios';
import axios from 'axios';
import { API_BASE_URL, REFRESH_TOKEN_PATH } from '@/constants/api';
import { tokenStorage } from '@/infrastructure/storage/tokenStorage';
import { logger } from '@/infrastructure/logging/logger';

const AUTH_HEADER = 'Authorization';

let refreshPromise: Promise<string> | null = null;

async function doRefresh(): Promise<string> {
  const refreshToken = tokenStorage.getRefreshToken();
  if (!refreshToken) throw new Error('No refresh token available');

  const response = await axios.post<{ access_token: string; refresh_token: string }>(
    `${API_BASE_URL}${REFRESH_TOKEN_PATH}`,
    { refresh_token: refreshToken },
    { headers: { 'Content-Type': 'application/json' } }
  );

  const { access_token, refresh_token } = response.data;
  tokenStorage.setAccessToken(access_token);
  tokenStorage.setRefreshToken(refresh_token);
  return access_token;
}

export function applyAuthInterceptor(
  client: AxiosInstance,
  onLogout: () => void
): void {
  client.interceptors.request.use((config: InternalAxiosRequestConfig) => {
    const token = tokenStorage.getAccessToken();
    if (token) {
      config.headers.set(AUTH_HEADER, `Bearer ${token}`);
    }
    return config;
  });

  client.interceptors.response.use(
    (response) => response,
    async (error: unknown) => {
      if (!axios.isAxiosError(error)) return Promise.reject(error);
      const originalConfig = error.config as InternalAxiosRequestConfig & { _retry?: boolean };
      if (error.response?.status !== 401 || originalConfig._retry) {
        return Promise.reject(error);
      }

      originalConfig._retry = true;

      try {
        logger.info('auth:refresh:triggered');
        if (!refreshPromise) {
          refreshPromise = doRefresh().finally(() => {
            refreshPromise = null;
          });
        }
        const newToken = await refreshPromise;
        logger.info('auth:refresh:succeeded');
        originalConfig.headers.set(AUTH_HEADER, `Bearer ${newToken}`);
        return client(originalConfig);
      } catch {
        logger.warn('auth:refresh:failed');
        tokenStorage.clearAll();
        onLogout();
        return Promise.reject(error);
      }
    }
  );
}
