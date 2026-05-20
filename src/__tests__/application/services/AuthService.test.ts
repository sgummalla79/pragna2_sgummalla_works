import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AuthService } from '@/application/services/AuthService';
import type { IAuthRepository } from '@/application/ports/IAuthRepository';
import { tokenStorage } from '@/infrastructure/storage/tokenStorage';

const mockUser = {
  id: 'user-1',
  email: 'test@example.com',
  name: 'Test User',
  identityProvider: 'local',
  settings: {},
};

const mockTokens = {
  accessToken: 'access-abc',
};

function makeRepo(overrides: Partial<IAuthRepository> = {}): IAuthRepository {
  return {
    register: vi.fn().mockResolvedValue(mockUser),
    login: vi.fn().mockResolvedValue(mockTokens),
    initiateSocialLogin: vi.fn(),
    completeOAuthCallback: vi.fn().mockResolvedValue(mockTokens),
    fetchSocialConnections: vi.fn().mockResolvedValue([]),
    me: vi.fn().mockResolvedValue(mockUser),
    updateSettings: vi.fn().mockResolvedValue(mockUser),
    ...overrides,
  };
}

beforeEach(() => {
  tokenStorage.clearAll();
});

describe('AuthService.login', () => {
  it('calls repository login and then me, storing tokens', async () => {
    const repo = makeRepo();
    const service = new AuthService(repo);

    const result = await service.login({ email: 'test@example.com', password: 'pass' });

    expect(repo.login).toHaveBeenCalledWith({ email: 'test@example.com', password: 'pass' });
    expect(repo.me).toHaveBeenCalledOnce();
    expect(result.user).toEqual(mockUser);
    expect(result.tokens).toEqual(mockTokens);
    expect(tokenStorage.getAccessToken()).toBe('access-abc');
  });

  it('propagates error if repository login fails', async () => {
    const repo = makeRepo({ login: vi.fn().mockRejectedValue(new Error('bad creds')) });
    const service = new AuthService(repo);

    await expect(service.login({ email: 'x', password: 'y' })).rejects.toThrow('bad creds');
    expect(tokenStorage.getAccessToken()).toBeNull();
  });
});

describe('AuthService.me', () => {
  it('delegates to repository.me', async () => {
    const repo = makeRepo();
    const service = new AuthService(repo);
    const user = await service.me();
    expect(repo.me).toHaveBeenCalledOnce();
    expect(user).toEqual(mockUser);
  });
});

describe('AuthService.logout', () => {
  it('clears token storage', () => {
    tokenStorage.setAccessToken('tok');
    const service = new AuthService(makeRepo());

    service.logout();

    expect(tokenStorage.getAccessToken()).toBeNull();
  });
});

describe('AuthService.register', () => {
  it('delegates to repository.register', async () => {
    const repo = makeRepo();
    const service = new AuthService(repo);
    const user = await service.register({ email: 'new@example.com', password: 'pass1234' });
    expect(repo.register).toHaveBeenCalledWith({ email: 'new@example.com', password: 'pass1234' });
    expect(user).toEqual(mockUser);
  });
});
