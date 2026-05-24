import { Input } from '@/presentation/components/ui/Input';
import { Label } from '@/presentation/components/ui/Label';
import { Textarea } from '@/presentation/components/ui/Textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/presentation/components/ui/Select';
import type { AskUserField } from './validators';

/**
 * Polymorphic primitive that renders ONE field from an ``ask_user``
 * schema (R6b).
 *
 * The LLM picks ``field.type`` per-turn; this component picks the right
 * input element to match. Six types in R6b: ``text``, ``textarea``,
 * ``select``, ``multiselect``, ``number``, ``checkbox``. R9 will add
 * ``file`` / ``date`` / ``daterange`` — extend this switch when those
 * land. Anything else surfaces as a plain-text fallback so a
 * mis-typed schema degrades gracefully rather than blanking the form.
 */
export interface FormFieldProps {
  /** Field declaration from the schema. */
  field: AskUserField;
  /** Controlled value. Types vary by ``field.type``. */
  value: unknown;
  /** Setter — called with the new value on every change. */
  onChange: (next: unknown) => void;
  /** When non-null, rendered as an inline error message under the
   *  field. Coming from :func:`validateField`. */
  error?: string | null;
  /** Disable the input (e.g. while the resume mutation is in flight). */
  disabled?: boolean;
}

export function FormField({ field, value, onChange, error, disabled }: FormFieldProps) {
  const id = `hitl-field-${field.name}`;
  const requiredMark = field.required ? <span className="text-destructive ml-0.5">*</span> : null;

  return (
    <div className="flex flex-col gap-1.5">
      {/* Checkbox has its own row-style layout — the inline label is
          rendered next to the input below. Other types get the standard
          label-above-input treatment. */}
      {field.type !== 'checkbox' && (
        <Label htmlFor={id} className="text-[13px] font-medium">
          {field.label}
          {requiredMark}
        </Label>
      )}

      {renderInput({ field, value, onChange, disabled, id })}

      {field.helper_text && !error && (
        <p className="text-[12px] text-muted-foreground">{field.helper_text}</p>
      )}
      {error && (
        <p className="text-[12px] text-destructive" role="alert">{error}</p>
      )}
    </div>
  );
}

interface RenderInputProps {
  field: AskUserField;
  value: unknown;
  onChange: (next: unknown) => void;
  disabled?: boolean;
  id: string;
}

function renderInput({ field, value, onChange, disabled, id }: RenderInputProps) {
  const common = { id, disabled };

  switch (field.type) {
    case 'text':
      return (
        <Input
          {...common}
          type="text"
          value={String(value ?? '')}
          placeholder={field.placeholder}
          maxLength={field.max}
          onChange={(e) => onChange(e.target.value)}
        />
      );

    case 'textarea':
      return (
        <Textarea
          {...common}
          value={String(value ?? '')}
          placeholder={field.placeholder}
          maxLength={field.max}
          rows={3}
          onChange={(e) => onChange(e.target.value)}
        />
      );

    case 'number':
      return (
        <Input
          {...common}
          type="number"
          value={value === undefined || value === null ? '' : String(value)}
          placeholder={field.placeholder}
          min={field.min}
          max={field.max}
          onChange={(e) => onChange(e.target.value)}
        />
      );

    case 'select': {
      const str = value == null ? '' : String(value);
      return (
        <Select
          value={str || undefined}
          onValueChange={(v) => onChange(v)}
          disabled={disabled}
        >
          <SelectTrigger id={id}>
            <SelectValue placeholder={field.placeholder ?? '— select one —'} />
          </SelectTrigger>
          <SelectContent>
            {(field.options ?? []).map((opt) => (
              <SelectItem key={opt} value={opt}>{opt}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      );
    }

    case 'multiselect': {
      // No Radix multi-select primitive in the kit — render a stacked
      // checkbox list. Cheap, accessible, and visibly distinct from
      // single-select.
      const selected = new Set(
        Array.isArray(value) ? (value as unknown[]).map(String) : [],
      );
      return (
        <div className="flex flex-col gap-1 rounded-lg border border-border bg-input p-2">
          {(field.options ?? []).map((opt) => {
            const checked = selected.has(opt);
            return (
              <label
                key={opt}
                className="flex cursor-pointer items-center gap-2 text-[13px]"
              >
                <input
                  type="checkbox"
                  checked={checked}
                  disabled={disabled}
                  onChange={(e) => {
                    const next = new Set(selected);
                    if (e.target.checked) next.add(opt);
                    else next.delete(opt);
                    onChange(Array.from(next));
                  }}
                />
                {opt}
              </label>
            );
          })}
        </div>
      );
    }

    case 'checkbox':
      return (
        <label className="flex cursor-pointer items-center gap-2 text-[13px]">
          <input
            id={id}
            type="checkbox"
            checked={Boolean(value)}
            disabled={disabled}
            onChange={(e) => onChange(e.target.checked)}
          />
          <span>
            {field.label}
            {field.required ? <span className="text-destructive ml-0.5">*</span> : null}
          </span>
        </label>
      );

    default:
      // Unknown future type → render as text so the form still works
      // end-to-end. Server-side validator will catch the actual
      // unknown-type case if it ever escapes through the LLM.
      return (
        <Input
          {...common}
          type="text"
          value={String(value ?? '')}
          placeholder={field.placeholder}
          onChange={(e) => onChange(e.target.value)}
        />
      );
  }
}
