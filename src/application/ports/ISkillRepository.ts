import type { CreateSkillPayload, Skill } from '@/domain/types/skill.types';

export interface ISkillRepository {
  list(): Promise<Skill[]>;
  create(payload: CreateSkillPayload): Promise<Skill>;
  delete(id: string): Promise<void>;
}
