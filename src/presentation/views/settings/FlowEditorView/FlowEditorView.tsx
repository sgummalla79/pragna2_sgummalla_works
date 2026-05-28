import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import ReactFlow, {
  Background,
  ConnectionMode,
  type Connection,
  Controls,
  type NodeMouseHandler,
  ReactFlowProvider,
} from 'reactflow';
import 'reactflow/dist/style.css';
import * as Dialog from '@radix-ui/react-dialog';
import CodeMirror from '@uiw/react-codemirror';
import { yaml as yamlLang } from '@codemirror/lang-yaml';
import { AlertCircle, ArrowLeft, CheckCircle2, Code2, Plus, Save, X } from 'lucide-react';
import { isAxiosError } from 'axios';

import {
  useFlow,
  useSaveFlowFromYaml,
  useSaveFlowFromYamlById,
  useValidateFlowYaml,
} from '@/presentation/hooks/flows/useFlows';
import type { YamlError } from '@/domain/types/flowYaml.types';
import { Button } from '@/presentation/components/ui/Button';
import { Input } from '@/presentation/components/ui/Input';
import { useUiStore } from '@/presentation/store/uiStore';
import { ROUTES } from '@/constants/routes';

import { AgentNode, BoundaryNode } from './canvasNodes';
import { ConditionEdge } from './ConditionEdge';
import { NodePanel } from './NodePanel';
import { buildEditorGraph } from './buildEditorGraph';
import { graphToYaml } from './graphToYaml';
import { newFlowGraph } from './editorTypes';
import { isValidFlowConnection } from './connectionRules';
import { useFlowEditorStore } from './useFlowEditorStore';

/** Stable identity across renders (React Flow warns otherwise). */
const NODE_TYPES = { agent: AgentNode, boundary: BoundaryNode } as const;
const EDGE_TYPES = { condition: ConditionEdge } as const;

/** Pull the structured YAML error list out of a 422 from the save path. */
function extractSaveErrors(err: unknown): YamlError[] {
  if (!isAxiosError(err) || err.response?.status !== 422) return [];
  const detail = err.response.data?.detail;
  return Array.isArray(detail) ? (detail as YamlError[]) : [];
}

/** Recognise a 409 (api_name / slash collision) from the by-id save. */
function extractCollisionError(err: unknown): YamlError | null {
  if (!isAxiosError(err) || err.response?.status !== 409) return null;
  const detail = err.response.data?.detail;
  return {
    path: 'api_name',
    message:
      typeof detail === 'string'
        ? detail
        : 'An existing flow already uses that name. Choose a different one.',
  };
}

function EditorInner({ flowId }: { flowId?: string }) {
  const navigate = useNavigate();
  const { data: existingFlow, isLoading } = useFlow(flowId ?? '');
  const validateMutation = useValidateFlowYaml();
  const saveMutation = useSaveFlowFromYaml();
  const saveByIdMutation = useSaveFlowFromYamlById();
  const isSaving = saveMutation.isPending || saveByIdMutation.isPending;
  const mode = useUiStore((s) => s.theme);

  const nodes = useFlowEditorStore((s) => s.nodes);
  const edges = useFlowEditorStore((s) => s.edges);
  const meta = useFlowEditorStore((s) => s.meta);
  const dirty = useFlowEditorStore((s) => s.dirty);
  const selectedNodeId = useFlowEditorStore((s) => s.selectedNodeId);
  const onNodesChange = useFlowEditorStore((s) => s.onNodesChange);
  const onEdgesChange = useFlowEditorStore((s) => s.onEdgesChange);
  const onConnect = useFlowEditorStore((s) => s.onConnect);
  const onReconnect = useFlowEditorStore((s) => s.onReconnect);
  const beginReconnect = useFlowEditorStore((s) => s.beginReconnect);
  const endReconnect = useFlowEditorStore((s) => s.endReconnect);

  // Validator that reads FRESH store state every call. React Flow's
  // internal handleEdgeUpdater (wrapEdge, ~L3272) captures the
  // `isValidConnection` reference at drag-start — BEFORE
  // `onReconnectStart` fires — and uses that captured reference for the
  // whole drag. A closure over React state (reconnectingEdgeId, edges)
  // from the previous render would see stale values throughout: when
  // onReconnectStart later sets `reconnectingEdgeId`, the captured
  // closure has no way to learn about it. Reading from
  // `useFlowEditorStore.getState()` inside a STABLE useCallback
  // sidesteps the closure entirely — each call grabs the current store
  // snapshot, so the dedupe-exclusion sees the in-flight edge id.
  const isValidConnection = useCallback((conn: Connection) => {
    const state = useFlowEditorStore.getState();
    return isValidFlowConnection(state.edges, conn, state.reconnectingEdgeId);
  }, []);
  const selectNode = useFlowEditorStore((s) => s.selectNode);
  const addAgentNode = useFlowEditorStore((s) => s.addAgentNode);
  const setMeta = useFlowEditorStore((s) => s.setMeta);
  const hydrate = useFlowEditorStore((s) => s.hydrate);
  const reset = useFlowEditorStore((s) => s.reset);
  const markClean = useFlowEditorStore((s) => s.markClean);

  const [errors, setErrors] = useState<YamlError[]>([]);
  const [banner, setBanner] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);
  const [yamlOpen, setYamlOpen] = useState(false);

  // Seed the store from the flow's stored YAML (or a fresh Start/End
  // canvas for a new flow) AND clear the store on unmount so a different
  // flow opens clean. Combined into one effect so React StrictMode's
  // intentional mount→cleanup→mount cycle re-hydrates after the cleanup
  // — a separate seed-once-by-ref + unmount-reset pair would let the
  // cleanup wipe the hydrated state and the ref would block re-seeding,
  // leaving the canvas empty (caught in browser verify).
  //
  // Dep on `existingFlow?.id` (not the whole row) so a stale-time
  // refetch returning the same flow doesn't re-seed and clobber edits.
  useEffect(() => {
    if (!flowId) {
      hydrate(newFlowGraph());
    } else if (existingFlow) {
      hydrate(existingFlow.definition ? buildEditorGraph(existingFlow.definition) : newFlowGraph());
    }
    return () => reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flowId, existingFlow?.id]);

  const previewYaml = useMemo(
    () => (yamlOpen ? graphToYaml(meta, nodes, edges) : ''),
    [yamlOpen, meta, nodes, edges],
  );

  const handleNodeClick: NodeMouseHandler = (_e, node) => {
    selectNode(node.type === 'agent' ? node.id : null);
  };

  function handleAddNode() {
    // Cascade new nodes so they don't stack on top of each other.
    const agentCount = nodes.filter((n) => n.type === 'agent').length;
    addAgentNode({ x: 360, y: 120 + agentCount * 40 });
  }

  async function handleValidate() {
    setBanner(null);
    setErrors([]);
    try {
      const result = await validateMutation.mutateAsync(graphToYaml(meta, nodes, edges));
      setErrors(result.errors);
      setBanner(
        result.valid
          ? { kind: 'ok', text: 'Looks good — ready to save.' }
          : { kind: 'err', text: `Found ${result.errors.length} issue(s).` },
      );
    } catch {
      setBanner({ kind: 'err', text: "Couldn't reach the server." });
    }
  }

  async function handleSave() {
    setBanner(null);
    setErrors([]);
    const definition = graphToYaml(meta, nodes, edges);
    try {
      const { flow, created } = flowId
        ? await saveByIdMutation.mutateAsync({ flowId, definition })
        : await saveMutation.mutateAsync(definition);
      markClean();
      setBanner({ kind: 'ok', text: created ? `Created "${flow.displayName}".` : `Saved "${flow.displayName}".` });
      if (created && !flowId) {
        navigate(ROUTES.SETTINGS_FLOW_EDITOR.replace(':flowId', flow.id), { replace: true });
      }
    } catch (err) {
      const saveErrors = extractSaveErrors(err);
      const collision = extractCollisionError(err);
      if (saveErrors.length > 0) {
        setErrors(saveErrors);
        setBanner({ kind: 'err', text: `Save rejected — ${saveErrors.length} issue(s).` });
      } else if (collision) {
        setErrors([collision]);
        setBanner({ kind: 'err', text: 'Save rejected — name already in use.' });
      } else {
        setBanner({ kind: 'err', text: 'Save failed unexpectedly.' });
      }
    }
  }

  if (flowId && isLoading) {
    return <div className="p-8 text-sm text-muted-foreground">Loading flow…</div>;
  }

  return (
    <div className="flex h-full flex-col">
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div className="flex items-center gap-3">
          <Button asChild variant="ghost" size="icon" aria-label="Back to flows">
            <Link to={ROUTES.SETTINGS_FLOWS}>
              <ArrowLeft size={16} aria-hidden="true" />
            </Link>
          </Button>
          <div>
            <h1 className="text-base font-semibold">{flowId ? meta.displayName || 'Edit flow' : 'New flow'}</h1>
            <p className="text-xs text-muted-foreground">Drag to connect nodes · click a node to edit its agent.</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleAddNode}>
            <Plus size={14} aria-hidden="true" />
            Add node
          </Button>
          <Button variant="outline" size="sm" onClick={() => setYamlOpen(true)} aria-label="View YAML source">
            <Code2 size={14} aria-hidden="true" />
            YAML
          </Button>
          <Button variant="outline" size="sm" onClick={handleValidate} disabled={validateMutation.isPending}>
            {validateMutation.isPending ? 'Validating…' : 'Validate'}
          </Button>
          <Button size="sm" onClick={() => void handleSave()} disabled={isSaving || !dirty} aria-busy={isSaving}>
            <Save size={14} aria-hidden="true" />
            {isSaving ? 'Saving…' : 'Save'}
          </Button>
        </div>
      </div>

      {/* ── Flow-meta bar ──────────────────────────────────────────────── */}
      {/* Labels live inside the placeholders + `aria-label` (rather than a
       *  visible <Label> above each input) — keeps the bar tight at the
       *  top of the canvas without losing screen-reader semantics. */}
      <div className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-1.5">
        <Input
          id="flow-display-name"
          aria-label="Display name"
          className="h-8 w-48"
          value={meta.displayName}
          onChange={(e) => setMeta({ displayName: e.target.value })}
          placeholder="Display name (e.g. Research Pipeline)"
        />
        <Input
          id="flow-api-name"
          aria-label="API name"
          className="h-8 w-48 font-mono text-[12px]"
          value={meta.apiName}
          onChange={(e) => setMeta({ apiName: e.target.value })}
          placeholder="api-name (kebab-case)"
        />
        <Input
          id="flow-desc"
          aria-label="Description"
          className="h-8 w-[28rem]"
          value={meta.description ?? ''}
          onChange={(e) => setMeta({ description: e.target.value || null })}
          placeholder="What this flow does — the LLM reads this to decide when to invoke it"
        />
        <label className="flex items-center gap-1.5 text-[12px] text-muted-foreground">
          <input
            type="checkbox"
            checked={meta.exposedAsSlash}
            onChange={(e) => setMeta({ exposedAsSlash: e.target.checked })}
          />
          Expose as /slash
        </label>
        {meta.exposedAsSlash && (
          <Input
            id="flow-slash"
            aria-label="Slash name"
            className="h-8 w-40 font-mono text-[12px]"
            value={meta.slashApiName ?? ''}
            onChange={(e) => setMeta({ slashApiName: e.target.value || null })}
            placeholder="slash-name (kebab-case)"
          />
        )}
      </div>

      {/* ── Banner + errors ────────────────────────────────────────────── */}
      {(banner || errors.length > 0) && (
        <div className="space-y-2 border-b border-border px-4 py-2">
          {banner && (
            <div
              role="status"
              className={
                banner.kind === 'ok'
                  ? 'flex items-center gap-2 rounded-md border border-success/30 bg-success/10 px-3 py-2 text-sm text-success'
                  : 'flex items-center gap-2 rounded-md bg-destructive px-3 py-2 text-sm text-destructive-foreground'
              }
            >
              {banner.kind === 'ok' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
              <span>{banner.text}</span>
            </div>
          )}
          {errors.length > 0 && (
            <ul className="space-y-1 font-mono text-xs" role="list">
              {errors.map((e, i) => (
                <li key={i} className="text-destructive">
                  <span className="text-muted-foreground">{e.path || '(document)'}</span>
                  {' — '}
                  {e.message}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* ── Canvas + panel ─────────────────────────────────────────────── */}
      <div className="flex min-h-0 flex-1">
        <div className="min-h-0 flex-1 bg-background">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onReconnect={onReconnect}
            // onReconnectStart/End bracket each reconnect drag. We
            // stash the in-flight edge id so isValidConnection below
            // can skip it in its duplicate-source→target check —
            // otherwise moving an endpoint to a different handle on
            // the SAME nodes produces the same pair the old edge
            // still occupies, validation rejects, and React Flow
            // snaps the endpoint back to where it started.
            onReconnectStart={(_e, edge) => beginReconnect(edge.id)}
            onReconnectEnd={() => endReconnect()}
            // ★ Wiring onReconnect alone is NOT enough — React Flow's
            // EdgeRenderer also gates the reconnect anchor on
            // `edge.reconnectable === true` OR this `edgesUpdatable` prop
            // being truthy (see @reactflow/core wrapEdge `isReconnectable`).
            // Without it, the anchor never renders and dragging an
            // existing edge endpoint does nothing — even though our
            // store-level onReconnect action works fine (locked by
            // useFlowEditorStore.test.ts). Unit tests caught the store
            // behaviour but not this UI gate; keep both in mind.
            edgesUpdatable
            isValidConnection={isValidConnection}
            onNodeClick={handleNodeClick}
            onPaneClick={() => selectNode(null)}
            nodeTypes={NODE_TYPES}
            edgeTypes={EDGE_TYPES}
            connectionMode={ConnectionMode.Loose}
            nodesConnectable
            nodesDraggable
            fitView
            proOptions={{ hideAttribution: true }}
            deleteKeyCode={['Backspace', 'Delete']}
          >
            <Background gap={20} color="var(--color-border)" />
            <Controls position="bottom-right" showInteractive={false} />
          </ReactFlow>
        </div>
        {selectedNodeId && <NodePanel />}
      </div>

      {/* ── Read-only YAML "view source" ───────────────────────────────── */}
      <Dialog.Root open={yamlOpen} onOpenChange={setYamlOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-50 bg-black/40" />
          <Dialog.Content className="fixed left-1/2 top-1/2 z-50 flex max-h-[80vh] w-[min(720px,92vw)] -translate-x-1/2 -translate-y-1/2 flex-col rounded-lg border border-border bg-card shadow-xl">
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <Dialog.Title className="text-sm font-semibold">Flow YAML (read-only)</Dialog.Title>
              <Dialog.Close asChild>
                <Button variant="ghost" size="icon" aria-label="Close"><X size={16} /></Button>
              </Dialog.Close>
            </div>
            <Dialog.Description className="px-4 pt-2 text-xs text-muted-foreground">
              Generated from the canvas. Authoring happens visually — this is the saved source.
            </Dialog.Description>
            <div className="min-h-0 flex-1 overflow-auto p-2">
              <CodeMirror
                value={previewYaml}
                extensions={[yamlLang()]}
                theme={mode}
                editable={false}
                basicSetup={{ lineNumbers: true, foldGutter: true, highlightActiveLine: false }}
                style={{ fontSize: 12.5 }}
              />
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  );
}

export default function FlowEditorView() {
  const { flowId } = useParams<{ flowId?: string }>();
  return (
    <ReactFlowProvider>
      <EditorInner flowId={flowId} />
    </ReactFlowProvider>
  );
}
