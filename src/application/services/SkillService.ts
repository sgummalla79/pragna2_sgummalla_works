import type { ISkillRepository } from '@/application/ports/ISkillRepository';
import type { CreateSkillPayload, Skill } from '@/domain/types/skill.types';

export class SkillService {
  constructor(private readonly skillRepository: ISkillRepository) {}

  list(): Promise<Skill[]> {
    return this.skillRepository.list();
  }

  create(payload: CreateSkillPayload): Promise<Skill> {
    return this.skillRepository.create(payload);
  }

  delete(id: string): Promise<void> {
    return this.skillRepository.delete(id);
  }
}
