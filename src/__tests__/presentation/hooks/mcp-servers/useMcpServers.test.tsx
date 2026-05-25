import { describe, it, expect, vi } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  MCP_SERVERS_KEY,
  TOOLS_KEY,
  useArchiveMcpServer,
  useMcpServers,
  useRefreshMcpServerTools,
  useRegisterMcpServer,
  useUpdateMcpServer,
} from '@/presentation/hooks/mcp-servers/useMcpServers';
import {
  ServiceContext,
  type Services,
} from '@/presentation/providers/ServiceContext';
import type { UserMcpServer } from '@/domain/types/mcp.types';

const SAMPLE: UserMcpServer = {
  id: 'srv-1',
  displayName: 'My Linear',
  transport: 'http',
  config: { url: 'https://x' },
  hasCredentials: false,
  enabled: true,
  tools: { total: 0, enabled: 0 },
  createdAt: '2026-05-25T00:00:00Z',
  modifiedAt: '2026-05-25T00:00:00Z',
};

function makeWrapper(mcpServiceOverrides: Record<string, unknown> = {}) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const list = vi.fn().mockResolvedValue([SAMPLE]);
  const register = vi.fn().mockResolvedValue({ ...SAMPLE, discoveredToolApiNames: [] });
  const update = vi.fn().mockResolvedValue(SAMPLE);
  const archive = vi.fn().mockResolvedValue(undefined);
  const refreshTools = vi
    .fn()
    .mockResolvedValue({ added: 0, unchanged: 0, archived: 0 });

  const services = {
    mcpServerService: {
      list,
      register,
      update,
      archive,
      refreshTools,
      ...mcpServiceOverrides,
    },
  } as unknown as Services;

  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}>
      <ServiceContext.Provider value={services}>
        {children}
      </ServiceContext.Provider>
    </QueryClientProvider>
  );

  return { wrapper, qc, list, register, update, archive, refreshTools };
}

describe('useMcpServers', () => {
  it('queries via the service and returns mapped data', async () => {
    const { wrapper, list } = makeWrapper();
    const { result } = renderHook(() => useMcpServers(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(list).toHaveBeenCalledTimes(1);
    expect(result.current.data).toEqual([SAMPLE]);
  });
});

describe('useRegisterMcpServer', () => {
  it('invalidates both servers and tools on success', async () => {
    const { wrapper, qc, register } = makeWrapper();
    const invalidate = vi.spyOn(qc, 'invalidateQueries');
    const { result } = renderHook(() => useRegisterMcpServer(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({
        displayName: 'X',
        transport: 'http',
        config: { url: 'https://x' },
      });
    });

    expect(register).toHaveBeenCalledTimes(1);
    expect(invalidate).toHaveBeenCalledWith({ queryKey: MCP_SERVERS_KEY });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: TOOLS_KEY });
  });
});

describe('useUpdateMcpServer', () => {
  it('passes {id, payload} to the service and invalidates both caches', async () => {
    const { wrapper, qc, update } = makeWrapper();
    const invalidate = vi.spyOn(qc, 'invalidateQueries');
    const { result } = renderHook(() => useUpdateMcpServer(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({
        id: 'srv-1',
        payload: { enabled: false },
      });
    });

    expect(update).toHaveBeenCalledWith('srv-1', { enabled: false });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: MCP_SERVERS_KEY });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: TOOLS_KEY });
  });
});

describe('useArchiveMcpServer', () => {
  it('archives and invalidates both caches', async () => {
    const { wrapper, qc, archive } = makeWrapper();
    const invalidate = vi.spyOn(qc, 'invalidateQueries');
    const { result } = renderHook(() => useArchiveMcpServer(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync('srv-1');
    });

    expect(archive).toHaveBeenCalledWith('srv-1');
    expect(invalidate).toHaveBeenCalledWith({ queryKey: MCP_SERVERS_KEY });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: TOOLS_KEY });
  });
});

describe('useRefreshMcpServerTools', () => {
  it('refreshes and invalidates both caches', async () => {
    const { wrapper, qc, refreshTools } = makeWrapper();
    const invalidate = vi.spyOn(qc, 'invalidateQueries');
    const { result } = renderHook(() => useRefreshMcpServerTools(), { wrapper });

    await act(async () => {
      const diff = await result.current.mutateAsync('srv-1');
      expect(diff).toEqual({ added: 0, unchanged: 0, archived: 0 });
    });

    expect(refreshTools).toHaveBeenCalledWith('srv-1');
    expect(invalidate).toHaveBeenCalledWith({ queryKey: MCP_SERVERS_KEY });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: TOOLS_KEY });
  });
});
