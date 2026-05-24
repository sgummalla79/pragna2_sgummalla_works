import { describe, it, expect } from 'vitest';
import {
  initialFormValues,
  validateField,
  validateForm,
  coerceForSubmit,
  type AskUserField,
  type AskUserSchema,
} from '@/presentation/views/chat/components/form/validators';

function field(overrides: Partial<AskUserField>): AskUserField {
  return {
    name: 'f',
    type: 'text',
    label: 'Field',
    required: false,
    ...overrides,
  } as AskUserField;
}

describe('initialFormValues', () => {
  it('seeds daterange fields as {start: "", end: ""} so the controlled inputs render', () => {
    const schema: AskUserSchema = {
      fields: [
        field({ name: 'range', type: 'daterange', label: 'Pick range' }),
      ],
      allow_text_input: false,
    };
    expect(initialFormValues(schema)).toEqual({ range: { start: '', end: '' } });
  });

  it('seeds non-daterange fields with empty primitives', () => {
    const schema: AskUserSchema = {
      fields: [
        field({ name: 't', type: 'text', label: 'T' }),
        field({ name: 'm', type: 'multiselect', label: 'M' }),
        field({ name: 'c', type: 'checkbox', label: 'C' }),
        field({ name: 'n', type: 'number', label: 'N' }),
        field({ name: 'd', type: 'date', label: 'D' }),
        field({ name: 'f', type: 'file', label: 'F' }),
      ],
      allow_text_input: false,
    };
    const seeded = initialFormValues(schema);
    expect(seeded.t).toBe('');
    expect(seeded.m).toEqual([]);
    expect(seeded.c).toBe(false);
    expect(seeded.n).toBe('');
    expect(seeded.d).toBe('');
    expect(seeded.f).toBe('');
  });
});

describe('validateField — R7 new field types', () => {
  describe('file', () => {
    it('passes when value is a non-empty attachment id string', () => {
      const result = validateField(
        field({ name: 'doc', type: 'file', label: 'Doc' }),
        'attachment-uuid-123',
      );
      expect(result).toBeNull();
    });

    it('flags required+empty as missing using the standard required gate', () => {
      const result = validateField(
        field({ name: 'doc', type: 'file', label: 'Doc', required: true }),
        '',
      );
      expect(result).toMatch(/required/i);
    });

    it('flags non-string values (defensive — wire shape should always be a string)', () => {
      const result = validateField(
        field({ name: 'doc', type: 'file', label: 'Doc' }),
        { id: 'foo' } as unknown,
      );
      expect(result).toMatch(/not yet uploaded/i);
    });
  });

  describe('date', () => {
    it('accepts a valid ISO YYYY-MM-DD string', () => {
      const result = validateField(
        field({ name: 'd', type: 'date', label: 'D' }),
        '2026-05-24',
      );
      expect(result).toBeNull();
    });

    it('rejects malformed date strings (the native picker emits ISO but pastes / tampering can slip through)', () => {
      const result = validateField(
        field({ name: 'd', type: 'date', label: 'D' }),
        '05/24/2026',
      );
      expect(result).toMatch(/valid date/i);
    });

    it('rejects non-string values', () => {
      const result = validateField(
        field({ name: 'd', type: 'date', label: 'D' }),
        20260524,
      );
      expect(result).toMatch(/valid date/i);
    });
  });

  describe('daterange', () => {
    it('accepts a valid {start, end} object where end >= start', () => {
      const result = validateField(
        field({ name: 'r', type: 'daterange', label: 'Range' }),
        { start: '2026-05-01', end: '2026-05-24' },
      );
      expect(result).toBeNull();
    });

    it('treats a half-filled range as missing (end empty)', () => {
      const result = validateField(
        field({ name: 'r', type: 'daterange', label: 'Range', required: true }),
        { start: '2026-05-01', end: '' },
      );
      expect(result).toMatch(/required/i);
    });

    it('treats a half-filled range as missing (start empty)', () => {
      const result = validateField(
        field({ name: 'r', type: 'daterange', label: 'Range', required: true }),
        { start: '', end: '2026-05-24' },
      );
      expect(result).toMatch(/required/i);
    });

    it('rejects when end is before start', () => {
      const result = validateField(
        field({ name: 'r', type: 'daterange', label: 'Range' }),
        { start: '2026-05-24', end: '2026-05-01' },
      );
      expect(result).toMatch(/end date must be on or after start/i);
    });

    it('rejects when either half is not a valid ISO date', () => {
      const result = validateField(
        field({ name: 'r', type: 'daterange', label: 'Range' }),
        { start: '2026-05-01', end: 'tomorrow' },
      );
      expect(result).toMatch(/valid start and end/i);
    });
  });
});

describe('validateForm + coerceForSubmit interplay (R7)', () => {
  it('validates all fields and surfaces per-field errors keyed by name', () => {
    const schema: AskUserSchema = {
      fields: [
        field({ name: 'd', type: 'date', label: 'D', required: true }),
        field({ name: 'r', type: 'daterange', label: 'R', required: true }),
      ],
      allow_text_input: false,
    };
    const errors = validateForm(schema, { d: '', r: { start: '', end: '' } });
    expect(errors.d).toMatch(/required/i);
    expect(errors.r).toMatch(/required/i);
  });

  it('coerces numbers but leaves new field types untouched (file/date/daterange pass through as-is)', () => {
    const schema: AskUserSchema = {
      fields: [
        field({ name: 'n', type: 'number', label: 'N' }),
        field({ name: 'f', type: 'file', label: 'F' }),
        field({ name: 'd', type: 'date', label: 'D' }),
        field({ name: 'r', type: 'daterange', label: 'R' }),
      ],
      allow_text_input: false,
    };
    const out = coerceForSubmit(schema, {
      n: '42',
      f: 'att-1',
      d: '2026-05-24',
      r: { start: '2026-05-01', end: '2026-05-24' },
    });
    expect(out.n).toBe(42);
    expect(out.f).toBe('att-1');
    expect(out.d).toBe('2026-05-24');
    expect(out.r).toEqual({ start: '2026-05-01', end: '2026-05-24' });
  });
});
