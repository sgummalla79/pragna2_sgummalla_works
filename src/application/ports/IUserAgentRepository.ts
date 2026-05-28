import type { UserAgent } from '@/domain/types/userAgent.types';

/**
 * Read-only contract for user agents. Agents are flow-owned (BE
 * migration 0024) and authored inline via the flow YAML save path —
 * there is no standalone create/update/delete. These reads back agent
 * name resolution in the conversation UI and the flow-scoped agents list.
 */
export interface IUserAgentRepository {
  list(): Promise<UserAgent[]>;
  get(id: string): Promise<UserAgent>;
}
