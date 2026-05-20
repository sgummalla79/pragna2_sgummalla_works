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

describe('authInterceptor: 401 handling', () => {
  it('calls onLogout and clears tokens on 401', async () => {
    tokenStorage.setAccessToken('expired-token');

    server.use(
      http.get(`${BASE_URL}/api/protected`, () =>
        HttpResponse.json({ detail: 'Unauthorized' }, { status: 401 })
      )
    );

    const { client, onLogout } = makeClient();
    await expect(client.get('/api/protected')).rejects.toThrow();
    expect(onLogout).toHaveBeenCalledOnce();
    expect(tokenStorage.getAccessToken()).toBeNull();
  });

  it('passes through non-401 errors unchanged', async () => {
    server.use(
      http.get(`${BASE_URL}/api/resource`, () =>
        HttpResponse.json({ detail: 'Not found' }, { status: 404 })
      )
    );

    const { client, onLogout } = makeClient();
    await expect(client.get('/api/resource')).rejects.toThrow();
    expect(onLogout).not.toHaveBeenCalled();
  });
});
