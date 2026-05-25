import type { IMcpServerRepository } from '@/application/ports/IMcpServerRepository';
import type {
  CreateMcpServerPayload,
  RefreshToolsResult,
  RegisteredMcpServer,
  UpdateMcpServerPayload,
  UserMcpServer,
} from '@/domain/types/mcp.types';

/**
 * Manages the user's registered MCP servers via the
 * `/api/user-mcp-servers/*` endpoints (Wedge B.2). Thin facade over the
 * repository — exists for consistency with the rest of the service
 * layer and to give consumers a single injection point.
 */
export class McpServerService {
  constructor(private readonly repo: IMcpServerRepository) {}

  /** List the user's active servers with per-server tool counts. */
  list(): Promise<UserMcpServer[]> {
    return this.repo.list();
  }

  /**
   * Register a new server. The BE runs upstream discovery and persists
   * one `tools` row per upstream tool (`enabled=false`). The returned
   * `RegisteredMcpServer` includes the discovered api_names so the UI
   * can toast a meaningful "discovered N tools" message.
   */
  register(payload: CreateMcpServerPayload): Promise<RegisteredMcpServer> {
    return this.repo.register(payload);
  }

  /** Partial update — display_name / enabled / credentials. */
  update(
    id: string,
    payload: UpdateMcpServerPayload,
  ): Promise<UserMcpServer> {
    return this.repo.update(id, payload);
  }

  /** Soft-delete + cascade-disable tools. Idempotent. */
  archive(id: string): Promise<void> {
    return this.repo.archive(id);
  }

  /** Re-run upstream discovery; existing user opt-ins are preserved. */
  refreshTools(id: string): Promise<RefreshToolsResult> {
    return this.repo.refreshTools(id);
  }
}
