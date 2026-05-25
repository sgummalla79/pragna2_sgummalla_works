/**
 * Mappers for the MCP-server BE shape (snake_case) ↔ domain shape
 * (camelCase). Wedge B.2.
 *
 * The BE responses (see `mcp_server_schemas.py`) carry the fields as
 * declared by Pydantic — snake_case under FastAPI's default JSON
 * serialiser. We translate at this boundary so UI code only sees the
 * camelCase domain types.
 */

import type {
  CreateMcpServerPayload,
  McpServerToolCounts,
  RegisteredMcpServer,
  UpdateMcpServerPayload,
  UserMcpServer,
} from '@/domain/types/mcp.types';

/** Raw shape returned by `GET /api/user-mcp-servers` + `PATCH` + nested
 *  inside `POST` and `GET` responses. Matches `McpServerResponse` in
 *  `src/presentation/api/schemas/mcp_server_schemas.py`. */
export interface ApiMcpServerResponse {
  id: string;
  display_name: string;
  transport: 'http' | 'stdio';
  config: Record<string, unknown>;
  has_credentials: boolean;
  enabled: boolean;
  tools: ApiMcpServerToolCounts | null;
  created_at: string;
  modified_at: string;
}

export interface ApiMcpServerToolCounts {
  total: number;
  enabled: number;
}

/** Extends the base server response with discovered tool api_names —
 *  the 201 shape from `POST /api/user-mcp-servers`. */
export interface ApiRegisteredMcpServerResponse extends ApiMcpServerResponse {
  discovered_tool_api_names: string[];
}

/** Raw shape returned by `POST /api/user-mcp-servers/{id}/refresh-tools`. */
export interface ApiRefreshToolsResponse {
  added: number;
  unchanged: number;
  archived: number;
}

/** Map an API tool-counts object to the domain shape. */
function mapToolCounts(
  raw: ApiMcpServerToolCounts | null,
): McpServerToolCounts | null {
  if (raw === null) return null;
  return {
    total: raw.total,
    enabled: raw.enabled,
  };
}

/** Map an API server response to a domain entity. */
export function mapMcpServer(raw: ApiMcpServerResponse): UserMcpServer {
  return {
    id: raw.id,
    displayName: raw.display_name,
    transport: raw.transport,
    config: raw.config ?? {},
    hasCredentials: raw.has_credentials,
    enabled: raw.enabled,
    tools: mapToolCounts(raw.tools),
    createdAt: raw.created_at,
    modifiedAt: raw.modified_at,
  };
}

/** Map the 201 `POST` response to a `RegisteredMcpServer`. */
export function mapRegisteredMcpServer(
  raw: ApiRegisteredMcpServerResponse,
): RegisteredMcpServer {
  return {
    ...mapMcpServer(raw),
    discoveredToolApiNames: raw.discovered_tool_api_names ?? [],
  };
}

/** Map the domain create payload to the snake_case shape the BE expects. */
export function toApiCreatePayload(
  payload: CreateMcpServerPayload,
): Record<string, unknown> {
  const body: Record<string, unknown> = {
    display_name: payload.displayName,
    transport: payload.transport,
    config: payload.config,
  };
  if (payload.credentials !== undefined) {
    body.credentials = payload.credentials;
  }
  return body;
}

/** Map the domain update payload to the snake_case shape the BE expects.
 *  Only sends the keys the caller actually set, so the BE leaves
 *  unset fields unchanged. */
export function toApiUpdatePayload(
  payload: UpdateMcpServerPayload,
): Record<string, unknown> {
  const body: Record<string, unknown> = {};
  if (payload.displayName !== undefined) body.display_name = payload.displayName;
  if (payload.enabled !== undefined) body.enabled = payload.enabled;
  if (payload.credentials !== undefined) body.credentials = payload.credentials;
  if (payload.clearCredentials !== undefined) {
    body.clear_credentials = payload.clearCredentials;
  }
  return body;
}
