import type { AxiosInstance } from 'axios';
import type { IAgentTypeRepository } from '@/application/ports/IAgentTypeRepository';
import type { AgentType } from '@/domain/types/agentType.types';

interface ApiAgentTypeResponse {
  id: string;
  name: string;
  description: string | null;
  implementation_key: string;
}

function mapAgentType(raw: ApiAgentTypeResponse): AgentType {
  return {
    id: raw.id,
    name: raw.name,
    description: raw.description,
    implementationKey: raw.implementation_key,
  };
}

export class AgentTypeRepository implements IAgentTypeRepository {
  constructor(private readonly http: AxiosInstance) {}

  async list(): Promise<AgentType[]> {
    const { data } = await this.http.get<ApiAgentTypeResponse[]>('/api/agent-types');
    return data.map(mapAgentType);
  }
}
