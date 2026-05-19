import { describe, it, expect } from 'vitest';
import { formatTokens } from '@/domain/utils/formatTokens';

describe('formatTokens', () => {
  it('returns "0" for zero', () => {
    expect(formatTokens(0)).toBe('0');
  });

  it('returns exact count for values under 1000', () => {
    expect(formatTokens(1)).toBe('1');
    expect(formatTokens(999)).toBe('999');
  });

  it('formats thousands with K suffix', () => {
    expect(formatTokens(1000)).toBe('1.0K');
    expect(formatTokens(1500)).toBe('1.5K');
    expect(formatTokens(999_999)).toBe('1000.0K');
  });

  it('formats millions with M suffix', () => {
    expect(formatTokens(1_000_000)).toBe('1.0M');
    expect(formatTokens(2_500_000)).toBe('2.5M');
  });

  it('formats billions with B suffix', () => {
    expect(formatTokens(1_000_000_000)).toBe('1.0B');
  });

  it('returns "0" for negative numbers', () => {
    expect(formatTokens(-1)).toBe('0');
  });

  it('returns "0" for Infinity', () => {
    expect(formatTokens(Infinity)).toBe('0');
  });
});
