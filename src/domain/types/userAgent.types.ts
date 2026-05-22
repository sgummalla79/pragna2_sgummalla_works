/** A per-user reusable agent definition (R3.5 backend, R3.7+ UI).
 *
 * Mirrors the `user_agents` table. The same agent can be referenced by
 * many flow_nodes — edit it once, every flow using it picks up the
 * change. Flows reference an agent by its `apiName`.
 */
export interface UserAgent {
  id: string;
  /** URL-safe identifier; unique within the user's scope. Used in YAML
   *  as `flow.nodes[].agent: <api_name>`. */
  apiName: string;
  /** Human-readable label rendered in lists + pickers. */
  displayName: string;
  description: string | null;
  /** UUID of the user_model this agent runs against. Must be enabled
   *  AND available_for_flows. */
  userModelId: string;
  /** Steering prompt prepended to the conversation at runtime. */
  systemPrompt: string;
  /** Optional structured-output schema (reserved for R5+). */
  outputSchema: Record<string, unknown> | null;
  /** Skill api_names the agent may invoke. Empty for R3.5. */
  tools: string[];
  /** Routing labels the agent may emit. Empty = leaf node; non-empty
   *  drives conditional edges in flows. */
  emits: string[];
  /** ISO 8601 timestamps. */
  createdAt: string;
  modifiedAt: string;
}

export interface CreateUserAgentPayload {
  apiName: string;
  displayName: string;
  description?: string | null;
  userModelId: string;
  systemPrompt: string;
  outputSchema?: Record<string, unknown> | null;
  tools?: string[];
  emits?: string[];
}

/** Partial update — every field except `id` is optional. */
export type UpdateUserAgentPayload = Partial<Omit<CreateUserAgentPayload, never>>;
