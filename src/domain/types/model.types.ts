export interface Model {
  id: string;
  userProviderId: string;
  modelId: string;
  displayName: string;
  costPerInputToken: string;
  costPerOutputToken: string;
  enabled: boolean;
  metadata: Record<string, unknown>;
}

export interface RegisterModelPayload {
  userProviderId: string;
  modelId: string;
  displayName: string;
  costPerInputToken?: number | string;
  costPerOutputToken?: number | string;
  metadata?: Record<string, unknown>;
}
