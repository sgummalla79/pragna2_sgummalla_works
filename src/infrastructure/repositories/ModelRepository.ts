import type { AxiosInstance } from 'axios';
import type { IModelRepository } from '@/application/ports/IModelRepository';
import type { Model, UpdateModelPayload } from '@/domain/types/model.types';
import { mapModel, type ApiModelResponse } from './mappers/mapModel';

/**
 * Manages user_models via GET and PATCH.
 *
 * Models are created automatically by POST /api/user-providers (auto-discovery)
 * and POST /api/user-providers/{id}/refresh-models. There is no standalone
 * POST or DELETE on user_models — those operations do not exist in the API.
 */
export class ModelRepository implements IModelRepository {
  constructor(private readonly http: AxiosInstance) {}

  async list(): Promise<Model[]> {
    const { data } = await this.http.get<ApiModelResponse[]>('/api/user-models');
    return data.map(mapModel);
  }

  async update(id: string, payload: UpdateModelPayload): Promise<Model> {
    const body: Record<string, unknown> = {};
    if (payload.enabled           !== undefined) body.enabled            = payload.enabled;
    if (payload.availableForChat  !== undefined) body.available_for_chat = payload.availableForChat;
    if (payload.availableForFlows !== undefined) body.available_for_flows = payload.availableForFlows;
    if (payload.displayName       !== undefined) body.display_name       = payload.displayName;
    if (payload.metadata          !== undefined) body.metadata           = payload.metadata;

    const { data } = await this.http.patch<ApiModelResponse>(`/api/user-models/${id}`, body);
    return mapModel(data);
  }
}
