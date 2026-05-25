/**
 * Axios-backed implementation of :class:`IToolRepository` (Wedge B.2).
 */

import type { AxiosInstance } from 'axios';
import type { IToolRepository } from '@/application/ports/IToolRepository';
import type { Tool, UpdateToolPayload } from '@/domain/types/tool.types';
import { type ApiToolResponse, mapTool } from './mappers/mapTool';

export class ToolRepository implements IToolRepository {
  constructor(private readonly http: AxiosInstance) {}

  async list(): Promise<Tool[]> {
    const { data } = await this.http.get<ApiToolResponse[]>('/api/tools');
    return data.map(mapTool);
  }

  async setEnabled(
    id: string,
    payload: UpdateToolPayload,
  ): Promise<Tool> {
    const { data } = await this.http.patch<ApiToolResponse>(
      `/api/tools/${id}`,
      // Wedge B.2 only sends `enabled`; the BE schema is
      // explicit-fields-only so we don't need to filter.
      { enabled: payload.enabled },
    );
    return mapTool(data);
  }
}
