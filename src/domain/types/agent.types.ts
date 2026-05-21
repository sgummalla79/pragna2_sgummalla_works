/**
 * A chat-surface agent the authenticated user can invoke via
 * ``POST /pragna/agents/{name}``. Returned by ``GET /pragna/agents``.
 */
export interface PragnaAgent {
  /** Wire-protocol identifier. URL-safe; same value used in the POST path. */
  name: string;
  /** Free-form, surfaced in slash-command autocomplete / agent pickers. */
  description: string;
}
