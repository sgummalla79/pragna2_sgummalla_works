/**
 * Side-panel agent editor for the selected canvas node.
 *
 * Opening a node shows its inline, flow-owned agent definition; a
 * freshly-added node opens here with a blank create-agent form. Edits
 * write to the Zustand store only — nothing is persisted until the flow
 * is Saved, which is the "don't create agents until the flow is saved"
 * contract. The form atoms are the same ones the standalone agent
 * editor used (model Select, ChipInput for emits, ToolPicker for tools).
 */

import { useEffect, useMemo, useState } from 'react';
import { Maximize2, Save, Trash2, X } from 'lucide-react';
import * as Dialog from '@radix-ui/react-dialog';

import { Button } from '@/presentation/components/ui/Button';
import { Input } from '@/presentation/components/ui/Input';
import { Label } from '@/presentation/components/ui/Label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/presentation/components/ui/Select';
import { Textarea } from '@/presentation/components/ui/Textarea';
import { useModels } from '@/presentation/hooks/models/useModels';
import { ChipInput } from '@/presentation/views/settings/AgentsView/ChipInput';
import { ToolPicker } from '@/presentation/components/settings/ToolPicker/ToolPicker';
import {
  type AgentNodeData,
  NODE_END,
  NODE_START,
  NODE_TYPE_AGENT,
} from './editorTypes';
import { useFlowEditorStore } from './useFlowEditorStore';

const RESERVED_NODE_IDS = new Set<string>([NODE_START, NODE_END]);

export function NodePanel() {
  const selectedNodeId = useFlowEditorStore((s) => s.selectedNodeId);
  const node = useFlowEditorStore((s) =>
    s.nodes.find((n) => n.id === s.selectedNodeId && n.type === NODE_TYPE_AGENT),
  );
  const updateNode = useFlowEditorStore((s) => s.updateNode);
  const updateAgent = useFlowEditorStore((s) => s.updateAgent);
  const deleteNode = useFlowEditorStore((s) => s.deleteNode);
  const selectNode = useFlowEditorStore((s) => s.selectNode);
  // Select the STABLE nodes array (deriving a new array inside the
  // selector would change the snapshot every render → infinite loop),
  // then compute the other-node-ids for the uniqueness check via memo.
  const allNodes = useFlowEditorStore((s) => s.nodes);
  const otherNodeIds = useMemo(
    () => allNodes.filter((n) => n.id !== selectedNodeId).map((n) => n.id),
    [allNodes, selectedNodeId],
  );

  const { data: models = [] } = useModels();
  const flowEligibleModels = useMemo(
    () => models.filter((m) => m.enabled && !m.archived && m.availableForFlows),
    [models],
  );

  // node_id is edited locally and committed on blur — renaming on every
  // keystroke would rewire edges (and break on an empty intermediate).
  const data = node?.data as AgentNodeData | undefined;
  const [nodeIdDraft, setNodeIdDraft] = useState(data?.nodeId ?? '');
  const [nodeIdError, setNodeIdError] = useState<string | null>(null);
  useEffect(() => {
    setNodeIdDraft(data?.nodeId ?? '');
    setNodeIdError(null);
  }, [data?.nodeId, selectedNodeId]);

  // Maximize state — when true, the side-panel chrome stays put as a
  // backdrop trigger but the actual form moves into a full-screen Dialog
  // with a 3-column layout (identity fields / branching + context /
  // prompt full-height, with Description spanning the two left cols).
  const [maximized, setMaximized] = useState(false);
  // Delete confirmation dialog state — the destructive button never
  // fires deleteNode directly (per CLAUDE feedback memory). Click opens
  // this dialog; Cancel just closes; Delete commits.
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);

  if (!node || !data) return null;
  const agent = data.agent;
  const nodeId = node.id;

  function commitNodeId() {
    const next = nodeIdDraft.trim();
    if (next === data!.nodeId) {
      setNodeIdError(null);
      return;
    }
    // Validate before applying — node_id is the node's identity AND its
    // agent's api_name (collapsed), so it must be unique within the flow
    // and can't shadow a reserved boundary id. On failure we revert the
    // draft and surface an inline error rather than create a broken graph.
    if (!next) {
      setNodeIdError('Agent id is required.');
      setNodeIdDraft(data!.nodeId);
      return;
    }
    if (RESERVED_NODE_IDS.has(next)) {
      setNodeIdError(`'${next}' is reserved for the Start/End boundaries.`);
      setNodeIdDraft(data!.nodeId);
      return;
    }
    if (otherNodeIds.includes(next)) {
      setNodeIdError(`Another node already uses '${next}'. Ids must be unique.`);
      setNodeIdDraft(data!.nodeId);
      return;
    }
    setNodeIdError(null);
    updateNode(nodeId, { nodeId: next });
  }

  // Form atoms — extracted so both the side panel AND the maximized
  // modal can render them in different layouts without duplicating the
  // wiring. Each block writes directly to the store via updateNode /
  // updateAgent and reads off `data` / `agent` from closure.
  const nodeIdField = (
    <div className="space-y-1.5">
      <Label htmlFor="np-node-id">Agent</Label>
      <Input
        id="np-node-id"
        value={nodeIdDraft}
        onChange={(e) => setNodeIdDraft(e.target.value)}
        onBlur={commitNodeId}
        placeholder="researcher_1"
        aria-invalid={nodeIdError ? true : undefined}
      />
      {nodeIdError ? (
        <p role="alert" className="text-[11px] text-destructive">{nodeIdError}</p>
      ) : (
        <p className="text-[11px] text-muted-foreground">
          Unique within this flow. Used in edges, as the agent's label, and as its
          api_name (<code className="font-mono">{agent.apiName || 'researcher_1'}</code>).
        </p>
      )}
    </div>
  );

  const displayNameField = (
    <div className="space-y-1.5">
      <Label htmlFor="np-agent-display">Display name</Label>
      <Input
        id="np-agent-display"
        value={agent.displayName}
        onChange={(e) => updateAgent(nodeId, { displayName: e.target.value })}
        placeholder="e.g. Researcher"
      />
    </div>
  );

  const descriptionField = (
    <div className="space-y-1.5">
      <Label htmlFor="np-agent-desc">Description (optional)</Label>
      <Input
        id="np-agent-desc"
        value={agent.description ?? ''}
        onChange={(e) => updateAgent(nodeId, { description: e.target.value || null })}
        placeholder="e.g. Generates the primary draft."
      />
    </div>
  );

  const modelField = (
    <div className="space-y-1.5">
      <Label htmlFor="np-agent-model">Model</Label>
      <Select
        value={agent.userModel}
        onValueChange={(v) => updateAgent(nodeId, { userModel: v })}
      >
        <SelectTrigger id="np-agent-model">
          <SelectValue placeholder="— pick a model —" />
        </SelectTrigger>
        <SelectContent>
          {flowEligibleModels.map((m) => (
            <SelectItem key={m.id} value={m.modelName}>
              {m.displayName}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {flowEligibleModels.length === 0 && (
        <p className="text-[11px] text-muted-foreground">
          No models enabled for Flows. Toggle "Available for flows" on a model in Settings → Providers.
        </p>
      )}
    </div>
  );

  const emitsField = (
    <div className="space-y-1.5">
      <Label htmlFor="np-agent-emits">Emit labels</Label>
      <ChipInput
        id="np-agent-emits"
        label="emit"
        values={agent.emits}
        onChange={(emits) => updateAgent(nodeId, { emits })}
        placeholder="passed, failed (Enter to add)"
      />
      <p className="text-[11px] text-muted-foreground">
        Routing outcomes this agent may emit. They become selectable conditions on outgoing edges.
      </p>
    </div>
  );

  const toolsField = (
    <div className="space-y-1.5">
      <Label htmlFor="np-agent-tools">Tools (optional)</Label>
      <ToolPicker
        id="np-agent-tools"
        label="tool"
        values={agent.tools}
        onChange={(tools) => updateAgent(nodeId, { tools })}
        placeholder="Type to search tools"
      />
    </div>
  );

  // Shared body for both the collapsible (side panel) and flat (modal)
  // context-slots variants below.
  const contextSlotsInner = (
    <>
      <div className="space-y-1.5">
        <Label htmlFor="np-inputs">Inputs</Label>
        <ChipInput
          id="np-inputs"
          label="input slot"
          values={data.inputs ?? []}
          onChange={(inputs) => updateNode(nodeId, { inputs })}
          placeholder="research_notes, user_query"
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="np-outputs">Outputs</Label>
        <ChipInput
          id="np-outputs"
          label="output slot"
          values={data.outputs ?? []}
          onChange={(outputs) => updateNode(nodeId, { outputs })}
          placeholder="research_notes"
        />
      </div>
      <p className="text-[11px] text-muted-foreground">
        Leave empty for default chat-style context (the node sees the full transcript). Declaring inputs feeds the node ONLY those slots — fixes pipeline / loop over-sharing (#26).
      </p>
    </>
  );

  // Side-panel version: collapsed under <details> to save the cramped
  // 360px column from a tall always-on block.
  const contextSlotsFieldCollapsible = (
    <details className="rounded-md border border-border">
      <summary className="cursor-pointer px-3 py-2 text-[12px] font-medium text-muted-foreground">
        Context variables (advanced)
      </summary>
      <div className="space-y-3 px-3 pb-3">
        {contextSlotsInner}
      </div>
    </details>
  );

  // Modal version: always-visible block in column 2 next to Emit labels.
  const contextSlotsFieldFlat = (
    <div className="space-y-1.5">
      <Label>Context variables</Label>
      <div className="space-y-3 rounded-md border border-border px-3 py-3">
        {contextSlotsInner}
      </div>
    </div>
  );

  // System prompt — the only field that lives in the right column of
  // the maximized modal. In the side panel it sits between Model and
  // Emits at its native (~10rem) height; in the modal it stretches to
  // fill the viewport so authors can write long prompts without scrolling.
  // The wrapper class is parameterised so the side panel can size to
  // content (no h-full, otherwise the prompt's textarea pushes a huge
  // empty gap between System Prompt and Emit Labels) while the modal
  // still gets the full grid-cell height it needs.
  const promptField = (textareaClass: string, wrapperClass = '') => (
    <div className={`flex flex-col space-y-1.5 ${wrapperClass}`}>
      <Label htmlFor="np-agent-prompt">System prompt</Label>
      <Textarea
        id="np-agent-prompt"
        value={agent.systemPrompt}
        onChange={(e) => updateAgent(nodeId, { systemPrompt: e.target.value })}
        placeholder="e.g. You are a careful researcher."
        className={`${textareaClass} font-mono text-[12.5px]`}
      />
    </div>
  );

  // Delete button — not full-width; sized like a regular CTA. The
  // surrounding footer decides alignment (centered in the side panel,
  // right-aligned in the modal). Click opens the confirm dialog, never
  // deletes directly. `text-white` is pinned (overrides the theme's
  // `destructive-foreground` token which can resolve off-white in some
  // palettes — the user wants white-on-red regardless of theme).
  const deleteButton = (
    <Button
      variant="danger"
      size="sm"
      className="text-white"
      onClick={() => setConfirmDeleteOpen(true)}
    >
      <Trash2 size={14} aria-hidden="true" />
      Delete agent
    </Button>
  );

  return (
    <>
      <aside className="flex h-full w-[360px] shrink-0 flex-col border-l border-border bg-card">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <h2 className="text-sm font-semibold">Agent</h2>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              aria-label="Maximize panel"
              title="Open full-size editor"
              onClick={() => setMaximized(true)}
            >
              <Maximize2 size={16} aria-hidden="true" />
            </Button>
            <Button variant="ghost" size="icon" aria-label="Close panel" onClick={() => selectNode(null)}>
              <X size={16} aria-hidden="true" />
            </Button>
          </div>
        </div>

        <div className="flex-1 space-y-5 overflow-y-auto p-4">
          {nodeIdField}
          {displayNameField}
          {descriptionField}
          {modelField}
          {promptField('min-h-[10rem] resize-y')}
          {emitsField}
          {toolsField}
          {contextSlotsFieldCollapsible}
        </div>

        {/* Side-panel footer: delete centred. */}
        <div className="flex justify-center border-t border-border p-3">{deleteButton}</div>
      </aside>

      {/* Full-size editor — opened from the maximize button. Three-column
          layout:
            • Col 1 row 2: Agent id / Display name / Model
            • Col 2 row 2: Emit labels / Context variables
            • Description spans cols 1+2 in row 1 (full-width field above
              the two left columns, but not above the prompt — the prompt
              column gets the saved vertical height for long prompts).
            • Col 3: System prompt, spans both rows for max height. */}
      <Dialog.Root open={maximized} onOpenChange={setMaximized}>
        <Dialog.Portal>
          {/* Stacks above the flow editor's wrapping Dialog (z-40
              overlay / z-50 content). The NodePanel maximize is a
              visual mode toggle, NOT a separate data boundary — its
              form state survives un-maximize — so no hardening is
              needed here even though it's nested inside a dirty
              parent (see future-discussions #7 design rule). */}
          <Dialog.Overlay className="fixed inset-0 z-[60] bg-foreground/40" />
          <Dialog.Content
            aria-describedby={undefined}
            className="fixed inset-4 z-[70] flex flex-col overflow-hidden rounded-lg border border-border bg-card shadow-xl"
          >
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <Dialog.Title className="text-sm font-semibold">
                Edit agent — <span className="font-mono text-[12px] text-muted-foreground">{agent.apiName || nodeId}</span>
              </Dialog.Title>
              <Dialog.Close asChild>
                <Button variant="ghost" size="icon" aria-label="Close">
                  <X size={16} aria-hidden="true" />
                </Button>
              </Dialog.Close>
            </div>

            <div className="grid min-h-0 flex-1 grid-cols-[1fr_1fr_2.5fr] grid-rows-[auto_1fr] gap-4 p-4">
              {/* Row 1 — Description spans the two left columns. The
                  prompt column (col 3) starts at row 1 too via row-span-2
                  below, so it gets the full vertical height. */}
              <div className="col-span-2 row-start-1">{descriptionField}</div>

              {/* Row 2 col 1 — identity fields */}
              <div className="col-start-1 row-start-2 min-h-0 space-y-5 overflow-y-auto pr-1">
                {nodeIdField}
                {displayNameField}
                {modelField}
                {toolsField}
              </div>

              {/* Row 2 col 2 — branching + context slots */}
              <div className="col-start-2 row-start-2 min-h-0 space-y-5 overflow-y-auto pr-1">
                {emitsField}
                {contextSlotsFieldFlat}
              </div>

              {/* Col 3 spans both rows — prompt fills full modal height */}
              <div className="col-start-3 row-span-2 row-start-1 min-h-0">
                {promptField('h-full flex-1 resize-none', 'h-full')}
              </div>
            </div>

            {/* Modal footer: Delete on the left (destructive secondary
                action), Save on the right (primary). "Save" here just
                closes the modal — edits are already written to the
                Zustand store live via updateAgent/updateNode, and the
                whole flow is persisted at flow-level via the header's
                Save button. The name "Save" reads better than "Done"
                because it signals "your changes are kept" to a user
                who's been editing fields. */}
            <div className="flex items-center justify-between border-t border-border p-3">
              {deleteButton}
              <Button size="sm" onClick={() => setMaximized(false)}>
                <Save size={14} aria-hidden="true" />
                Save
              </Button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      {/* Delete confirmation — destructive actions must confirm before
          firing (CLAUDE feedback memory `destructive-actions-confirm`).
          Stacks above the NodePanel maximize (z-60/70) AND the flow
          editor wrapper (z-40/50). */}
      <Dialog.Root open={confirmDeleteOpen} onOpenChange={setConfirmDeleteOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-[80] bg-foreground/40" />
          <Dialog.Content
            aria-describedby="confirm-delete-desc"
            className="fixed left-1/2 top-1/2 z-[90] w-[min(440px,90vw)] -translate-x-1/2 -translate-y-1/2 rounded-lg border border-border bg-card p-5 shadow-xl"
          >
            <Dialog.Title className="text-base font-semibold">Delete this agent?</Dialog.Title>
            <p id="confirm-delete-desc" className="mt-2 text-sm text-muted-foreground">
              <span className="font-mono text-foreground">{agent.apiName || nodeId}</span> and all
              edges connected to it will be removed from the flow. This can't be undone (without re-adding the agent by hand).
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setConfirmDeleteOpen(false)}>
                Cancel
              </Button>
              <Button
                variant="danger"
                className="text-white"
                onClick={() => {
                  setConfirmDeleteOpen(false);
                  setMaximized(false);
                  deleteNode(nodeId);
                }}
              >
                <Trash2 size={16} aria-hidden="true" />
                Delete
              </Button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </>
  );
}
