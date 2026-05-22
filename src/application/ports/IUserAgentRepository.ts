import type {
  CreateUserAgentPayload,
  UpdateUserAgentPayload,
  UserAgent,
} from '@/domain/types/userAgent.types';

export interface IUserAgentRepository {
  list(): Promise<UserAgent[]>;
  get(id: string): Promise<UserAgent>;
  create(payload: CreateUserAgentPayload): Promise<UserAgent>;
  update(id: string, payload: UpdateUserAgentPayload): Promise<UserAgent>;
  delete(id: string): Promise<void>;
}
