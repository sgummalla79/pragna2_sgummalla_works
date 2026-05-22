import type { AxiosInstance } from 'axios';
import type { ISkillRepository } from '@/application/ports/ISkillRepository';
import type { CreateSkillPayload, Skill, SkillType } from '@/domain/types/skill.types';

interface ApiSkillResponse {
  id: string;
  /** Backend R3.5+ renamed `name` → `api_name` and added `display_name`. */
  api_name: string;
  display_name: string;
  description: string;
  skill_type: string;
  user_model_id: string | null;
  config: Record<string, unknown>;
  enabled: boolean;
}

function mapSkill(raw: ApiSkillResponse): Skill {
  return {
    id: raw.id,
    // Keep the domain `.name` field — surface api_name there.
    name: raw.api_name,
    description: raw.description,
    skillType: raw.skill_type as SkillType,
    userModelId: raw.user_model_id,
    config: raw.config,
    enabled: raw.enabled,
  };
}

export class SkillRepository implements ISkillRepository {
  constructor(private readonly http: AxiosInstance) {}

  async list(): Promise<Skill[]> {
    const { data } = await this.http.get<ApiSkillResponse[]>('/api/skills');
    return data.map(mapSkill);
  }

  async create(payload: CreateSkillPayload): Promise<Skill> {
    const { data } = await this.http.post<ApiSkillResponse>('/api/skills', {
      // Backend R3.5+ requires both api_name + display_name. We reuse
      // `payload.name` for both until the UI grows a separate display_name field.
      api_name: payload.name,
      display_name: payload.name,
      description: payload.description,
      skill_type: payload.skillType,
      user_model_id: payload.userModelId,
      config: payload.config ?? {},
    });
    return mapSkill(data);
  }

  async delete(id: string): Promise<void> {
    await this.http.delete(`/api/skills/${id}`);
  }
}
