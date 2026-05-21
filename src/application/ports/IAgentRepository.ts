import type { PragnaAgent } from '@/domain/types/agent.types';

/**
 * Read-only access to the AG-UI agents the authenticated user can chat with.
 *
 * Mirrors the backend's ``GET /pragna/agents`` discovery route. The list is
 * resolved per-request server-side and always includes the user's enabled
 * flow agents plus a synthetic ``"default"`` chat agent when at least one
 * chat-available model is configured.
 */
export interface IAgentRepository {
  /** Fetch the agents the authenticated user can run. May return ``[]``. */
  list(): Promise<PragnaAgent[]>;
}
