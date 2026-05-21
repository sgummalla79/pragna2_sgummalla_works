/** A user_models row — a model registered under a user's provider. */
export interface Model {
  id: string;
  userProviderId: string;
  /** Provider-given model identifier (e.g. 'claude-sonnet-4-6'). */
  modelName: string;
  displayName: string;
  /** USD per input token — read-only, resolved from central model_pricing catalogue. */
  costPerInputToken: string;
  /** USD per output token — read-only, resolved from central model_pricing catalogue. */
  costPerOutputToken: string;
  /** Master toggle. Auto-discovered models start false — users must opt in. */
  enabled: boolean;
  /** Surface this model to the chat agent and /skill-name invocations. */
  availableForChat: boolean;
  /** Allow this model to be selected as a flow-node model. */
  availableForFlows: boolean;
  /** True when the upstream provider no longer lists this model. */
  archived: boolean;
  metadata: Record<string, unknown>;
}

/**
 * Payload for PATCH /api/user-models/{id}.
 * All fields are optional — send only what you want to change.
 * modelName, userProviderId, and archived are immutable via this endpoint.
 */
export interface UpdateModelPayload {
  enabled?: boolean;
  availableForChat?: boolean;
  availableForFlows?: boolean;
  displayName?: string;
  metadata?: Record<string, unknown>;
}

/** Response from POST /api/user-providers/{id}/refresh-models. */
export interface RefreshModelsResult {
  /** Newly discovered models (enabled=false, must be opted into). */
  created: Model[];
  /** Models the provider no longer returns (archived=true). */
  archived: Model[];
  /** Previously-archived models reintroduced upstream (user must re-enable). */
  unarchived: Model[];
  /** Full active (non-archived) model list after reconciliation. */
  models: Model[];
}
