import { useEffect, useState } from 'react';
import { useUpdateFlowSlashExposure } from '@/presentation/hooks/flows/useFlows';
import type { Flow } from '@/domain/types/flow.types';
import { Badge } from '@/presentation/components/ui/Badge';
import { Button } from '@/presentation/components/ui/Button';

/** Kebab-case pattern enforced server-side at write time. Locally we
 *  pre-validate so the user gets immediate feedback before the PATCH
 *  round-trip. Keep in sync with the BE's ``SLASH_API_NAME_PATTERN``. */
const SLASH_API_NAME_RE = /^[a-z][a-z0-9-]*$/;

interface Props {
  flow: Flow;
}

/** Slash-exposure row rendered inside the flow card on FlowBuilderView.
 *
 *  Lets the user (a) toggle whether the flow is invocable as a /slash
 *  command AND (b) edit the slash name. Backed by PATCH
 *  ``/api/flows/{id}/slash-exposure``. The same flag controls LLM-tool
 *  binding on the default chat agent — there is intentionally one knob
 *  for both surfaces (locked design call). */
export function SlashExposureRow({ flow }: Props) {
  const [name, setName] = useState(flow.slashApiName ?? '');
  const [exposed, setExposed] = useState(flow.exposedAsSlash);
  const [serverError, setServerError] = useState<string | null>(null);

  // Re-sync when the underlying flow changes (mutation invalidates the
  // query, the cache returns a fresh entity, the prop changes).
  useEffect(() => {
    setName(flow.slashApiName ?? '');
    setExposed(flow.exposedAsSlash);
  }, [flow.slashApiName, flow.exposedAsSlash]);

  const mutation = useUpdateFlowSlashExposure();

  const trimmedName = name.trim();
  const nameValid = trimmedName === '' || SLASH_API_NAME_RE.test(trimmedName);
  const wantsExposure = exposed;
  const descriptionMissing =
    wantsExposure && !(flow.description ?? '').trim();
  const blocked = wantsExposure && (!trimmedName || !nameValid || descriptionMissing);
  const dirty =
    trimmedName !== (flow.slashApiName ?? '') || exposed !== flow.exposedAsSlash;
  const canSave = dirty && !blocked && !mutation.isPending;

  const onSave = () => {
    setServerError(null);
    const payload = {
      exposedAsSlash: exposed,
      ...(trimmedName
        ? { slashApiName: trimmedName }
        : { clearSlashApiName: true }),
    };
    mutation.mutate(
      { flowId: flow.id, payload },
      {
        onError: (err: unknown) => {
          const message =
            (err as { response?: { data?: { detail?: string } } })?.response?.data
              ?.detail ?? 'Failed to update slash exposure.';
          setServerError(String(message));
        },
      },
    );
  };

  return (
    <div className="flex flex-col gap-2 pt-3 border-t border-border/40 text-xs">
      <div className="flex items-center gap-3">
        <label className="flex items-center gap-1.5 cursor-pointer">
          <input
            type="checkbox"
            checked={exposed}
            onChange={(e) => setExposed(e.target.checked)}
            aria-label={`Expose ${flow.displayName} as a /slash command`}
          />
          <span>Expose as /slash command</span>
        </label>
        {flow.exposedAsSlash && flow.slashApiName && (
          <Badge variant="default">/{flow.slashApiName}</Badge>
        )}
      </div>
      <div className="flex items-center gap-2">
        <span className="text-muted-foreground">/</span>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="kebab-case-name"
          aria-label="Slash command name"
          className="flex-1 px-2 py-1 rounded border border-border bg-background text-foreground"
          disabled={!exposed}
        />
        <Button
          size="sm"
          variant="outline"
          disabled={!canSave}
          onClick={onSave}
        >
          {mutation.isPending ? 'Saving…' : 'Save'}
        </Button>
      </div>
      {!nameValid && trimmedName && (
        <p className="text-red-500">
          Use lowercase letters, digits, and hyphens; must start with a letter.
        </p>
      )}
      {descriptionMissing && (
        <p className="text-amber-500">
          Add a flow description before exposing — the LLM uses it as the tool description.
        </p>
      )}
      {serverError && <p className="text-red-500">{serverError}</p>}
    </div>
  );
}
