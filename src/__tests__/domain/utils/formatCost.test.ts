import { describe, it, expect } from 'vitest';
import { formatUsd, formatCostPerMillion } from '@/domain/utils/formatCost';

describe('formatUsd', () => {
  it('returns $0.00 for zero', () => {
    expect(formatUsd(0)).toBe('$0.00');
  });

  it('returns $0.00 for zero string', () => {
    expect(formatUsd('0')).toBe('$0.00');
  });

  it('formats sub-cent amounts with 6 decimal places', () => {
    expect(formatUsd(0.0000003)).toBe('$0.000000');
    expect(formatUsd(0.000003)).toBe('$0.000003');
  });

  it('formats amounts between 0.001 and 1 with 4 decimal places', () => {
    expect(formatUsd(0.0042)).toBe('$0.0042');
    expect(formatUsd(0.1234)).toBe('$0.1234');
  });

  it('formats amounts >= 1 with 2 decimal places', () => {
    expect(formatUsd(1)).toBe('$1.00');
    expect(formatUsd(12.5)).toBe('$12.50');
    expect(formatUsd(1000)).toBe('$1000.00');
  });

  it('handles string inputs', () => {
    expect(formatUsd('0.000015')).toBe('$0.000015');
    expect(formatUsd('1.50')).toBe('$1.50');
  });

  it('returns $0.00 for NaN', () => {
    expect(formatUsd('not-a-number')).toBe('$0.00');
  });
});

describe('formatCostPerMillion', () => {
  it('formats per-token cost as per-million display', () => {
    expect(formatCostPerMillion(0.000003)).toBe('$3.00 / 1M tokens');
  });

  it('returns zero label for zero cost', () => {
    expect(formatCostPerMillion(0)).toBe('$0.00 / 1M tokens');
  });

  it('handles string input', () => {
    expect(formatCostPerMillion('0.000015')).toBe('$15.00 / 1M tokens');
  });
});
