import type { AxiosInstance } from 'axios';
import type { IUserAgentRepository } from '@/application/ports/IUserAgentRepository';
import type { UserAgent } from '@/domain/types/userAgent.types';

/** R3.7+ wire shape for /api/user-agents responses. */
interface ApiUserAgentResponse {
  id: string;
  api_name: string;
  display_name: string;
  description: string | null;
  user_model_id: string;
  system_prompt: string;
  output_schema: Record<string, unknown> | null;
  tools: string[];
  emits: string[];
  created_at: string;
  modified_at: string;
}

function mapUserAgent(raw: ApiUserAgentResponse): UserAgent {
  return {
    id:           raw.id,
    apiName:      raw.api_name,
    displayName:  raw.display_name,
    description:  raw.description,
    userModelId:  raw.user_model_id,
    systemPrompt: raw.system_prompt,
    outputSchema: raw.output_schema,
    tools:        raw.tools ?? [],
    emits:        raw.emits ?? [],
    createdAt:    raw.created_at,
    modifiedAt:   raw.modified_at,
  };
}

/**
 * Read-only access to /api/user-agents. Agents are flow-owned (BE
 * migration 0024) and created/updated/deleted only through the flow YAML
 * save path, so this client exposes just the GET endpoints the backend
 * still serves.
 */
export class UserAgentRepository implements IUserAgentRepository {
  constructor(private readonly http: AxiosInstance) {}

  async list(): Promise<UserAgent[]> {
    const { data } = await this.http.get<ApiUserAgentResponse[]>('/api/user-agents');
    return data.map(mapUserAgent);
  }

  async get(id: string): Promise<UserAgent> {
    const { data } = await this.http.get<ApiUserAgentResponse>(`/api/user-agents/${id}`);
    return mapUserAgent(data);
  }
}
