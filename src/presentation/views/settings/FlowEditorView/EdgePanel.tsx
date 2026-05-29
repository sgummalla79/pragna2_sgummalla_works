/**
 * Side-panel edge inspector for the selected canvas edge.
 *
 * Opens when the user clicks an edge. Mirrors the NodePanel chrome
 * (collapsible right-side rail) but focused entirely on edge config:
 *
 *   - Read-only source → target identity.
 *   - Read-only routing condition (derived from the source handle on
 *     branching nodes; always `default` otherwise — the inline picker
 *     was removed in the #33 redesign).
 *   - **Dynamic fan-out (#35)** — toggle + items_slot/item_slot selects.
 *     When the source agent already branches via `emits`, the toggle is
 *     gated off (v1 mutual-exclusion locked at design time).
 *   - Delete edge button.
 *
 * Edits write to the Zustand store via `updateEdgeData` / `deleteEdge`
 * only — nothing is persisted until the flow is Saved.
 */

import { Info, Trash2, X } from 'lucide-react';

import { Button } from '@/presentation/components/ui/Button';
import { Label } from '@/presentation/components/ui/Label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/presentation/components/ui/Select';
import {
  type AgentNodeData,
  type ConditionEdgeData,
  DISPATCH_MODE_PER_ITEM,
  NODE_TYPE_AGENT,
  SLOT_USER_QUERY,
  isEndInstanceId,
} from './editorTypes';
import { useFlowEditorStore } from './useFlowEditorStore';

/** Special sentinel for the items_slot dropdown's "off" entry. Selects
 *  use string-only values; we map "none" → undefined when writing back. */
const DISPATCH_OFF = 'off';

/** A literal value the items_slot dropdown ALWAYS offers — the BE
 *  resolves it from the latest user message rather than a real channel. */
const ITEMS_SLOT_OPTIONS_BUILTIN: readonly string[] = [SLOT_USER_QUERY];

export function EdgePanel() {
  const selectedEdgeId = useFlowEditorStore((s) => s.selectedEdgeId);
  const edge = useFlowEditorStore((s) =>
    s.edges.find((e) => e.id === s.selectedEdgeId),
  );
  const sourceNode = useFlowEditorStore((s) =>
    s.nodes.find((n) => n.id === edge?.source),
  );
  const targetNode = useFlowEditorStore((s) =>
    s.nodes.find((n) => n.id === edge?.target),
  );
  const updateEdgeData = useFlowEditorStore((s) => s.updateEdgeData);
  const deleteEdge = useFlowEditorStore((s) => s.deleteEdge);
  const selectEdge = useFlowEditorStore((s) => s.selectEdge);

  if (!edge || !selectedEdgeId) return null;

  const data: ConditionEdgeData = edge.data ?? { condition: 'default' };
  const dispatchOn = data.dispatchMode === DISPATCH_MODE_PER_ITEM;

  // ── Mutual-exclusion gate (#35 Fork 3) ─────────────────────────────
  // The source's agent (if it's an agent node) carries an `emits` list.
  // Non-empty emits means the node already branches via `set_route` and
  // can't ALSO fan out (v1 design decision — relaxable later).
  const sourceIsAgent = sourceNode?.type === NODE_TYPE_AGENT;
  const sourceEmits = sourceIsAgent
    ? (sourceNode!.data as AgentNodeData).agent.emits
    : [];
  const dispatchBlockedReason = !sourceIsAgent
    ? 'Dispatch is only available on edges from agent nodes (not __start__ or boundary nodes).'
    : sourceEmits.length > 0
      ? `Agent "${(sourceNode!.data as AgentNodeData).agent.apiName}" already branches via emits ${JSON.stringify(sourceEmits)}. A node either branches or fans out — not both (v1).`
      : null;

  // ── Validator hints surfaced inline ────────────────────────────────
  // The BE rejects dispatch to multiple targets / boundaries; we display
  // this constraint up-front to avoid a 422 round-trip on Save.
  const targetIsBoundary = !targetNode || targetNode.type !== NODE_TYPE_AGENT;
  const targetIsEnd = isEndInstanceId(edge.target);
  const targetBlockedReason = targetIsEnd
    ? 'Dispatch target cannot be __end__ (the per-instance Send must hit a concrete node).'
    : targetIsBoundary
      ? 'Dispatch target must be a concrete agent node.'
      : null;

  // ── Slot autocomplete options ──────────────────────────────────────
  // items_slot is fed by an upstream node's `outputs`. For v1 we offer
  // the SOURCE node's outputs (the common pattern) PLUS the reserved
  // `user_query` virtual slot. A future enhancement could walk further
  // upstream — but the source-only choice mirrors typical authoring.
  const sourceOutputs = sourceIsAgent
    ? ((sourceNode!.data as AgentNodeData).outputs ?? [])
    : [];
  const itemsSlotOptions = [
    ...sourceOutputs,
    ...ITEMS_SLOT_OPTIONS_BUILTIN,
  ];
  // item_slot must be in the TARGET node's `inputs` (BE validator rule).
  const targetInputs =
    targetNode?.type === NODE_TYPE_AGENT
      ? ((targetNode.data as AgentNodeData).inputs ?? [])
      : [];

  function setDispatchOn(on: boolean) {
    if (on) {
      // Preserve existing slot picks if the user toggles off/on again.
      updateEdgeData(selectedEdgeId!, {
        dispatchMode: DISPATCH_MODE_PER_ITEM,
        itemsSlot: data.itemsSlot ?? itemsSlotOptions[0],
        itemSlot: data.itemSlot ?? targetInputs[0],
      });
    } else {
      // All-or-none invariant — clear all three together.
      updateEdgeData(selectedEdgeId!, {
        dispatchMode: undefined,
        itemsSlot: undefined,
        itemSlot: undefined,
      });
    }
  }

  return (
    <aside
      className="w-[360px] shrink-0 border-l border-border bg-surface overflow-y-auto"
      data-testid="edge-panel"
    >
      <div className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-surface px-4 py-3">
        <div className="flex flex-col">
          <h2 className="text-sm font-semibold">Edge</h2>
          <p className="text-xs text-muted-foreground">
            {edge.source}
            {' → '}
            {edge.target}
          </p>
        </div>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Close edge inspector"
          onClick={() => selectEdge(null)}
        >
          <X className="size-4" />
        </Button>
      </div>

      <div className="space-y-6 p-4">
        {/* ── Routing condition (read-only display) ─────────────────── */}
        <section className="space-y-1">
          <Label className="text-xs uppercase tracking-wide text-muted-foreground">
            Routing condition
          </Label>
          <p className="font-mono text-sm">{data.condition}</p>
          <p className="text-xs text-muted-foreground">
            Derived from the source handle on branching nodes; always{' '}
            <span className="font-mono">default</span> otherwise.
          </p>
        </section>

        {/* ── Dynamic fan-out (#35) ─────────────────────────────────── */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <Label className="text-xs uppercase tracking-wide text-muted-foreground">
              Dynamic fan-out
            </Label>
            <label className="flex items-center gap-2 text-xs">
              <input
                type="checkbox"
                checked={dispatchOn}
                onChange={(e) => setDispatchOn(e.target.checked)}
                disabled={!!dispatchBlockedReason || !!targetBlockedReason}
                aria-label="Toggle dynamic fan-out (Send per item)"
                data-testid="dispatch-toggle"
              />
              <span>Send per item</span>
            </label>
          </div>

          {(dispatchBlockedReason || targetBlockedReason) && !dispatchOn && (
            <div
              className="flex items-start gap-2 rounded border border-amber-300 bg-amber-50 p-2 text-xs text-amber-900"
              role="note"
              data-testid="dispatch-blocked-reason"
            >
              <Info className="mt-0.5 size-3 shrink-0" />
              <span>{dispatchBlockedReason ?? targetBlockedReason}</span>
            </div>
          )}

          {dispatchOn && (
            <div className="space-y-3" data-testid="dispatch-fields">
              <div className="space-y-1">
                <Label className="text-xs">Items slot (source list)</Label>
                <Select
                  value={data.itemsSlot ?? ''}
                  onValueChange={(v) =>
                    updateEdgeData(selectedEdgeId!, { itemsSlot: v })
                  }
                >
                  <SelectTrigger data-testid="items-slot-select">
                    <SelectValue placeholder="Pick a slot…" />
                  </SelectTrigger>
                  <SelectContent>
                    {itemsSlotOptions.map((slot) => (
                      <SelectItem key={slot} value={slot}>
                        {slot}
                        {slot === SLOT_USER_QUERY && (
                          <span className="ml-2 text-xs text-muted-foreground">
                            (latest user message)
                          </span>
                        )}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {sourceOutputs.length === 0 && (
                  <p className="text-xs text-muted-foreground">
                    Source node has no declared <span className="font-mono">outputs</span>.
                    Add an output slot on the source to feed the fan-out.
                  </p>
                )}
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Item slot (per-instance payload)</Label>
                <Select
                  value={data.itemSlot ?? ''}
                  onValueChange={(v) =>
                    updateEdgeData(selectedEdgeId!, { itemSlot: v })
                  }
                  disabled={targetInputs.length === 0}
                >
                  <SelectTrigger data-testid="item-slot-select">
                    <SelectValue placeholder="Pick a slot…" />
                  </SelectTrigger>
                  <SelectContent>
                    {targetInputs.map((slot) => (
                      <SelectItem key={slot} value={slot}>
                        {slot}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {targetInputs.length === 0 && (
                  <p className="text-xs text-muted-foreground">
                    Target node has no declared <span className="font-mono">inputs</span>.
                    Add an input slot on the target to receive the per-instance payload.
                  </p>
                )}
              </div>

              <p className="text-xs text-muted-foreground">
                Runtime: one parallel invocation of{' '}
                <span className="font-mono">{edge.target}</span> per item in{' '}
                <span className="font-mono">{data.itemsSlot ?? '?'}</span>,
                bound to{' '}
                <span className="font-mono">{data.itemSlot ?? '?'}</span> on
                each instance.
              </p>
            </div>
          )}
        </section>

        {/* ── Destructive action ────────────────────────────────────── */}
        <section className="pt-2 border-t border-border">
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start text-destructive hover:text-destructive"
            onClick={() => {
              if (window.confirm('Delete this edge?')) {
                deleteEdge(selectedEdgeId);
              }
            }}
            data-testid="delete-edge-button"
          >
            <Trash2 className="mr-2 size-4" />
            Delete edge
          </Button>
        </section>
      </div>
    </aside>
  );
}

// Re-export the dispatch-off sentinel for tests that want to drive the
// toggle programmatically without depending on rendered DOM.
export { DISPATCH_OFF };
