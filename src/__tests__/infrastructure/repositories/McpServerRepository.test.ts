import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import axios from 'axios';
import { McpServerRepository } from '@/infrastructure/repositories/McpServerRepository';

const BASE_URL = 'http://localhost:8000';

// Canonical BE response payload reused across happy-path tests.
const SAMPLE_RESPONSE = {
  id: 'srv-1',
  display_name: 'My Linear',
  transport: 'http' as const,
  config: { url: 'https://mcp.example.com/sse' },
  has_credentials: true,
  enabled: true,
  tools: { total: 5, enabled: 0 },
  created_at: '2026-05-25T00:00:00Z',
  modified_at: '2026-05-25T00:00:00Z',
};

const server = setupServer();

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

const httpClient = axios.create({ baseURL: BASE_URL });
const repo = new McpServerRepository(httpClient);

describe('McpServerRepository.list', () => {
  it('maps snake_case API → camelCase domain', async () => {
    server.use(
      http.get(`${BASE_URL}/api/user-mcp-servers`, () =>
        HttpResponse.json([SAMPLE_RESPONSE]),
      ),
    );
    const result = await repo.list();
    expect(result).toEqual([
      {
        id: 'srv-1',
        displayName: 'My Linear',
        transport: 'http',
        config: { url: 'https://mcp.example.com/sse' },
        hasCredentials: true,
        enabled: true,
        tools: { total: 5, enabled: 0 },
        createdAt: '2026-05-25T00:00:00Z',
        modifiedAt: '2026-05-25T00:00:00Z',
      },
    ]);
  });
});

describe('McpServerRepository.register', () => {
  it('posts snake_case body + maps response with discoveredToolApiNames', async () => {
    let capturedBody: unknown;
    server.use(
      http.post(`${BASE_URL}/api/user-mcp-servers`, async ({ request }) => {
        capturedBody = await request.json();
        return HttpResponse.json(
          {
            ...SAMPLE_RESPONSE,
            discovered_tool_api_names: [
              'mcp.my-linear.search',
              'mcp.my-linear.create_issue',
            ],
          },
          { status: 201 },
        );
      }),
    );

    const result = await repo.register({
      displayName: 'My Linear',
      transport: 'http',
      config: { url: 'https://mcp.example.com/sse' },
      credentials: { headers: { Authorization: 'Bearer xxx' } },
    });

    expect(capturedBody).toEqual({
      display_name: 'My Linear',
      transport: 'http',
      config: { url: 'https://mcp.example.com/sse' },
      credentials: { headers: { Authorization: 'Bearer xxx' } },
    });
    expect(result.discoveredToolApiNames).toEqual([
      'mcp.my-linear.search',
      'mcp.my-linear.create_issue',
    ]);
    expect(result.displayName).toBe('My Linear');
  });

  it('omits the credentials field when not provided', async () => {
    let capturedBody: Record<string, unknown> = {};
    server.use(
      http.post(`${BASE_URL}/api/user-mcp-servers`, async ({ request }) => {
        capturedBody = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json(
          { ...SAMPLE_RESPONSE, discovered_tool_api_names: [] },
          { status: 201 },
        );
      }),
    );
    await repo.register({
      displayName: 'Open Server',
      transport: 'http',
      config: { url: 'https://x' },
    });
    expect(Object.keys(capturedBody)).not.toContain('credentials');
  });
});

describe('McpServerRepository.update', () => {
  it('sends only the keys the caller set', async () => {
    let capturedBody: Record<string, unknown> = {};
    server.use(
      http.patch(`${BASE_URL}/api/user-mcp-servers/srv-1`, async ({ request }) => {
        capturedBody = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json({ ...SAMPLE_RESPONSE, enabled: false });
      }),
    );

    const result = await repo.update('srv-1', { enabled: false });
    expect(capturedBody).toEqual({ enabled: false });
    expect(result.enabled).toBe(false);
  });

  it('threads clear_credentials through unchanged', async () => {
    let capturedBody: Record<string, unknown> = {};
    server.use(
      http.patch(`${BASE_URL}/api/user-mcp-servers/srv-1`, async ({ request }) => {
        capturedBody = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json({ ...SAMPLE_RESPONSE, has_credentials: false });
      }),
    );

    await repo.update('srv-1', { clearCredentials: true });
    expect(capturedBody).toEqual({ clear_credentials: true });
  });
});

describe('McpServerRepository.archive', () => {
  it('sends DELETE to the right URL', async () => {
    let called = false;
    server.use(
      http.delete(`${BASE_URL}/api/user-mcp-servers/srv-1`, () => {
        called = true;
        return new HttpResponse(null, { status: 204 });
      }),
    );
    await repo.archive('srv-1');
    expect(called).toBe(true);
  });
});

describe('McpServerRepository.refreshTools', () => {
  it('returns the diff summary', async () => {
    server.use(
      http.post(
        `${BASE_URL}/api/user-mcp-servers/srv-1/refresh-tools`,
        () => HttpResponse.json({ added: 2, unchanged: 5, archived: 1 }),
      ),
    );
    const result = await repo.refreshTools('srv-1');
    expect(result).toEqual({ added: 2, unchanged: 5, archived: 1 });
  });
});
