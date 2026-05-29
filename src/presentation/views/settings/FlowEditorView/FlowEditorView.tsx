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
import { AlertCircle, ArrowLeft, CheckCircle2, ChevronDown, ChevronUp, Code2, Save, ShieldCheck, X } from 'lucide-react';
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
import { PalettePanel } from './PalettePanel';
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
  const setMeta = useFlowEditorStore((s) => s.setMeta);
  const hydrate = useFlowEditorStore((s) => s.hydrate);
  const reset = useFlowEditorStore((s) => s.reset);
  const markClean = useFlowEditorStore((s) => s.markClean);

  const [errors, setErrors] = useState<YamlError[]>([]);
  const [banner, setBanner] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);
  const [yamlOpen, setYamlOpen] = useState(false);
  // Accordion-style errors list. Starts COLLAPSED — the banner summary
  // already names the count ("N issues blocking save"); users who want
  // the detail expand it via the chevron. We also reset to collapsed on
  // every new error round so a stale-expanded panel doesn't carry over
  // between save attempts.
  const [errorsExpanded, setErrorsExpanded] = useState(false);
  useEffect(() => {
    if (errors.length > 0) setErrorsExpanded(false);
  }, [errors]);

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

  async function handleValidate() {
    setBanner(null);
    setErrors([]);
    try {
      const result = await validateMutation.mutateAsync(graphToYaml(meta, nodes, edges));
      // When the YAML parses fine the validator returns valid=true with
      // an empty error list — show the success banner. When it doesn't,
      // we set ONLY the errors array; the banner derives its summary
      // ("N issues blocking save") from `errors.length`, so we don't
      // double-message with a separate "Found N issue(s)" toast.
      if (result.valid) {
        setBanner({ kind: 'ok', text: 'Looks good — ready to save.' });
      } else {
        setErrors(result.errors);
      }
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
        navigate(ROUTES.FLOW_EDITOR.replace(':flowId', flow.id), { replace: true });
      }
    } catch (err) {
      // Same single-source-of-message rule as handleValidate: when we
      // have structured errors to show, ONLY set the errors list (the
      // banner derives its summary from `errors.length`). Bare "didn't
      // reach the server" failures still need a banner.text because
      // there's no error row to count.
      const saveErrors = extractSaveErrors(err);
      const collision = extractCollisionError(err);
      if (saveErrors.length > 0) {
        setErrors(saveErrors);
      } else if (collision) {
        setErrors([collision]);
      } else {
        setBanner({ kind: 'err', text: 'Save failed unexpectedly.' });
      }
    }
  }

  if (flowId && isLoading) {
    return <div className="p-8 text-sm text-muted-foreground">Loading flow…</div>;
  }

  return (
    <div className="flex h-screen flex-col">
      {/* ── Header ──────────────────────────────────────────────────────
           Row 1: Back · flow icon · Display Name (borderless heading-
                  style input) · <ml-auto spacer> · Draft/Saved chip ·
                  action buttons.
           Row 2: API Name · Description (fills middle) · Slash Name
                  (conditional, right) · Expose-as-slash checkbox
                  (right end). */}
      <div className="border-b border-border px-4 py-2">
        {/* Row 1 — title slot */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <Button asChild variant="ghost" size="icon" aria-label="Back to flows">
              <Link to={ROUTES.SETTINGS_FLOWS}>
                <ArrowLeft size={16} aria-hidden="true" />
              </Link>
            </Button>
            {/* Flow glyph — the project's own FlowsIcon (3-node graph,
                same SVG used in the settings sidebar's "Flows" item) so
                the brand is consistent. */}
            <FlowsIcon />
            {/* Borderless title-as-input. */}
            <Input
              id="flow-display-name"
              aria-label="Display name"
              className="h-10 w-72 min-w-0 max-w-[18rem] border-transparent bg-transparent px-1 text-lg font-semibold shadow-none focus-visible:border-input focus-visible:bg-background"
              value={meta.displayName}
              onChange={(e) => setMeta({ displayName: e.target.value })}
              placeholder={flowId ? 'Untitled flow' : 'New flow'}
            />
            {/* Publish state chip — sits in the left cluster with a
                slightly larger gap (ml-4) after Expose so the eye reads
                three groups: title · expose-toggle · publish-state.
                State mapping (Publish semantics are parked at
                future-discussions #33, so today we derive the chip from
                save-state, not a `meta.published` flag):
                  • Saved — flow has an id AND no pending edits →
                    subtle green w/ white text.
                  • Draft — new flow or pending unsaved edits →
                    subtle amber w/ white text. */}
            {(() => {
              const saved = !!flowId && !dirty;
              const tone = saved ? 'bg-emerald-600' : 'bg-amber-600';
              const label = saved ? 'Saved' : 'Draft';
              return (
                <span className={`ml-auto shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white ${tone}`}>
                  {label}
                </span>
              );
            })()}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Button size="sm" onClick={() => setYamlOpen(true)} aria-label="View YAML source">
              <Code2 size={14} aria-hidden="true" />
              YAML
            </Button>
            <Button size="sm" onClick={handleValidate} disabled={validateMutation.isPending}>
              <ShieldCheck size={14} aria-hidden="true" />
              {validateMutation.isPending ? 'Validating…' : 'Validate'}
            </Button>
            <Button size="sm" onClick={() => void handleSave()} disabled={isSaving || !dirty} aria-busy={isSaving}>
              <Save size={14} aria-hidden="true" />
              {isSaving ? 'Saving…' : 'Save'}
            </Button>
          </div>
        </div>

        {/* Row 2 — API Name + Description. Description takes the
            remaining horizontal space via flex-1. Left padding aligns
            the first field's edge with the Display Name input on row 1:
            back button 44px + gap-2 8px + flow icon 18px + gap-2 8px
            = 78px. */}
        <div className="mt-2 flex flex-wrap items-end gap-3 pl-[78px]">
          <div className="flex flex-col gap-0.5">
            <label htmlFor="flow-api-name" className="text-[10px] font-semibold uppercase tracking-wider text-foreground">
              API Name
            </label>
            <Input
              id="flow-api-name"
              className="h-9 w-72 font-mono text-sm"
              value={meta.apiName}
              onChange={(e) => setMeta({ apiName: e.target.value })}
              placeholder="api-name (kebab-case)"
            />
          </div>
          <div className="flex min-w-[18rem] flex-1 flex-col gap-0.5">
            <label htmlFor="flow-desc" className="text-[10px] font-semibold uppercase tracking-wider text-foreground">
              Description
            </label>
            <Input
              id="flow-desc"
              className="h-9 w-full text-sm"
              value={meta.description ?? ''}
              onChange={(e) => setMeta({ description: e.target.value || null })}
              placeholder="What this flow does — the LLM reads this to decide when to invoke it"
            />
          </div>
          {/* Slash Name — only shown when Expose is on. Sits to the
              right of Description so the form reads "internal id |
              description | public name + toggle". */}
          {meta.exposedAsSlash && (
            <div className="flex flex-col gap-0.5">
              <label htmlFor="flow-slash" className="text-[10px] font-semibold uppercase tracking-wider text-foreground">
                Slash Name
              </label>
              <Input
                id="flow-slash"
                className="h-9 w-44 font-mono text-sm"
                value={meta.slashApiName ?? ''}
                onChange={(e) => setMeta({ slashApiName: e.target.value || null })}
                placeholder="slash-name"
              />
            </div>
          )}
          {/* Expose-as-slash checkbox — right end of row 2, after Slash
              Name. h-7 keeps it bottom-aligned with the input row. */}
          <label className="flex h-9 shrink-0 select-none items-center gap-1.5 text-sm text-foreground">
            <input
              type="checkbox"
              checked={meta.exposedAsSlash}
              onChange={(e) => setMeta({ exposedAsSlash: e.target.checked })}
            />
            Expose as /slash
          </label>
        </div>
      </div>

      {/* ── Banner ───────────────────────────────────────────────────────
           One banner, three states:
             • success → muted emerald + uniform white text
             • error w/o detail → muted deep-red + uniform white text
             • error w/ detail → muted deep-red + collapsible accordion
                                 listing each YAML/save issue
           Uses red-900 / emerald-800 — deep enough for white text to
           read cleanly, dark enough to avoid the alarm-grade saturation
           of `bg-destructive`. All text white for consistency (no
           per-element accent colours). */}
      {(banner || errors.length > 0) && (
        <div className="border-b border-border px-4 py-2">
          {(() => {
            const isErr = banner?.kind === 'err' || errors.length > 0;
            const tone = isErr ? 'bg-red-900' : 'bg-emerald-800';
            // banner.text wins when set (e.g. "Save failed unexpectedly.",
            // "Looks good — ready to save."); otherwise we derive the
            // summary from the errors count so there's never a duplicate
            // "Found N issue(s)" + "N issues blocking save" pairing.
            const summary = banner?.text
              ?? (errors.length === 1
                ? '1 issue blocking save'
                : `${errors.length} issues blocking save`);
            return (
              <div role="status" className={`rounded-md text-white ${tone}`}>
                <div className="flex items-center gap-2 px-3 py-2 text-sm">
                  {isErr ? <AlertCircle size={16} /> : <CheckCircle2 size={16} />}
                  <span className="flex-1 font-medium">{summary}</span>
                  {errors.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setErrorsExpanded((v) => !v)}
                      aria-label={errorsExpanded ? 'Collapse errors' : 'Expand errors'}
                      aria-expanded={errorsExpanded}
                      className="rounded p-0.5 text-white/80 transition-colors hover:bg-white/15 hover:text-white"
                    >
                      {errorsExpanded ? <ChevronUp size={14} aria-hidden="true" /> : <ChevronDown size={14} aria-hidden="true" />}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => { setBanner(null); setErrors([]); }}
                    aria-label="Dismiss"
                    className="rounded p-0.5 text-white/80 transition-colors hover:bg-white/15 hover:text-white"
                  >
                    <X size={14} aria-hidden="true" />
                  </button>
                </div>
                {errors.length > 0 && errorsExpanded && (
                  <ul className="space-y-1 border-t border-white/15 px-3 py-2 font-mono text-xs text-white" role="list">
                    {errors.map((e, i) => (
                      <li key={i}>
                        <span className="text-white/70">{e.path || '(document)'}</span>
                        {' — '}
                        {e.message}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            );
          })()}
        </div>
      )}

      {/* ── Palette + canvas + panel ──────────────────────────────────── */}
      <div className="flex min-h-0 flex-1">
        {/* `relative` anchors the floating PalettePanel inside the
            canvas column so it overlays React Flow without stealing
            horizontal space. */}
        <div className="relative min-h-0 flex-1 bg-background">
          <PalettePanel />
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

/** Inline copy of the FlowsIcon used in the settings sidebar — kept
 *  locally rather than imported so it tracks any future theme/stroke
 *  tweaks against the single canonical SVG (sidebar version stays the
 *  source of truth; if it changes shape, mirror it here). */
function FlowsIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="shrink-0 text-muted-foreground"
    >
      <circle cx="18" cy="18" r="3" />
      <circle cx="6" cy="6" r="3" />
      <circle cx="6" cy="18" r="3" />
      <path d="M6 9v6M13 6h3a2 2 0 0 1 2 2v7" />
    </svg>
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
