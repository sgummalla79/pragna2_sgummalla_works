export type ProviderKind = 'anthropic' | 'openai' | 'google' | 'groq' | 'mistral' | 'bedrock';

export interface Provider {
  id: string;
  providerName: ProviderKind;
  enabled: boolean;
  metadata: Record<string, unknown>;
}

export interface CreateProviderPayload {
  providerName: ProviderKind;
  apiKey?: string;
  metadata?: Record<string, unknown>;
}
