export const PROVIDER_NAMES = {
  ANTHROPIC: 'anthropic',
  OPENAI: 'openai',
  GOOGLE: 'google',
  GROQ: 'groq',
  MISTRAL: 'mistral',
  BEDROCK: 'bedrock',
} as const;

export const PROVIDER_LABELS: Record<string, string> = {
  [PROVIDER_NAMES.ANTHROPIC]: 'Anthropic',
  [PROVIDER_NAMES.OPENAI]: 'OpenAI',
  [PROVIDER_NAMES.GOOGLE]: 'Google',
  [PROVIDER_NAMES.GROQ]: 'Groq',
  [PROVIDER_NAMES.MISTRAL]: 'Mistral',
  [PROVIDER_NAMES.BEDROCK]: 'AWS Bedrock',
};

export const PROVIDER_DESCRIPTIONS: Record<string, string> = {
  [PROVIDER_NAMES.ANTHROPIC]: 'Claude Sonnet, Opus, Haiku',
  [PROVIDER_NAMES.OPENAI]: 'GPT-4o, o1, etc.',
  [PROVIDER_NAMES.GOOGLE]: 'Gemini 1.5 Pro, 2.0 Flash',
  [PROVIDER_NAMES.GROQ]: 'LLaMA 3, Mixtral (fast inference)',
  [PROVIDER_NAMES.MISTRAL]: 'Mistral Large, Codestral',
  [PROVIDER_NAMES.BEDROCK]: 'Claude via AWS Bedrock',
};
