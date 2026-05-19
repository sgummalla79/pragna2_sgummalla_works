export const EDGE_CONDITIONS = {
  DEFAULT: 'default',
  PASSED: 'passed',
  FAILED: 'failed',
  APPROVED: 'approved',
  REJECTED: 'rejected',
} as const;

export type EdgeConditionValue = (typeof EDGE_CONDITIONS)[keyof typeof EDGE_CONDITIONS];

export const EDGE_CONDITION_LABELS: Record<string, string> = {
  [EDGE_CONDITIONS.DEFAULT]: 'Default',
  [EDGE_CONDITIONS.PASSED]: 'Passed',
  [EDGE_CONDITIONS.FAILED]: 'Failed',
  [EDGE_CONDITIONS.APPROVED]: 'Approved',
  [EDGE_CONDITIONS.REJECTED]: 'Rejected',
};

export const EDGE_CONDITION_COLORS: Record<string, string> = {
  [EDGE_CONDITIONS.DEFAULT]: '#6b7280',
  [EDGE_CONDITIONS.PASSED]: '#16a34a',
  [EDGE_CONDITIONS.FAILED]: '#dc2626',
  [EDGE_CONDITIONS.APPROVED]: '#2563eb',
  [EDGE_CONDITIONS.REJECTED]: '#9333ea',
};
