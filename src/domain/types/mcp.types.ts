/**
 * Domain types for MCP (Model Context Protocol) server registrations.
 *
 * Wedge B.2 — FE for `/api/user-mcp-servers/*`. The BE serialises in
 * snake_case; mappers in `infrastructure/repositories/mappers/mapMcpServer.ts`
 * translate at the boundary. UI code only sees the camelCase shapes
 * here.
 */

/** Transport discriminator on a `UserMcpServer`. v1 only ships `'http'`
 *  in the registration UI; `'stdio'` exists in the type so existing
 *  archived rows (and the future Wedge B.3 stdio UI) render correctly. */
export type McpTransport = 'http' | 'stdio';

/** Per-server tool count summary returned by `GET /api/user-mcp-servers`. */
export interface McpServerToolCounts {
  total: number;
  enabled: number;
}

/** One row from `/api/user-mcp-servers` (or the create / update response). */
export interface UserMcpServer {
  /** UUID of the user_mcp_servers record. */
  id: string;
  /** User-facing label (unique per user among non-archived rows). */
  displayName: string;
  /** Transport discriminator. */
  transport: McpTransport;
  /**
   * Transport-specific shape:
   *  - http  → `{ url: string }`
   *  - stdio → `{ packageName: string; args: string[] }`
   *
   * Kept as `Record<string, unknown>` here so we don't need to discriminate
   * at the type level in every consumer. Form code reads the specific
   * fields based on `transport`.
   */
  config: Record<string, unknown>;
  /** True when encrypted credentials are stored on the BE.
   *  The ciphertext itself is NEVER returned by the BE. */
  hasCredentials: boolean;
  /** User-toggleable. Disabled servers' tools are dropped by the resolver. */
  enabled: boolean;
  /** Populated on `list` responses; may be `null` on create / update
   *  responses where the BE didn't compute it (we still know the
   *  discovered count from `discoveredToolApiNames` on create). */
  tools: McpServerToolCounts | null;
  /** ISO-8601 timestamps from the BE. */
  createdAt: string;
  modifiedAt: string;
}

/** The 201 response from `POST /api/user-mcp-servers` extends
 *  `UserMcpServer` with the list of api_names discovered at
 *  registration time (all created with `enabled=false`). */
export interface RegisteredMcpServer extends UserMcpServer {
  discoveredToolApiNames: string[];
}

/** Body for `POST /api/user-mcp-servers`. */
export interface CreateMcpServerPayload {
  displayName: string;
  transport: McpTransport;
  /** Transport-specific shape — see `UserMcpServer.config`. */
  config: Record<string, unknown>;
  /** Optional auth payload (encrypted at rest by the BE). Shape varies:
   *  - http  → `{ headers: Record<string, string> }`
   *  - stdio → `{ env: Record<string, string> }` */
  credentials?: Record<string, unknown>;
}

/** Body for `PATCH /api/user-mcp-servers/{id}`. Every field optional;
 *  set `clearCredentials: true` to wipe stored credentials regardless
 *  of `credentials`. */
export interface UpdateMcpServerPayload {
  displayName?: string;
  enabled?: boolean;
  credentials?: Record<string, unknown>;
  clearCredentials?: boolean;
}

/** Response from `POST /api/user-mcp-servers/{id}/refresh-tools`. */
export interface RefreshToolsResult {
  added: number;
  unchanged: number;
  archived: number;
}
