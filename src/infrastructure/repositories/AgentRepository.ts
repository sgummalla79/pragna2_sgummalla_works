import type { AxiosInstance } from 'axios';
import type { IAgentRepository } from '@/application/ports/IAgentRepository';
import type { PragnaAgent } from '@/domain/types/agent.types';
import { PRAGNA_BASE_URL } from '@/constants/api';

interface ApiAgentResponse {
  name: string;
  description: string;
}

interface ApiAgentsListResponse {
  agents: ApiAgentResponse[];
}

/**
 * Axios-backed implementation of :class:`IAgentRepository`.
 *
 * Calls ``GET <PRAGNA_BASE_URL>/agents`` and unwraps the ``{agents: [...]}``
 * envelope. Authorization is attached by the shared auth interceptor on the
 * injected axios client.
 */
export class AgentRepository implements IAgentRepository {
  constructor(private readonly http: AxiosInstance) {}

  async list(): Promise<PragnaAgent[]> {
    const { data } = await this.http.get<ApiAgentsListResponse>(
      `${PRAGNA_BASE_URL}/agents`,
    );
    return data.agents.map((a) => ({
      name: a.name,
      description: a.description,
    }));
  }
}
