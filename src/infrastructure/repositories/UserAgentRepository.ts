import type { AxiosInstance } from 'axios';
import type { IUserAgentRepository } from '@/application/ports/IUserAgentRepository';
import type {
  CreateUserAgentPayload,
  UpdateUserAgentPayload,
  UserAgent,
} from '@/domain/types/userAgent.types';

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

/** Drop undefined fields so PATCH bodies don't reset values to null
 *  on partial updates. */
function snakeifyPayload(
  p: CreateUserAgentPayload | UpdateUserAgentPayload,
): Record<string, unknown> {
  const body: Record<string, unknown> = {};
  if (p.apiName !== undefined)       body.api_name       = p.apiName;
  if (p.displayName !== undefined)   body.display_name   = p.displayName;
  if (p.description !== undefined)   body.description    = p.description;
  if (p.userModelId !== undefined)   body.user_model_id  = p.userModelId;
  if (p.systemPrompt !== undefined)  body.system_prompt  = p.systemPrompt;
  if (p.outputSchema !== undefined)  body.output_schema  = p.outputSchema;
  if (p.tools !== undefined)         body.tools          = p.tools;
  if (p.emits !== undefined)         body.emits          = p.emits;
  return body;
}

/** Per-user agent CRUD against /api/user-agents (backend R3.5+). */
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

  async create(payload: CreateUserAgentPayload): Promise<UserAgent> {
    const { data } = await this.http.post<ApiUserAgentResponse>(
      '/api/user-agents',
      snakeifyPayload(payload),
    );
    return mapUserAgent(data);
  }

  async update(id: string, payload: UpdateUserAgentPayload): Promise<UserAgent> {
    const { data } = await this.http.patch<ApiUserAgentResponse>(
      `/api/user-agents/${id}`,
      snakeifyPayload(payload),
    );
    return mapUserAgent(data);
  }

  async delete(id: string): Promise<void> {
    await this.http.delete(`/api/user-agents/${id}`);
  }
}
