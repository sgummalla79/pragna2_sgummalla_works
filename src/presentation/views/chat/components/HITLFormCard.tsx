import { useMemo } from 'react';
import { MessageSquareWarning } from 'lucide-react';
import { Button } from '@/presentation/components/ui/Button';
import { ConfirmButton } from '@/presentation/components/ui/ConfirmButton';
import { FormField } from './form/FormField';
import {
  type AskUserSchema,
  type FieldErrors,
  validateField,
  validateForm,
} from './form/validators';

/**
 * Inline form rendered when an LLM ``ask_user`` tool call has paused
 * the conversation (R6b).
 *
 * The schema is the live, per-turn payload the LLM emitted — every
 * field's ``type``, ``label``, ``options``, ``required``, etc. comes
 * from the model's decision in that turn. This component is a
 * polymorphic *renderer*; it has no hard-coded form templates.
 *
 * Fully controlled: ``values`` + ``textValue`` + ``touched`` live in
 * the parent (typically :class:`ChatSurface`) so the composer can
 * double as the ``text`` field when ``schema.allow_text_input`` is
 * true. The parent decides when to call ``onSubmit`` — either from
 * this card's own submit button OR from the composer's send action.
 */
export interface HITLFormCardProps {
  /** The schema persisted on ``conversation_episodes.interrupt_value.schema``.
   *  Drives every field rendered. */
  schema: AskUserSchema;
  /** Controlled field values keyed by ``field.name``. */
  values: Record<string, unknown>;
  /** Setter — called with the FULL new map on every change. */
  onValuesChange: (next: Record<string, unknown>) => void;
  /** Free-text from the composer when ``schema.allow_text_input`` is
   *  true. Empty string when ``allow_text_input`` is false (the
   *  composer is hidden in that case). */
  textValue: string;
  /** Per-field "user has touched this field at least once" bitmap.
   *  Drives whether validation messages render — keeps the form from
   *  screaming red on first render. */
  touched: Record<string, boolean>;
  /** Setter for the touched bitmap. */
  onTouchedChange: (next: Record<string, boolean>) => void;
  /** Called when the user clicks Submit on the card. Parent reads
   *  ``values`` + ``textValue`` from its own state and dispatches the
   *  resume mutation. */
  onSubmit: () => void;
  /** True while the resume mutation is in flight. Inputs + submit are
   *  disabled. */
  submitting?: boolean;
  /** Error from the resume mutation, if any. Rendered as a banner. */
  errorMessage?: string | null;
  /** R7 Tier 1 #2: forwarded to each :class:`FormField` so the new
   *  ``file`` field type can dispatch uploads to the active
   *  conversation. Absent on brand-new chats whose row hasn't
   *  materialised yet; the file field renders disabled with a hint
   *  in that case. */
  uploadContext?: { conversationId: string };
  /** R7.1#3 — user-initiated cancel of the paused episode. When set,
   *  a Cancel button renders next to Submit and triggers a confirm
   *  dialog before firing the mutation. The parent owns the actual
   *  ``useCancelEpisode`` mutation and any post-cancel side-effects
   *  (composer focus, query invalidations, etc.). Absent in tests /
   *  storybook stubs where cancellation isn't wired. */
  onCancel?: () => void;
  /** R7.1#3 — disables the Cancel button while the cancel mutation is
   *  in flight, so a slow DELETE can't get double-clicked. */
  cancelling?: boolean;
}

/** True iff every field passes the per-field validator. Exported so
 *  the parent can mirror the same gate on the composer's send button
 *  when the form-mode wiring is active. */
export function isHITLFormSubmittable(
  schema: AskUserSchema,
  values: Record<string, unknown>,
): boolean {
  const errors = validateForm(schema, values);
  return Object.values(errors).every((e) => e === null);
}

export function HITLFormCard({
  schema,
  values,
  onValuesChange,
  textValue: _textValue, // unused inside the card body — parent owns submit dispatch
  touched,
  onTouchedChange,
  onSubmit,
  submitting = false,
  errorMessage,
  uploadContext,
  onCancel,
  cancelling = false,
}: HITLFormCardProps) {
  // Touch _textValue so the variable isn't tree-shaken from the
  // closure — it's documented as part of the public API and a future
  // visual rendering (e.g. "your composer text will be sent: '...'")
  // would consume it. Lints won't flag this no-op.
  void _textValue;

  const errors = useMemo<FieldErrors>(
    () => validateForm(schema, values),
    [schema, values],
  );
  const canSubmit = Object.values(errors).every((e) => e === null) && !submitting;
  const submitLabel = schema.submit_label?.trim() || 'Submit';

  function setFieldValue(name: string, next: unknown) {
    onValuesChange({ ...values, [name]: next });
    if (!touched[name]) onTouchedChange({ ...touched, [name]: true });
  }

  function handleSubmit(e?: React.FormEvent) {
    e?.preventDefault();
    // Mark every field as touched so any latent error becomes visible.
    onTouchedChange(
      Object.fromEntries(schema.fields.map((f) => [f.name, true])),
    );
    if (!canSubmit) return;
    onSubmit();
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="my-2 rounded-lg border-2 border-primary/30 bg-accent/40 p-4 text-[13px]"
    >
      <div className="flex items-center gap-2">
        <MessageSquareWarning size={16} className="text-primary" aria-hidden="true" />
        <span className="font-semibold text-foreground">
          The agent needs your input
        </span>
      </div>

      <div className="mt-3 flex flex-col gap-3">
        {schema.fields.map((field) => (
          <FormField
            key={field.name}
            field={field}
            value={values[field.name]}
            onChange={(next) => setFieldValue(field.name, next)}
            // Only surface validation messages after the field has been
            // interacted with at least once — avoids screaming red on
            // first render when every required field is empty.
            error={touched[field.name] ? validateField(field, values[field.name]) : null}
            disabled={submitting}
            uploadContext={uploadContext}
          />
        ))}
      </div>

      {errorMessage && (
        <p className="mt-3 text-[12px] text-destructive" role="alert">{errorMessage}</p>
      )}

      <div className="mt-4 flex items-center justify-end gap-2">
        {/* When the composer is hosting the free-text field, surface a
            small hint so the user knows where their typed text will
            land. Kept very subtle on purpose. */}
        {schema.allow_text_input && (
          <span className="mr-auto text-[11px] text-muted-foreground">
            Your composer text submits with this form.
          </span>
        )}
        {/* R7.1#3 — Cancel is destructive (discards any typed form
            values) so it's gated behind ConfirmButton per the
            destructive-actions-confirm rule. Rendered as a subtle
            ghost button so Submit stays the primary action. */}
        {onCancel && (
          <ConfirmButton
            type="button"
            variant="ghost"
            size="sm"
            disabled={cancelling || submitting}
            confirmTitle="Cancel this episode?"
            confirmDescription="Any values you've typed will be discarded and the conversation will resume on the default chat agent."
            confirmLabel="Cancel episode"
            cancelLabel="Keep editing"
            onConfirm={onCancel}
          >
            {cancelling ? 'Cancelling…' : 'Cancel'}
          </ConfirmButton>
        )}
        <Button type="submit" disabled={!canSubmit}>
          {submitting ? 'Submitting…' : submitLabel}
        </Button>
      </div>
    </form>
  );
}
