import type { IAgentRepository } from '@/application/ports/IAgentRepository';
import type { PragnaAgent } from '@/domain/types/agent.types';

/**
 * Application-layer facade over :class:`IAgentRepository`.
 *
 * Mirrors the same minimal repository signature today; exists so views can
 * acquire the dependency through the standard ``useServices()`` channel and
 * any future caching / sorting / filtering can land here without changing
 * call sites.
 */
export class AgentService {
  constructor(private readonly agentRepository: IAgentRepository) {}

  list(): Promise<PragnaAgent[]> {
    return this.agentRepository.list();
  }
}
