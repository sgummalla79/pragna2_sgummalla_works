import { describe, it, expect } from 'vitest';
import { redactEmail, redactName } from '@/domain/utils/redact';

describe('redactEmail', () => {
  it('replaces any email with the redacted placeholder', () => {
    expect(redactEmail('user@example.com')).toBe('[REDACTED_EMAIL]');
  });

  it('replaces empty string', () => {
    expect(redactEmail('')).toBe('[REDACTED_EMAIL]');
  });

  it('replaces complex email addresses', () => {
    expect(redactEmail('firstname.lastname+tag@subdomain.example.co.uk')).toBe('[REDACTED_EMAIL]');
  });
});

describe('redactName', () => {
  it('replaces any name with the redacted placeholder', () => {
    expect(redactName('Alice')).toBe('[REDACTED_NAME]');
  });

  it('replaces empty string', () => {
    expect(redactName('')).toBe('[REDACTED_NAME]');
  });

  it('replaces names with special characters', () => {
    expect(redactName("O'Brien-Smith, Jr.")).toBe('[REDACTED_NAME]');
  });
});
