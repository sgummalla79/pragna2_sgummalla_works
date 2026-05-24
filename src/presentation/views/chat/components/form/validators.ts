/**
 * Client-side validators for :class:`HITLFormCard` (R6b).
 *
 * Mirrors the server-side guard in
 * :func:`src.application.use_cases.episodes.resume_episode._validate_form_payload`
 * but produces user-friendly per-field messages. The server is the
 * source of truth — these validators exist to keep the user out of
 * round-trip-and-422 territory and to surface inline error text under
 * each field as they type.
 */

/** Field types accepted by the ask_user schema.
 *
 * R6b shipped six. R7 Tier 1 #2 added three more: ``file`` (returns an
 * attachment_id once the upload completes), ``date`` (ISO-8601
 * ``YYYY-MM-DD`` string), and ``daterange`` (``{start, end}`` object). */
export type AskUserFieldType =
  | 'text'
  | 'textarea'
  | 'select'
  | 'multiselect'
  | 'number'
  | 'checkbox'
  | 'file'
  | 'date'
  | 'daterange';

/** R7: ISO-8601 date shape used by the backend validator. */
const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/** Single field declaration as emitted by the LLM's ``ask_user`` tool call. */
export interface AskUserField {
  name: string;
  label: string;
  type: AskUserFieldType;
  required?: boolean;
  options?: string[];
  default_value?: unknown;
  placeholder?: string;
  /** Numeric min OR text length lower bound. */
  min?: number;
  /** Numeric max OR text length upper bound. */
  max?: number;
  /** Regex pattern; ``text`` fields only. */
  pattern?: string;
  helper_text?: string;
}

/** Full schema persisted on ``conversation_episodes.interrupt_value.schema``. */
export interface AskUserSchema {
  fields: AskUserField[];
  /** When true the chat composer rides along as the form's free-text
   *  ``text`` argument on submit. */
  allow_text_input?: boolean;
  /** Custom submit-button label. Default ``"Submit"``. */
  submit_label?: string;
}

/** ``field.name → string | null``. ``null`` means "valid". */
export type FieldErrors = Record<string, string | null>;

/** Build the initial form values from a schema. ``default_value`` is
 *  honoured where present; otherwise a type-appropriate empty value is
 *  used (so React inputs stay controlled from the first render). */
export function initialFormValues(
  schema: AskUserSchema,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const field of schema.fields) {
    if (field.default_value !== undefined) {
      out[field.name] = field.default_value;
      continue;
    }
    switch (field.type) {
      case 'multiselect':
        out[field.name] = [];
        break;
      case 'checkbox':
        out[field.name] = false;
        break;
      case 'number':
        out[field.name] = '';
        break;
      case 'daterange':
        // R7: empty start/end strings keep React inputs controlled.
        out[field.name] = { start: '', end: '' };
        break;
      case 'file':
      case 'date':
      // text / textarea / select fall through to the empty-string default.
      default:
        out[field.name] = '';
    }
  }
  return out;
}

/** Validate one field's current value against its declared rules.
 *  Returns ``null`` on pass, or a human-readable error string. */
export function validateField(
  field: AskUserField,
  value: unknown,
): string | null {
  // R7: daterange counts as "missing" when EITHER half is empty —
  // an object with one filled date is still incomplete. Same gate as
  // for required.
  const isDateRangeIncomplete =
    field.type === 'daterange' &&
    (typeof value !== 'object' ||
      value === null ||
      !(value as { start?: string }).start ||
      !(value as { end?: string }).end);

  const isMissing =
    value === undefined ||
    value === null ||
    value === '' ||
    (Array.isArray(value) && value.length === 0) ||
    isDateRangeIncomplete;

  if (field.required && isMissing) {
    return `${field.label} is required.`;
  }
  if (isMissing) return null; // non-required + empty → pass.

  switch (field.type) {
    case 'text':
    case 'textarea': {
      const str = String(value);
      if (field.min !== undefined && str.length < field.min) {
        return `${field.label} must be at least ${field.min} characters.`;
      }
      if (field.max !== undefined && str.length > field.max) {
        return `${field.label} must be at most ${field.max} characters.`;
      }
      if (field.type === 'text' && field.pattern) {
        try {
          if (!new RegExp(field.pattern).test(str)) {
            return `${field.label} doesn't match the required format.`;
          }
        } catch {
          // An invalid pattern from the LLM is a server-side problem;
          // don't block the user.
        }
      }
      return null;
    }
    case 'number': {
      const num = Number(value);
      if (Number.isNaN(num)) {
        return `${field.label} must be a number.`;
      }
      if (field.min !== undefined && num < field.min) {
        return `${field.label} must be at least ${field.min}.`;
      }
      if (field.max !== undefined && num > field.max) {
        return `${field.label} must be at most ${field.max}.`;
      }
      return null;
    }
    case 'select': {
      const options = field.options ?? [];
      if (options.length > 0 && !options.includes(String(value))) {
        return `${field.label}: pick one of the listed options.`;
      }
      return null;
    }
    case 'multiselect': {
      if (!Array.isArray(value)) {
        return `${field.label}: invalid selection.`;
      }
      const options = field.options ?? [];
      if (options.length > 0) {
        const bad = value.filter((v) => !options.includes(String(v)));
        if (bad.length > 0) {
          return `${field.label}: ${bad.join(', ')} not in options.`;
        }
      }
      return null;
    }
    case 'checkbox':
      // ``required`` was already checked above (treats false as missing).
      return null;
    case 'file': {
      // R7: value is the attachment_id once upload completes. Empty
      // string means "no upload yet" — already caught by the required
      // gate. The id format we get from the BE is a UUID v4 string;
      // the validator stays permissive here because the BE re-checks.
      if (typeof value !== 'string') {
        return `${field.label}: file not yet uploaded.`;
      }
      return null;
    }
    case 'date': {
      // R7: ISO-8601 YYYY-MM-DD. The native <input type="date"> only
      // emits this shape, but a tampered value or a paste could slip
      // through.
      if (typeof value !== 'string' || !ISO_DATE_PATTERN.test(value)) {
        return `${field.label}: pick a valid date.`;
      }
      return null;
    }
    case 'daterange': {
      // R7: {start, end} object. By this point we've ruled out missing
      // halves; check the shape + that end >= start.
      const range = value as { start: string; end: string };
      if (!ISO_DATE_PATTERN.test(range.start) || !ISO_DATE_PATTERN.test(range.end)) {
        return `${field.label}: pick valid start and end dates.`;
      }
      if (range.end < range.start) {
        return `${field.label}: end date must be on or after start.`;
      }
      return null;
    }
  }
}

/** Validate every field in the schema. Returns the field-error map. */
export function validateForm(
  schema: AskUserSchema,
  values: Record<string, unknown>,
): FieldErrors {
  const errors: FieldErrors = {};
  for (const field of schema.fields) {
    errors[field.name] = validateField(field, values[field.name]);
  }
  return errors;
}

/** True iff every entry in :func:`validateForm`'s output is ``null``. */
export function isFormValid(errors: FieldErrors): boolean {
  return Object.values(errors).every((e) => e === null);
}

/** Convert raw inputs to the wire shape the backend expects.
 *  Numbers come out of the UI as strings; coerce here. Everything else
 *  passes through. */
export function coerceForSubmit(
  schema: AskUserSchema,
  values: Record<string, unknown>,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const field of schema.fields) {
    const raw = values[field.name];
    if (field.type === 'number' && raw !== '' && raw !== undefined && raw !== null) {
      const num = Number(raw);
      out[field.name] = Number.isNaN(num) ? raw : num;
    } else {
      out[field.name] = raw;
    }
  }
  return out;
}
