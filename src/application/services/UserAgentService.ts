import type { IUserAgentRepository } from '@/application/ports/IUserAgentRepository';
import type { UserAgent } from '@/domain/types/userAgent.types';

/** Read-only agent access. Agents are flow-owned (BE migration 0024) and
 *  written only through the flow YAML save path. */
export class UserAgentService {
  constructor(private readonly repo: IUserAgentRepository) {}

  list(): Promise<UserAgent[]> {
    return this.repo.list();
  }

  get(id: string): Promise<UserAgent> {
    return this.repo.get(id);
  }
}
