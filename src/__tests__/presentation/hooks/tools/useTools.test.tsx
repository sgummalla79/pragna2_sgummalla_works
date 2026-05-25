import { describe, it, expect, vi } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  useTools,
  useToggleTool,
} from '@/presentation/hooks/tools/useTools';
import {
  MCP_SERVERS_KEY,
  TOOLS_KEY,
} from '@/presentation/hooks/mcp-servers/useMcpServers';
import {
  ServiceContext,
  type Services,
} from '@/presentation/providers/ServiceContext';
import type { Tool } from '@/domain/types/tool.types';

const SAMPLE_TOOL: Tool = {
  id: 'tool-1',
  userId: 'user-1',
  userMcpServerId: 'srv-1',
  apiName: 'mcp.my-linear.search',
  displayName: 'search',
  description: 'Search Linear',
  toolType: 'mcp',
  handlerFamily: null,
  systemManaged: false,
  autoBindToDefaultAgent: false,
  enabled: false,
  createdAt: '2026-05-25T00:00:00Z',
  modifiedAt: '2026-05-25T00:00:00Z',
};

function makeWrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const list = vi.fn().mockResolvedValue([SAMPLE_TOOL]);
  const setEnabled = vi
    .fn()
    .mockResolvedValue({ ...SAMPLE_TOOL, enabled: true });

  const services = {
    toolService: { list, setEnabled },
  } as unknown as Services;

  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}>
      <ServiceContext.Provider value={services}>
        {children}
      </ServiceContext.Provider>
    </QueryClientProvider>
  );

  return { wrapper, qc, list, setEnabled };
}

describe('useTools', () => {
  it('returns the mapped tool list', async () => {
    const { wrapper, list } = makeWrapper();
    const { result } = renderHook(() => useTools(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(list).toHaveBeenCalledTimes(1);
    expect(result.current.data).toEqual([SAMPLE_TOOL]);
  });
});

describe('useToggleTool', () => {
  it('passes {id, payload} and invalidates both tools and servers caches', async () => {
    const { wrapper, qc, setEnabled } = makeWrapper();
    const invalidate = vi.spyOn(qc, 'invalidateQueries');
    const { result } = renderHook(() => useToggleTool(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({
        id: 'tool-1',
        payload: { enabled: true },
      });
    });

    expect(setEnabled).toHaveBeenCalledWith('tool-1', { enabled: true });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: TOOLS_KEY });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: MCP_SERVERS_KEY });
  });
});
