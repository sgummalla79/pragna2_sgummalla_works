import type { PragnaSlashFlow } from '@/domain/types/pragnaSlashFlow.types';

/**
 * Read-only access to the user's slash-exposed flows for the chat
 * surface's slash-command popover.
 *
 * Mirrors the backend's ``GET /pragna/flows`` discovery route.
 * Returns flows whose ``exposed_as_slash`` is true AND that compiled
 * cleanly on the current request. Empty list when the user has none.
 */
export interface IPragnaFlowsRepository {
  /** Fetch the slash-exposed flows the authenticated user can dispatch. */
  list(): Promise<PragnaSlashFlow[]>;
}
