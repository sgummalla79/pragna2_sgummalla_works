import type { IPragnaFlowsRepository } from '@/application/ports/IPragnaFlowsRepository';
import type { PragnaSlashFlow } from '@/domain/types/pragnaSlashFlow.types';

/**
 * Service-layer facade for the chat surface's slash-command discovery.
 *
 * Backed by :class:`IPragnaFlowsRepository`; presentation hooks call
 * here so React Query keys + retry policy live in one place.
 */
export class PragnaFlowsService {
  constructor(private readonly repository: IPragnaFlowsRepository) {}

  list(): Promise<PragnaSlashFlow[]> {
    return this.repository.list();
  }
}
