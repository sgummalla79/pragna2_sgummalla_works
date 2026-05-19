import type { AxiosInstance } from 'axios';
import type { IModelRepository } from '@/application/ports/IModelRepository';
import type { Model, RegisterModelPayload } from '@/domain/types/model.types';

interface ApiModelResponse {
  id: string;
  user_provider_id: string;
  model_id: string;
  display_name: string;
  cost_per_input_token: string;
  cost_per_output_token: string;
  enabled: boolean;
  metadata: Record<string, unknown>;
}

function mapModel(raw: ApiModelResponse): Model {
  return {
    id: raw.id,
    userProviderId: raw.user_provider_id,
    modelId: raw.model_id,
    displayName: raw.display_name,
    costPerInputToken: raw.cost_per_input_token,
    costPerOutputToken: raw.cost_per_output_token,
    enabled: raw.enabled,
    metadata: raw.metadata,
  };
}

export class ModelRepository implements IModelRepository {
  constructor(private readonly http: AxiosInstance) {}

  async list(): Promise<Model[]> {
    const { data } = await this.http.get<ApiModelResponse[]>('/api/models');
    return data.map(mapModel);
  }

  async register(payload: RegisterModelPayload): Promise<Model> {
    const { data } = await this.http.post<ApiModelResponse>('/api/models', {
      user_provider_id: payload.userProviderId,
      model_id: payload.modelId,
      display_name: payload.displayName,
      cost_per_input_token: payload.costPerInputToken ?? 0,
      cost_per_output_token: payload.costPerOutputToken ?? 0,
      metadata: payload.metadata ?? {},
    });
    return mapModel(data);
  }

  async delete(id: string): Promise<void> {
    await this.http.delete(`/api/models/${id}`);
  }
}
