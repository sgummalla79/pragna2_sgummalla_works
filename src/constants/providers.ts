import type { CredentialKind } from '@/domain/types/provider.types';

// ── Visual design ─────────────────────────────────────────────────────────────
// Styling hints only — the list of supported providers comes from GET /api/llm-providers.

export const PROVIDER_COLORS: Record<string, { bg: string; fg: string }> = {
  anthropic:  { bg: '#CC785C', fg: '#fff' },
  openai:     { bg: '#0d0d0d', fg: '#fff' },
  google:     { bg: '#4285F4', fg: '#fff' },
  groq:       { bg: '#F55036', fg: '#fff' },
  mistral:    { bg: '#FF7000', fg: '#fff' },
  perplexity: { bg: '#1a1a2e', fg: '#20d9d2' },
  bedrock:    { bg: '#FF9900', fg: '#fff' },
  vertexai:   { bg: '#4285F4', fg: '#fff' },
};

/** Returns brand colour for a known provider, or a neutral fallback. */
export function providerColor(name: string): { bg: string; fg: string } {
  return PROVIDER_COLORS[name] ?? { bg: '#333', fg: '#ececea' };
}

/** Returns the letter initial for a provider logo fallback. */
export function providerInitial(name: string): string {
  const overrides: Record<string, string> = { vertexai: 'V', bedrock: 'B' };
  return overrides[name] ?? name.charAt(0).toUpperCase();
}

// ── Credential form config ────────────────────────────────────────────────────
// Authoritative definition of which fields to render per credential_kind.
// Components iterate this — they never define field lists themselves.

export interface CredentialFieldDef {
  /** Unique key within the form; used as the HTML id and values map key. */
  key: string;
  /** Used as the input placeholder (visible inside the field). No separate label is shown. */
  label: string;
  /** Example value shown as a short hint below the field. */
  placeholder: string;
  /** Short description shown below the input to guide the user. */
  hint: string;
  /** When true, render as a masked password field (PasswordInput). */
  secret: boolean;
  /** When true, render as a textarea instead of a single-line input. */
  multiline?: boolean;
}

export const CREDENTIAL_FIELDS: Record<CredentialKind, CredentialFieldDef[]> = {
  api_key: [
    {
      key:         'apiKey',
      label:       'API Key',
      placeholder: 'sk-ant-api03-…',
      hint:        'Find your API key in your provider\'s developer console.',
      secret:      true,
    },
  ],
  aws_credentials: [
    {
      key:         'accessKeyId',
      label:       'Access Key ID',
      placeholder: 'AKIA…',
      hint:        'Found in AWS → IAM → Security credentials.',
      secret:      false,
    },
    {
      key:         'secretAccessKey',
      label:       'Secret Access Key',
      placeholder: 'wJalr…',
      hint:        'The 40-character secret paired with your Access Key ID.',
      secret:      true,
    },
    {
      key:         'region',
      label:       'AWS Region',
      placeholder: 'us-east-1',
      hint:        'e.g. us-east-1, eu-west-2, ap-southeast-1.',
      secret:      false,
    },
  ],
  gcp_credentials: [
    {
      key:         'serviceAccountJson',
      label:       'Service Account JSON',
      placeholder: '{ "type": "service_account", … }',
      hint:        'Paste the full JSON from GCP → IAM → Service Accounts → Keys.',
      secret:      false,
      multiline:   true,
    },
  ],
};

/**
 * Serializes credential form values to the single api_key string
 * expected by POST /api/user-providers, regardless of credential_kind.
 *
 * - api_key:         returns the raw key value directly.
 * - aws_credentials: JSON-encodes { accessKeyId, secretAccessKey, region }.
 * - gcp_credentials: returns the service-account JSON blob verbatim.
 */
export function serializeCredentials(
  kind: CredentialKind,
  values: Record<string, string>
): string {
  switch (kind) {
    case 'api_key':
      return values['apiKey'] ?? '';
    case 'aws_credentials':
      return JSON.stringify({
        accessKeyId:     values['accessKeyId'] ?? '',
        secretAccessKey: values['secretAccessKey'] ?? '',
        region:          values['region'] ?? '',
      });
    case 'gcp_credentials':
      return values['serviceAccountJson'] ?? '';
  }
}
