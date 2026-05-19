import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from 'vitest';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import axios from 'axios';
import { applyAuthInterceptor } from '@/infrastructure/http/authInterceptor';
import { tokenStorage } from '@/infrastructure/storage/tokenStorage';

const BASE_URL = 'http://localhost:8000';

const server = setupServer();

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => {
  server.resetHandlers();
  tokenStorage.clearAll();
  vi.clearAllMocks();
});
afterAll(() => server.close());

function makeClient(onLogout = vi.fn()) {
  const client = axios.create({ baseURL: BASE_URL });
  applyAuthInterceptor(client, onLogout);
  return { client, onLogout };
}

describe('authInterceptor: token attachment', () => {
  it('attaches Bearer token when access token is set', async () => {
    tokenStorage.setAccessToken('my-token');
    let capturedAuth: string | undefined;

    server.use(
      http.get(`${BASE_URL}/api/test`, ({ request }) => {
        capturedAuth = request.headers.get('Authorization') ?? undefined;
        return HttpResponse.json({ ok: true });
      })
    );

    const { client } = makeClient();
    await client.get('/api/test');
    expect(capturedAuth).toBe('Bearer my-token');
  });

  it('sends no Authorization header when no token is set', async () => {
    let capturedAuth: string | null = 'present';

    server.use(
      http.get(`${BASE_URL}/api/test`, ({ request }) => {
        capturedAuth = request.headers.get('Authorization');
        return HttpResponse.json({ ok: true });
      })
    );

    const { client } = makeClient();
    await client.get('/api/test');
    expect(capturedAuth).toBeNull();
  });
});

describe('authInterceptor: 401 refresh flow', () => {
  it('retries original request after successful token refresh', async () => {
    tokenStorage.setRefreshToken('valid-refresh-token');
    tokenStorage.setAccessToken('old-token');

    let callCount = 0;

    server.use(
      http.get(`${BASE_URL}/api/protected`, ({ request }) => {
        callCount++;
        const auth = request.headers.get('Authorization');
        if (auth === 'Bearer old-token') {
          return HttpResponse.json({ detail: 'Unauthorized' }, { status: 401 });
        }
        return HttpResponse.json({ data: 'success' });
      }),
      http.post(`${BASE_URL}/api/auth/refresh`, () =>
        HttpResponse.json({ access_token: 'new-token', refresh_token: 'new-refresh' })
      )
    );

    const { client } = makeClient();
    const response = await client.get('/api/protected');
    expect(response.data).toEqual({ data: 'success' });
    expect(callCount).toBe(2);
    expect(tokenStorage.getAccessToken()).toBe('new-token');
  });

  it('calls onLogout when refresh fails', async () => {
    tokenStorage.setRefreshToken('bad-refresh');
    tokenStorage.setAccessToken('old-token');

    server.use(
      http.get(`${BASE_URL}/api/protected`, () =>
        HttpResponse.json({ detail: 'Unauthorized' }, { status: 401 })
      ),
      http.post(`${BASE_URL}/api/auth/refresh`, () =>
        HttpResponse.json({ detail: 'Refresh expired' }, { status: 401 })
      )
    );

    const { client, onLogout } = makeClient();
    await expect(client.get('/api/protected')).rejects.toThrow();
    expect(onLogout).toHaveBeenCalledOnce();
    expect(tokenStorage.getAccessToken()).toBeNull();
  });

  it('does not refresh twice for concurrent 401s', async () => {
    tokenStorage.setRefreshToken('valid-refresh');
    tokenStorage.setAccessToken('old-token');

    let refreshCallCount = 0;

    server.use(
      http.get(`${BASE_URL}/api/resource`, ({ request }) => {
        const auth = request.headers.get('Authorization');
        if (auth === 'Bearer old-token') {
          return HttpResponse.json({}, { status: 401 });
        }
        return HttpResponse.json({ ok: true });
      }),
      http.post(`${BASE_URL}/api/auth/refresh`, () => {
        refreshCallCount++;
        return HttpResponse.json({ access_token: 'fresh-token', refresh_token: 'fresh-refresh' });
      })
    );

    const { client } = makeClient();
    await Promise.all([client.get('/api/resource'), client.get('/api/resource')]);
    expect(refreshCallCount).toBe(1);
  });
});
