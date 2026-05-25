/**
 * Port for the MCP-server repository (Wedge B.2).
 *
 * Application layer depends on this interface; concrete implementation
 * (axios-backed) lives in
 * `src/infrastructure/repositories/McpServerRepository.ts`.
 */

import type {
  CreateMcpServerPayload,
  RefreshToolsResult,
  RegisteredMcpServer,
  UpdateMcpServerPayload,
  UserMcpServer,
} from '@/domain/types/mcp.types';

export interface IMcpServerRepository {
  /** List the user's active (non-archived) MCP servers with per-server
   *  tool counts. Maps to `GET /api/user-mcp-servers`. */
  list(): Promise<UserMcpServer[]>;

  /** Register a new server. BE runs upstream discovery and persists
   *  one `tools` row per upstream tool (with `enabled=false`). The
   *  returned object includes the discovered api_names so the UI can
   *  toast a meaningful count. Maps to `POST /api/user-mcp-servers`. */
  register(payload: CreateMcpServerPayload): Promise<RegisteredMcpServer>;

  /** Partial update — display_name / enabled / credentials. Maps to
   *  `PATCH /api/user-mcp-servers/{id}`. */
  update(id: string, payload: UpdateMcpServerPayload): Promise<UserMcpServer>;

  /** Soft-delete: cascades `enabled=false` to the server's tools.
   *  Idempotent on already-archived rows. Maps to
   *  `DELETE /api/user-mcp-servers/{id}` (returns 204). */
  archive(id: string): Promise<void>;

  /** Re-run upstream discovery and reconcile local tool rows. Existing
   *  user opt-ins are preserved on the BE side. Maps to
   *  `POST /api/user-mcp-servers/{id}/refresh-tools`. */
  refreshTools(id: string): Promise<RefreshToolsResult>;
}
