export const AGENT_TYPE_IDS = {
  INTAKE: 'intake',
  DISCOVERY: 'discovery',
  RESEARCHER: 'researcher',
  AGGREGATOR: 'aggregator',
  REVIEWER: 'reviewer',
  APPROVER: 'approver',
} as const;

export const AGENT_TYPE_LABELS: Record<string, string> = {
  [AGENT_TYPE_IDS.INTAKE]: 'Intake',
  [AGENT_TYPE_IDS.DISCOVERY]: 'Discovery',
  [AGENT_TYPE_IDS.RESEARCHER]: 'Researcher',
  [AGENT_TYPE_IDS.AGGREGATOR]: 'Aggregator',
  [AGENT_TYPE_IDS.REVIEWER]: 'Reviewer',
  [AGENT_TYPE_IDS.APPROVER]: 'Approver',
};

export const AGENT_TYPE_DESCRIPTIONS: Record<string, string> = {
  [AGENT_TYPE_IDS.INTAKE]: 'Parses the initial request into a structured brief',
  [AGENT_TYPE_IDS.DISCOVERY]: 'Identifies ambiguities and asks clarifying questions',
  [AGENT_TYPE_IDS.RESEARCHER]: 'Generates or revises the main document',
  [AGENT_TYPE_IDS.AGGREGATOR]: 'Merges parallel researcher outputs into one document',
  [AGENT_TYPE_IDS.REVIEWER]: 'Quality-checks the document (routes: passed / failed)',
  [AGENT_TYPE_IDS.APPROVER]: 'Final approval gate (routes: approved / rejected)',
};
