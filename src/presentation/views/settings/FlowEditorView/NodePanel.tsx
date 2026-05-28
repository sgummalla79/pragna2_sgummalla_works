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
import { Trash2, X } from 'lucide-react';

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
      setNodeIdError('Node id is required.');
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

  return (
    <aside className="flex h-full w-[360px] shrink-0 flex-col border-l border-border bg-card">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <h2 className="text-sm font-semibold">Node &amp; agent</h2>
        <Button variant="ghost" size="icon" aria-label="Close panel" onClick={() => selectNode(null)}>
          <X size={16} aria-hidden="true" />
        </Button>
      </div>

      <div className="flex-1 space-y-5 overflow-y-auto p-4">
        <div className="space-y-1.5">
          <Label htmlFor="np-node-id">Node id</Label>
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
              Unique within this flow. Used in edges, as the node's label, and as the agent's
              api_name (<code className="font-mono">{agent.apiName || 'researcher_1'}</code>).
            </p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="np-agent-display">Display name</Label>
          <Input
            id="np-agent-display"
            value={agent.displayName}
            onChange={(e) => updateAgent(nodeId, { displayName: e.target.value })}
            placeholder="Researcher"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="np-agent-desc">Description (optional)</Label>
          <Input
            id="np-agent-desc"
            value={agent.description ?? ''}
            onChange={(e) => updateAgent(nodeId, { description: e.target.value || null })}
            placeholder="Generates the primary draft."
          />
        </div>

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

        <div className="space-y-1.5">
          <Label htmlFor="np-agent-prompt">System prompt</Label>
          <Textarea
            id="np-agent-prompt"
            value={agent.systemPrompt}
            onChange={(e) => updateAgent(nodeId, { systemPrompt: e.target.value })}
            placeholder="You are a careful researcher."
            className="min-h-[10rem] resize-y font-mono text-[12.5px]"
          />
        </div>

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

        {/* Advanced: #26 per-node context slots. */}
        <details className="rounded-md border border-border">
          <summary className="cursor-pointer px-3 py-2 text-[12px] font-medium text-muted-foreground">
            Context slots (advanced)
          </summary>
          <div className="space-y-3 px-3 pb-3">
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
          </div>
        </details>
      </div>

      <div className="border-t border-border p-3">
        <Button
          variant="ghost"
          size="sm"
          className="w-full text-destructive hover:bg-destructive/10"
          onClick={() => deleteNode(nodeId)}
        >
          <Trash2 size={14} aria-hidden="true" />
          Delete node
        </Button>
      </div>
    </aside>
  );
}
