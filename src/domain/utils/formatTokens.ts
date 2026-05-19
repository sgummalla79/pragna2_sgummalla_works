const THOUSAND = 1_000;
const MILLION = 1_000_000;
const BILLION = 1_000_000_000;

export function formatTokens(count: number): string {
  if (!isFinite(count) || count < 0) return '0';
  if (count === 0) return '0';
  if (count < THOUSAND) return count.toString();
  if (count < MILLION) return `${(count / THOUSAND).toFixed(1)}K`;
  if (count < BILLION) return `${(count / MILLION).toFixed(1)}M`;
  return `${(count / BILLION).toFixed(1)}B`;
}
