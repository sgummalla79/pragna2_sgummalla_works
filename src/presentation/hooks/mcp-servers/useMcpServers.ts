/**
 * TanStack Query hooks for the MCP server endpoints (Wedge B.2).
 *
 * Mirrors the shape of `presentation/hooks/providers/useProviders.ts`.
 * Mutations invalidate both `['mcp-servers']` (so the list refetches
 * with the new state) AND `['tools']` (because every server mutation
 * — register / refresh / archive — changes the user's tool inventory
 * that the agent editor's tools picker depends on).
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useServices } from '@/presentation/providers/ServiceContext';
import type {
  CreateMcpServerPayload,
  RefreshToolsResult,
  RegisteredMcpServer,
  UpdateMcpServerPayload,
  UserMcpServer,
} from '@/domain/types/mcp.types';

/** Cache key used by both reads + invalidations. */
export const MCP_SERVERS_KEY = ['mcp-servers'] as const;
/** Cache key for the tools list — touched by every server mutation
 *  since they all change the discoverable tool set. */
export const TOOLS_KEY = ['tools'] as const;

/** List the user's active MCP servers. */
export function useMcpServers() {
  const { mcpServerService } = useServices();
  return useQuery({
    queryKey: MCP_SERVERS_KEY,
    queryFn: () => mcpServerService.list(),
    staleTime: 30_000,
  });
}

/** Register a new MCP server. Invalidates servers + tools on success. */
export function useRegisterMcpServer() {
  const { mcpServerService } = useServices();
  const qc = useQueryClient();
  return useMutation<RegisteredMcpServer, Error, CreateMcpServerPayload>({
    mutationFn: (payload) => mcpServerService.register(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: MCP_SERVERS_KEY });
      qc.invalidateQueries({ queryKey: TOOLS_KEY });
    },
  });
}

/** Partial update — display_name / enabled / credentials. */
export function useUpdateMcpServer() {
  const { mcpServerService } = useServices();
  const qc = useQueryClient();
  return useMutation<
    UserMcpServer,
    Error,
    { id: string; payload: UpdateMcpServerPayload }
  >({
    mutationFn: ({ id, payload }) => mcpServerService.update(id, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: MCP_SERVERS_KEY });
      // Toggling `enabled` on the server doesn't change which tools
      // exist, but it does change whether they resolve at the runtime.
      // Invalidate tools so the agent editor's picker reflects the
      // new "available now" set.
      qc.invalidateQueries({ queryKey: TOOLS_KEY });
    },
  });
}

/** Soft-delete a server (cascades enabled=false to its tools). */
export function useArchiveMcpServer() {
  const { mcpServerService } = useServices();
  const qc = useQueryClient();
  return useMutation<void, Error, string>({
    mutationFn: (id) => mcpServerService.archive(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: MCP_SERVERS_KEY });
      qc.invalidateQueries({ queryKey: TOOLS_KEY });
    },
  });
}

/** Re-run upstream discovery. */
export function useRefreshMcpServerTools() {
  const { mcpServerService } = useServices();
  const qc = useQueryClient();
  return useMutation<RefreshToolsResult, Error, string>({
    mutationFn: (id) => mcpServerService.refreshTools(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: MCP_SERVERS_KEY });
      qc.invalidateQueries({ queryKey: TOOLS_KEY });
    },
  });
}
