export const SKILL_TYPE_FUNCTION = 'function' as const;
export const SKILL_TYPE_AGENT = 'agent' as const;

export const SKILL_TYPE_LABELS: Record<string, string> = {
  [SKILL_TYPE_FUNCTION]: 'Function',
  [SKILL_TYPE_AGENT]: 'Agent',
};

export const SKILL_TYPE_DESCRIPTIONS: Record<string, string> = {
  [SKILL_TYPE_FUNCTION]: 'Single LLM call — lightweight, fast',
  [SKILL_TYPE_AGENT]: 'Runs a full multi-agent flow',
};
