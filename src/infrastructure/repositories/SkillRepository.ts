import type { AxiosInstance } from 'axios';
import type { ISkillRepository } from '@/application/ports/ISkillRepository';
import type { CreateSkillPayload, Skill, SkillType } from '@/domain/types/skill.types';

interface ApiSkillResponse {
  id: string;
  name: string;
  description: string;
  skill_type: string;
  user_model_id: string | null;
  config: Record<string, unknown>;
  enabled: boolean;
}

function mapSkill(raw: ApiSkillResponse): Skill {
  return {
    id: raw.id,
    name: raw.name,
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
      name: payload.name,
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
