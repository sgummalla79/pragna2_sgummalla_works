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

/**
 * Palette-driven colours for each edge condition. Returned as CSS
 * variable references so consumers (canvas labels, badges) flip with
 * the active palette.
 *
 * Semantics mapped onto palette tokens:
 *   - default / failed     → neutral muted (least visual weight)
 *   - passed / approved    → primary (the brand accent — "positive")
 *   - rejected             → destructive (the "negative" surface)
 *
 * We deliberately collapse passed≈approved and default≈failed onto
 * two palette colours; the textual label on each edge ("passed",
 * "failed", etc.) carries the semantic distinction. Earlier versions
 * used hardcoded green/red/blue/purple but that diverges from the
 * palette and hurts cohesion when users switch themes.
 */
export const EDGE_CONDITION_COLORS: Record<string, string> = {
  [EDGE_CONDITIONS.DEFAULT]:  'var(--color-muted-foreground)',
  [EDGE_CONDITIONS.PASSED]:   'var(--color-primary)',
  [EDGE_CONDITIONS.FAILED]:   'var(--color-muted-foreground)',
  [EDGE_CONDITIONS.APPROVED]: 'var(--color-primary)',
  [EDGE_CONDITIONS.REJECTED]: 'var(--color-destructive)',
};
