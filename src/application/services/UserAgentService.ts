import type { IUserAgentRepository } from '@/application/ports/IUserAgentRepository';
import type {
  CreateUserAgentPayload,
  UpdateUserAgentPayload,
  UserAgent,
} from '@/domain/types/userAgent.types';

export class UserAgentService {
  constructor(private readonly repo: IUserAgentRepository) {}

  list(): Promise<UserAgent[]> {
    return this.repo.list();
  }

  get(id: string): Promise<UserAgent> {
    return this.repo.get(id);
  }

  create(payload: CreateUserAgentPayload): Promise<UserAgent> {
    return this.repo.create(payload);
  }

  update(id: string, payload: UpdateUserAgentPayload): Promise<UserAgent> {
    return this.repo.update(id, payload);
  }

  delete(id: string): Promise<void> {
    return this.repo.delete(id);
  }
}
