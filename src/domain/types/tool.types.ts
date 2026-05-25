/**
 * Domain types for the `/api/tools` endpoints (Wedge B.2).
 *
 * Flat view across every tool the authenticated user can see — global
 * rows (e.g. seeded `ask_user`) and per-user MCP rows. Used by the
 * MCP-server card to render the per-tool toggle list and by the agent
 * editor's tools picker for autocomplete suggestions.
 */

export type ToolType = 'builtin' | 'mcp';

/** One row from `GET /api/tools`. */
export interface Tool {
  id: string;
  /** Null for global / system-managed rows (e.g. seeded `ask_user`).
   *  Set for per-user rows (today: MCP-discovered). */
  userId: string | null;
  /** Set when `toolType === 'mcp'`; null otherwise. The CHECK
   *  constraint on the BE enforces this implication. */
  userMcpServerId: string | null;
  /** Namespaced name the LLM sees and that `user_agent.tools`
   *  references (e.g. `ask_user`, `mcp.my-linear.create_issue`). */
  apiName: string;
  displayName: string;
  description: string;
  toolType: ToolType;
  /** BuiltinHandlerRegistry key for `toolType='builtin'`;
   *  null otherwise. */
  handlerFamily: string | null;
  /** True for operator-controlled rows (seeded `ask_user`). The
   *  per-user enable toggle is forbidden against these (BE returns
   *  403). */
  systemManaged: boolean;
  /** True = bound to the default chat agent without explicit opt-in.
   *  Today only true for the seeded `ask_user`. */
  autoBindToDefaultAgent: boolean;
  /** Per-row master toggle. The agent editor's tools picker shows
   *  disabled tools as suggestions but with a "disabled" affordance;
   *  the resolver drops them at LLM-bind time. */
  enabled: boolean;
  /** ISO-8601 timestamps from the BE. */
  createdAt: string;
  modifiedAt: string;
}

/** Body for `PATCH /api/tools/{id}` — Wedge B.2 only supports the
 *  enable toggle (other fields on the tool row are server-controlled). */
export interface UpdateToolPayload {
  enabled: boolean;
}
