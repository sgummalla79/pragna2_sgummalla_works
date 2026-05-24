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

/** R6b shipping field types. R9 adds ``file`` / ``date`` / ``daterange``. */
export type AskUserFieldType =
  | 'text'
  | 'textarea'
  | 'select'
  | 'multiselect'
  | 'number'
  | 'checkbox';

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
  const isMissing =
    value === undefined ||
    value === null ||
    value === '' ||
    (Array.isArray(value) && value.length === 0);

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
