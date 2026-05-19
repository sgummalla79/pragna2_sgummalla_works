export type SkillType = 'function' | 'agent';

export interface Skill {
  id: string;
  name: string;
  description: string;
  skillType: SkillType;
  userModelId: string | null;
  config: Record<string, unknown>;
  enabled: boolean;
}

export interface CreateSkillPayload {
  name: string;
  description: string;
  skillType: SkillType;
  userModelId?: string;
  config?: Record<string, unknown>;
}
