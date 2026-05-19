import type { AxiosInstance } from 'axios';
import type { IProviderRepository } from '@/application/ports/IProviderRepository';
import type { CreateProviderPayload, Provider, ProviderKind } from '@/domain/types/provider.types';

interface ApiProviderResponse {
  id: string;
  provider_name: string;
  enabled: boolean;
  metadata: Record<string, unknown>;
}

function mapProvider(raw: ApiProviderResponse): Provider {
  return {
    id: raw.id,
    providerName: raw.provider_name as ProviderKind,
    enabled: raw.enabled,
    metadata: raw.metadata,
  };
}

export class ProviderRepository implements IProviderRepository {
  constructor(private readonly http: AxiosInstance) {}

  async list(): Promise<Provider[]> {
    const { data } = await this.http.get<ApiProviderResponse[]>('/api/providers');
    return data.map(mapProvider);
  }

  async create(payload: CreateProviderPayload): Promise<Provider> {
    const { data } = await this.http.post<ApiProviderResponse>('/api/providers', {
      provider_name: payload.providerName,
      api_key: payload.apiKey,
      metadata: payload.metadata ?? {},
    });
    return mapProvider(data);
  }

  async delete(id: string): Promise<void> {
    await this.http.delete(`/api/providers/${id}`);
  }
}
