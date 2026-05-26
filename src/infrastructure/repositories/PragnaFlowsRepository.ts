import type { AxiosInstance } from 'axios';
import type { IPragnaFlowsRepository } from '@/application/ports/IPragnaFlowsRepository';
import type { PragnaSlashFlow } from '@/domain/types/pragnaSlashFlow.types';
import { PRAGNA_BASE_URL } from '@/constants/api';

interface ApiSlashFlowResponse {
  slash_api_name: string;
  display_name: string;
  description: string;
}

interface ApiSlashFlowsListResponse {
  flows: ApiSlashFlowResponse[];
}

/**
 * Axios-backed implementation of :class:`IPragnaFlowsRepository`.
 *
 * Calls ``GET <PRAGNA_BASE_URL>/flows`` and unwraps the
 * ``{flows: [...]}`` envelope. Authorization is attached by the shared
 * auth interceptor on the injected axios client.
 */
export class PragnaFlowsRepository implements IPragnaFlowsRepository {
  constructor(private readonly http: AxiosInstance) {}

  async list(): Promise<PragnaSlashFlow[]> {
    const { data } = await this.http.get<ApiSlashFlowsListResponse>(
      `${PRAGNA_BASE_URL}/flows`,
    );
    return data.flows.map((f) => ({
      slash_api_name: f.slash_api_name,
      display_name: f.display_name,
      description: f.description,
    }));
  }
}
