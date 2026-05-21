import { useMemo, useState } from 'react';
import { Button } from '@/presentation/components/ui/Button';
import { useBulkUpdateModels } from '@/presentation/hooks/models/useModels';
import { ModelGrid } from './ModelGrid';
import type { Model, UpdateModelPayload } from '@/domain/types/model.types';

interface ConnectedPanelProps {
  models: Model[];
  /** Surface for errors raised by the disconnect button (rendered in the modal header). */
  error: string;
  refreshing: boolean;
  onRefresh: () => void;
}

/**
 * Modal panel shown when the provider is already connected.
 *
 * Owns a `pendingChanges` buffer keyed by model id. Toggles + name
 * edits flow into the buffer via {@link ModelGrid}'s `onCellChange`,
 * the grid renders effective rows (model merged with its pending
 * partial), and the top toolbar exposes Save / Cancel:
 *
 *  - **Save** flushes every pending change through the bulk PATCH
 *    endpoint in a single transaction.
 *  - **Cancel** discards the buffer and remounts the grid to wipe its
 *    internal cell state (per-row input drafts).
 *
 * Refresh stays on the same row so the user has every grid-level
 * action visible at once.
 */
export function ConnectedPanel({
  models,
  error,
  refreshing,
  onRefresh,
}: ConnectedPanelProps) {
  const [pendingChanges, setPendingChanges] = useState<Record<string, UpdateModelPayload>>({});
  // Remount-key bumped on Save / Cancel so DataGrid's internal cell
  // drafts (editable input state) reset to the new effective values.
  const [resetKey, setResetKey] = useState(0);

  const bulkUpdate = useBulkUpdateModels();

  const effectiveModels = useMemo<Model[]>(
    () => models.map((m) => ({ ...m, ...applyPending(m, pendingChanges[m.id]) })),
    [models, pendingChanges],
  );

  const dirtyCount = Object.keys(pendingChanges).length;
  const isDirty = dirtyCount > 0;
  const saving = bulkUpdate.isPending;

  function handleCellChange(id: string, payload: UpdateModelPayload) {
    setPendingChanges((prev) => {
      const merged = { ...(prev[id] ?? {}), ...payload };
      // If the merged partial brings the row back to its original values,
      // drop the entry so the buffer accurately reflects "what's dirty".
      const original = models.find((m) => m.id === id);
      if (original && isNoOp(original, merged)) {
        const { [id]: _drop, ...rest } = prev;
        void _drop;
        return rest;
      }
      return { ...prev, [id]: merged };
    });
  }

  function handleCancel() {
    setPendingChanges({});
    setResetKey((v) => v + 1);
  }

  async function handleSave() {
    if (!isDirty || saving) return;
    const updates = Object.entries(pendingChanges).map(([id, payload]) => ({ id, ...payload }));
    await bulkUpdate.mutateAsync(updates);
    setPendingChanges({});
    setResetKey((v) => v + 1);
  }

  return (
    <div className="flex flex-col gap-5 flex-1 min-h-0">
      {error && (
        <p role="alert" className="text-[13px] text-[#ef4444]">{error}</p>
      )}

      {/* Models header + grid-level actions */}
      <div className="flex items-center justify-between">
        <div className="flex flex-col gap-0.5">
          <span className="text-sm font-bold text-[#ececea]">
            Models
            {models.length > 0 && (
              <span className="ml-2 text-[11px] font-normal text-[#737373]">
                {models.length} discovered
              </span>
            )}
            {isDirty && (
              <span className="ml-2 text-[11px] font-normal text-[var(--color-brand)]">
                · {dirtyCount} unsaved {dirtyCount === 1 ? 'change' : 'changes'}
              </span>
            )}
          </span>
          <span className="text-[11px] text-[#737373]">
            Click display name to rename · Dots toggle on/off · Save commits all changes at once
          </span>
        </div>
        <div className="flex items-center gap-2">
          {isDirty && (
            <>
              <Button variant="ghost" size="sm" onClick={handleCancel} disabled={saving}>
                Cancel
              </Button>
              <Button
                variant="default"
                size="sm"
                onClick={handleSave}
                disabled={saving}
                aria-busy={saving}
              >
                {saving ? 'Saving…' : `Save${dirtyCount > 1 ? ` (${dirtyCount})` : ''}`}
              </Button>
            </>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={onRefresh}
            disabled={refreshing || saving}
            aria-busy={refreshing}
          >
            {refreshing ? 'Refreshing…' : 'Refresh'}
          </Button>
        </div>
      </div>

      {/* Model grid — fills remaining space, scrolls within itself
          (sticky <thead> keeps the column headers visible). */}
      <ModelGrid
        key={resetKey}
        models={effectiveModels}
        onCellChange={handleCellChange}
        className="flex-1 min-h-0"
      />
    </div>
  );
}

/**
 * Reduces a partial payload to only the keys whose value differs from
 * the underlying model. Empty result = "this entry no longer dirties
 * anything" and should be dropped from the buffer.
 */
function applyPending(_model: Model, partial: UpdateModelPayload | undefined): Partial<Model> {
  if (!partial) return {};
  const out: Partial<Model> = {};
  if (partial.enabled            !== undefined) out.enabled            = partial.enabled;
  if (partial.availableForChat   !== undefined) out.availableForChat   = partial.availableForChat;
  if (partial.availableForFlows  !== undefined) out.availableForFlows  = partial.availableForFlows;
  if (partial.displayName        !== undefined) out.displayName        = partial.displayName;
  if (partial.metadata           !== undefined) out.metadata           = partial.metadata;
  return out;
}

/** True when every field in `partial` matches the corresponding field on `original`. */
function isNoOp(original: Model, partial: UpdateModelPayload): boolean {
  if (partial.enabled           !== undefined && partial.enabled           !== original.enabled)           return false;
  if (partial.availableForChat  !== undefined && partial.availableForChat  !== original.availableForChat)  return false;
  if (partial.availableForFlows !== undefined && partial.availableForFlows !== original.availableForFlows) return false;
  if (partial.displayName       !== undefined && partial.displayName       !== original.displayName)       return false;
  // metadata is merge-update; we can't cheaply tell if the merge is a
  // no-op so always treat metadata edits as dirty.
  if (partial.metadata !== undefined) return false;
  return true;
}
