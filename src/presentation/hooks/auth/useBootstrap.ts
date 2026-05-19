import { useEffect } from 'react';
import { useAuthStore } from '@/presentation/store/authStore';
import { useServices } from '@/presentation/providers/ServiceContext';
import { tokenStorage } from '@/infrastructure/storage/tokenStorage';

export function useBootstrap(): void {
  const setUser = useAuthStore((s) => s.setUser);
  const setBootstrapped = useAuthStore((s) => s.setBootstrapped);
  const bootstrapped = useAuthStore((s) => s.bootstrapped);
  const setAccessToken = useAuthStore((s) => s.setAccessToken);
  const { authService } = useServices();

  useEffect(() => {
    if (bootstrapped) return;

    const refreshToken = tokenStorage.getRefreshToken();
    if (!refreshToken) {
      setBootstrapped(true);
      return;
    }

    authService
      .me()
      .then((user) => {
        const accessToken = tokenStorage.getAccessToken();
        setAccessToken(accessToken);
        setUser(user);
      })
      .catch(() => {
        tokenStorage.clearAll();
        setUser(null);
      })
      .finally(() => {
        setBootstrapped(true);
      });
  }, [bootstrapped, authService, setUser, setBootstrapped, setAccessToken]);
}
