import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import axios from 'axios';
import { AuthRepository } from '@/infrastructure/repositories/AuthRepository';

const BASE_URL = 'http://localhost:8000';

const server = setupServer(
  http.post(`${BASE_URL}/api/auth/sessions`, () =>
    HttpResponse.json({ access_token: 'test-access-token' })
  ),
  http.post(`${BASE_URL}/api/users`, () =>
    HttpResponse.json(
      { id: 'user-1', email: 'test@example.com', name: 'Test User', identity_provider: 'local', settings: {} },
      { status: 201 }
    )
  ),
  http.get(`${BASE_URL}/api/auth/me`, () =>
    HttpResponse.json({
      id: 'user-1', email: 'test@example.com', name: 'Test User',
      identity_provider: 'local', settings: { theme: 'dark' },
    })
  )
);

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

const httpClient = axios.create({ baseURL: BASE_URL });
const repo = new AuthRepository(httpClient);

describe('AuthRepository.login', () => {
  it('returns accessToken on success', async () => {
    const tokens = await repo.login({ email: 'test@example.com', password: 'pass' });
    expect(tokens.accessToken).toBe('test-access-token');
  });

  it('sends email and password in request body', async () => {
    let capturedBody: unknown;
    server.use(
      http.post(`${BASE_URL}/api/auth/sessions`, async ({ request }) => {
        capturedBody = await request.json();
        return HttpResponse.json({ access_token: 'tok' });
      })
    );
    await repo.login({ email: 'a@b.com', password: 'secret' });
    expect(capturedBody).toEqual({ email: 'a@b.com', password: 'secret' });
  });

  it('throws on 401', async () => {
    server.use(
      http.post(`${BASE_URL}/api/auth/sessions`, () =>
        HttpResponse.json({ detail: 'Incorrect credentials' }, { status: 401 })
      )
    );
    await expect(repo.login({ email: 'x@y.com', password: 'wrong' })).rejects.toThrow();
  });
});

describe('AuthRepository.register', () => {
  it('returns mapped User on success', async () => {
    const user = await repo.register({ email: 'test@example.com', password: 'pass8chars' });
    expect(user.id).toBe('user-1');
    expect(user.identityProvider).toBe('local');
  });
});

describe('AuthRepository.me', () => {
  it('returns mapped User with settings', async () => {
    const user = await repo.me();
    expect(user.id).toBe('user-1');
    expect(user.settings).toEqual({ theme: 'dark' });
  });
});
