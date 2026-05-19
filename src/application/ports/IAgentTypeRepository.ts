import type { AgentType } from '@/domain/types/agentType.types';

export interface IAgentTypeRepository {
  list(): Promise<AgentType[]>;
}
