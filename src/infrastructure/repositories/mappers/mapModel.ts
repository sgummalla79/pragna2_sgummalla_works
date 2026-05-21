import type { Model } from '@/domain/types/model.types';

/** Raw shape returned by any endpoint that yields ModelResponse objects. */
export interface ApiModelResponse {
  id: string;
  user_provider_id: string;
  model_name: string;
  display_name: string;
  cost_per_input_token: string;
  cost_per_output_token: string;
  enabled: boolean;
  available_for_chat: boolean;
  available_for_flows: boolean;
  archived: boolean;
  metadata: Record<string, unknown>;
}

/** Maps a raw API ModelResponse to the domain Model type. */
export function mapModel(raw: ApiModelResponse): Model {
  return {
    id:                 raw.id,
    userProviderId:     raw.user_provider_id,
    modelName:          raw.model_name,
    displayName:        raw.display_name,
    costPerInputToken:  raw.cost_per_input_token,
    costPerOutputToken: raw.cost_per_output_token,
    enabled:            raw.enabled,
    availableForChat:   raw.available_for_chat,
    availableForFlows:  raw.available_for_flows,
    archived:           raw.archived,
    metadata:           raw.metadata ?? {},
  };
}
