import { useRef } from 'react';
import { Paperclip, X } from 'lucide-react';
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
import { useUploadAttachment } from '@/presentation/hooks/attachments/useUploadAttachment';
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
  /** R7: the ``file`` field type uploads to the attachments backend
   *  and stores the resulting attachment_id as its value. The upload
   *  needs a ``conversationId``. Other field types ignore this prop.
   *  When the upload context is absent (e.g. brand-new chat without
   *  a materialised conversation row), the file input renders disabled
   *  with a hint. */
  uploadContext?: { conversationId: string };
}

export function FormField({
  field,
  value,
  onChange,
  error,
  disabled,
  uploadContext,
}: FormFieldProps) {
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

      {renderInput({ field, value, onChange, disabled, id, uploadContext })}

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
  uploadContext?: { conversationId: string };
}

function renderInput({ field, value, onChange, disabled, id, uploadContext }: RenderInputProps) {
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

    case 'date':
      // R7: native <input type="date"> emits YYYY-MM-DD on every modern
      // browser. The backend validator enforces the same shape.
      return (
        <Input
          {...common}
          type="date"
          value={typeof value === 'string' ? value : ''}
          min={field.min !== undefined ? String(field.min) : undefined}
          max={field.max !== undefined ? String(field.max) : undefined}
          onChange={(e) => onChange(e.target.value)}
        />
      );

    case 'daterange': {
      // R7: two native date inputs side-by-side; the end input's `min`
      // mirrors `start` so the user can't pick an earlier end date.
      const range =
        typeof value === 'object' && value !== null
          ? (value as { start?: string; end?: string })
          : { start: '', end: '' };
      const start = range.start ?? '';
      const end = range.end ?? '';
      return (
        <div className="flex items-center gap-2">
          <Input
            id={id}
            disabled={disabled}
            type="date"
            value={start}
            onChange={(e) => onChange({ start: e.target.value, end })}
            aria-label={`${field.label} (start)`}
          />
          <span className="text-[12px] text-muted-foreground">to</span>
          <Input
            disabled={disabled}
            type="date"
            value={end}
            min={start || undefined}
            onChange={(e) => onChange({ start, end: e.target.value })}
            aria-label={`${field.label} (end)`}
          />
        </div>
      );
    }

    case 'file':
      return (
        <FileFieldInput
          id={id}
          value={typeof value === 'string' ? value : ''}
          onChange={(next) => onChange(next)}
          disabled={disabled}
          uploadContext={uploadContext}
          required={field.required}
        />
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


// ── R7 Tier 1 #2: file field renderer ────────────────────────────────


interface FileFieldInputProps {
  id: string;
  /** Current attachment_id (empty string before upload). */
  value: string;
  /** Setter — called with the attachment_id once the upload settles. */
  onChange: (next: string) => void;
  disabled?: boolean;
  uploadContext?: { conversationId: string };
  required?: boolean;
}

/**
 * Pick-and-upload UX for the ``file`` ask_user field.
 *
 * Renders a "Choose file" button that opens the native file picker,
 * uploads via :func:`useUploadAttachment`, and stores the resulting
 * attachment_id as the field value. Once uploaded the button is
 * replaced with a chip showing the filename + an × to clear (which
 * blanks the value so the required-field gate re-engages and the
 * user can pick a different file).
 *
 * Disabled when ``uploadContext`` is absent — the chat surface
 * passes the active ``conversationId`` only when there's a
 * materialised conversation row; brand-new chats won't have one
 * yet, so we surface a hint instead of breaking the upload.
 */
function FileFieldInput({
  id,
  value,
  onChange,
  disabled,
  uploadContext,
  required: _required,
}: FileFieldInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const upload = useUploadAttachment();
  // We track the filename locally so the chip can show what the user
  // picked. The wire value is the attachment_id; filename never
  // round-trips through the form value.
  const filenameRef = useRef<string>('');

  if (!uploadContext) {
    // No conversation context yet — render disabled with a hint
    // instead of silently no-op'ing the click.
    return (
      <p className="text-[12px] text-muted-foreground">
        File upload becomes available once the chat is initialised.
      </p>
    );
  }

  if (value) {
    return (
      <div className="inline-flex items-center gap-2 rounded-md border border-border bg-card px-2 py-1.5 text-[12px]">
        <Paperclip size={12} className="text-muted-foreground" aria-hidden="true" />
        <span className="truncate max-w-[200px]" title={filenameRef.current || value}>
          {filenameRef.current || value}
        </span>
        <button
          type="button"
          onClick={() => {
            filenameRef.current = '';
            onChange('');
          }}
          aria-label="Remove file"
          className="flex h-4 w-4 items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-foreground"
        >
          <X size={10} aria-hidden="true" />
        </button>
      </div>
    );
  }

  const busy = upload.isPending;
  return (
    <div className="flex items-center gap-2">
      <input
        ref={inputRef}
        id={id}
        type="file"
        disabled={disabled || busy}
        className="hidden"
        onChange={async (e) => {
          const file = e.target.files?.[0];
          if (!file) return;
          filenameRef.current = file.name;
          // Allow re-picking the same filename in succession.
          e.target.value = '';
          try {
            const attachment = await upload.mutateAsync({
              conversationId: uploadContext.conversationId,
              file,
            });
            onChange(attachment.id);
          } catch {
            filenameRef.current = '';
            // Upload errors surface via upload.error below.
          }
        }}
      />
      <button
        type="button"
        disabled={disabled || busy}
        onClick={() => inputRef.current?.click()}
        className="rounded-md border border-border bg-card px-3 py-1.5 text-[12px] hover:bg-accent disabled:opacity-60 disabled:cursor-not-allowed"
      >
        {busy ? 'Uploading…' : 'Choose file'}
      </button>
      {upload.isError && (
        <span className="text-[12px] text-destructive">
          Upload failed. Try again.
        </span>
      )}
    </div>
  );
}
