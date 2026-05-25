import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import axios from 'axios';
import { ToolRepository } from '@/infrastructure/repositories/ToolRepository';

const BASE_URL = 'http://localhost:8000';

const ASK_USER_TOOL = {
  id: 'tool-builtin-ask-user',
  user_id: null,
  user_mcp_server_id: null,
  api_name: 'ask_user',
  display_name: 'Ask the user',
  description: 'Pause the conversation and ask the user.',
  tool_type: 'builtin' as const,
  handler_family: 'system_interrupt',
  system_managed: true,
  auto_bind_to_default_agent: true,
  enabled: true,
  created_at: '2026-05-24T00:00:00Z',
  modified_at: '2026-05-24T00:00:00Z',
};

const MCP_TOOL = {
  id: 'tool-mcp-1',
  user_id: 'user-1',
  user_mcp_server_id: 'srv-1',
  api_name: 'mcp.my-linear.search',
  display_name: 'search',
  description: 'Search Linear',
  tool_type: 'mcp' as const,
  handler_family: null,
  system_managed: false,
  auto_bind_to_default_agent: false,
  enabled: false,
  created_at: '2026-05-25T00:00:00Z',
  modified_at: '2026-05-25T00:00:00Z',
};

const server = setupServer();

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

const httpClient = axios.create({ baseURL: BASE_URL });
const repo = new ToolRepository(httpClient);

describe('ToolRepository.list', () => {
  it('maps both global and per-user rows', async () => {
    server.use(
      http.get(`${BASE_URL}/api/tools`, () =>
        HttpResponse.json([ASK_USER_TOOL, MCP_TOOL]),
      ),
    );
    const tools = await repo.list();
    expect(tools).toHaveLength(2);
    // Global row: userId null, MCP id null.
    expect(tools[0].userId).toBeNull();
    expect(tools[0].userMcpServerId).toBeNull();
    expect(tools[0].toolType).toBe('builtin');
    expect(tools[0].apiName).toBe('ask_user');
    // MCP row: userId + MCP id populated.
    expect(tools[1].userId).toBe('user-1');
    expect(tools[1].userMcpServerId).toBe('srv-1');
    expect(tools[1].toolType).toBe('mcp');
    expect(tools[1].apiName).toBe('mcp.my-linear.search');
  });
});

describe('ToolRepository.setEnabled', () => {
  it('sends enabled boolean + returns mapped tool', async () => {
    let capturedBody: Record<string, unknown> = {};
    server.use(
      http.patch(`${BASE_URL}/api/tools/tool-mcp-1`, async ({ request }) => {
        capturedBody = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json({ ...MCP_TOOL, enabled: true });
      }),
    );

    const result = await repo.setEnabled('tool-mcp-1', { enabled: true });
    expect(capturedBody).toEqual({ enabled: true });
    expect(result.enabled).toBe(true);
  });
});
