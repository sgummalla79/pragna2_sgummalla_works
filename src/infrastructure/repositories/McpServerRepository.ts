/**
 * Axios-backed implementation of :class:`IMcpServerRepository` (Wedge B.2).
 *
 * Maps domain payloads ↔ snake_case API shapes via
 * `mappers/mapMcpServer.ts`. Errors propagate as axios errors; the
 * TanStack Query hook layer catches + surfaces them as toasts.
 */

import type { AxiosInstance } from 'axios';
import type { IMcpServerRepository } from '@/application/ports/IMcpServerRepository';
import type {
  CreateMcpServerPayload,
  RefreshToolsResult,
  RegisteredMcpServer,
  UpdateMcpServerPayload,
  UserMcpServer,
} from '@/domain/types/mcp.types';
import {
  type ApiMcpServerResponse,
  type ApiRefreshToolsResponse,
  type ApiRegisteredMcpServerResponse,
  mapMcpServer,
  mapRegisteredMcpServer,
  toApiCreatePayload,
  toApiUpdatePayload,
} from './mappers/mapMcpServer';

export class McpServerRepository implements IMcpServerRepository {
  constructor(private readonly http: AxiosInstance) {}

  async list(): Promise<UserMcpServer[]> {
    const { data } = await this.http.get<ApiMcpServerResponse[]>(
      '/api/user-mcp-servers',
    );
    return data.map(mapMcpServer);
  }

  async register(
    payload: CreateMcpServerPayload,
  ): Promise<RegisteredMcpServer> {
    const { data } = await this.http.post<ApiRegisteredMcpServerResponse>(
      '/api/user-mcp-servers',
      toApiCreatePayload(payload),
    );
    return mapRegisteredMcpServer(data);
  }

  async update(
    id: string,
    payload: UpdateMcpServerPayload,
  ): Promise<UserMcpServer> {
    const { data } = await this.http.patch<ApiMcpServerResponse>(
      `/api/user-mcp-servers/${id}`,
      toApiUpdatePayload(payload),
    );
    return mapMcpServer(data);
  }

  async archive(id: string): Promise<void> {
    await this.http.delete(`/api/user-mcp-servers/${id}`);
  }

  async refreshTools(id: string): Promise<RefreshToolsResult> {
    const { data } = await this.http.post<ApiRefreshToolsResponse>(
      `/api/user-mcp-servers/${id}/refresh-tools`,
    );
    return {
      added: data.added,
      unchanged: data.unchanged,
      archived: data.archived,
    };
  }
}
