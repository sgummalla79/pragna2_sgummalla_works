import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import CodeMirror from '@uiw/react-codemirror';
import { yaml as yamlLang } from '@codemirror/lang-yaml';
import ReactFlow, {
  Background,
  Controls,
  type Node,
  type NodeDragHandler,
  ReactFlowProvider,
  useEdgesState,
  useNodesState,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { AlertCircle, ArrowLeft, CheckCircle2, Save } from 'lucide-react';
import { isAxiosError } from 'axios';

import {
  useFlow,
  useSaveFlowFromYaml,
  useSaveFlowFromYamlById,
  useUpdateFlowPositions,
  useValidateFlowYaml,
} from '@/presentation/hooks/flows/useFlows';
import type { YamlError } from '@/domain/types/flowYaml.types';
import { Button } from '@/presentation/components/ui/Button';
import { Card, CardContent } from '@/presentation/components/ui/Card';
import { useUiStore } from '@/presentation/store/uiStore';
import { ROUTES } from '@/constants/routes';
import { STARTER_FLOW_YAML } from './starterYaml';
import { LoopBackEdge } from './LoopBackEdge';
import { type PositionOverrides, yamlToGraph } from './yamlToGraph';

/** R10 #1: registered with ReactFlow so back-edges tagged
 *  ``type: 'loopback'`` by :func:`yamlToGraph` are rendered by the
 *  custom :class:`LoopBackEdge` component instead of the default
 *  smoothstep renderer (which would overlap forward edges). Module-
 *  level constant so the object identity is stable across renders —
 *  ReactFlow warns when ``edgeTypes`` is a fresh object every render. */
const EDGE_TYPES = { loopback: LoopBackEdge } as const;

/** R10 #2: how long to wait after the last drag before PATCHing the
 *  positions back to the server. Long enough to batch a multi-node
 *  rearrangement into one request; short enough that a single drag
 *  feels persisted. */
const POSITION_PERSIST_DEBOUNCE_MS = 600;

/** Pull a YAML error list out of an Axios error from /api/flows/from-yaml.
 *  The backend returns 422 with `detail: [{path, message}, ...]`. */
function extractSaveErrors(err: unknown): YamlError[] {
  if (!isAxiosError(err) || err.response?.status !== 422) return [];
  const detail = err.response.data?.detail;
  return Array.isArray(detail) ? (detail as YamlError[]) : [];
}

/** Recognise a 409 from the by-id save endpoint. Surfaces as a single
 *  inline error pointing at `api_name` so the editor highlights the
 *  offending key. */
function extractCollisionError(err: unknown): YamlError | null {
  if (!isAxiosError(err) || err.response?.status !== 409) return null;
  const detail = err.response.data?.detail;
  const message =
    typeof detail === 'string'
      ? detail
      : 'An existing flow already uses that api_name. Choose a different name.';
  return { path: 'api_name', message };
}

interface EditorProps {
  /** Defined when editing an existing flow. Undefined for /settings/flows/new. */
  flowId?: string;
}

function EditorInner({ flowId }: EditorProps) {
  const navigate = useNavigate();
  const { data: existingFlow, isLoading } = useFlow(flowId ?? '');
  const validateMutation = useValidateFlowYaml();
  const saveMutation = useSaveFlowFromYaml();
  const saveByIdMutation = useSaveFlowFromYamlById();
  const isSaving = saveMutation.isPending || saveByIdMutation.isPending;

  // The CodeMirror document. Seeded once from the loaded flow (when editing)
  // or from the starter template (when creating).
  const [yamlText, setYamlText] = useState<string>('');
  // Snapshot of the YAML at seed time. Used to compute "dirty" so the
  // Save button stays disabled until the user has actually changed
  // something. Edit mode seeds from the loaded flow's definition; new
  // mode seeds from the starter template (so clicking Save on an
  // unmodified starter is blocked — the user needs to give the flow
  // its own api_name anyway).
  const [initialYamlText, setInitialYamlText] = useState<string>('');
  // CodeMirror's theme follows the app's light/dark mode so the
  // editor doesn't render as a dark slab on a cream background.
  const mode = useUiStore((s) => s.theme);
  // Server-side errors from the most recent Validate or Save attempt.
  const [errors, setErrors] = useState<YamlError[]>([]);
  // Banner for the most recent action — distinct from `errors` (which can
  // accumulate across actions).
  const [banner, setBanner] = useState<
    { kind: 'ok'; text: string } | { kind: 'err'; text: string } | null
  >(null);

  // Seed the editor text once the existing flow's definition arrives. Some
  // flows may not have a YAML definition yet (created via REST); for those
  // fall back to the starter template so the user has something to edit.
  useEffect(() => {
    if (flowId && existingFlow && yamlText === '') {
      const seed = existingFlow.definition ?? STARTER_FLOW_YAML;
      setYamlText(seed);
      setInitialYamlText(seed);
    }
    if (!flowId && yamlText === '') {
      setYamlText(STARTER_FLOW_YAML);
      setInitialYamlText(STARTER_FLOW_YAML);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flowId, existingFlow]);

  // "Dirty" — user has changed the YAML from its seeded value. Once
  // ``initialYamlText`` is populated (post-seed), any divergence flips
  // this true. Before seed runs (``initialYamlText === ''``) we stay
  // clean so Save is disabled — the editor isn't ready anyway.
  const isDirty =
    initialYamlText.length > 0 && yamlText !== initialYamlText;

  // Reactflow's controlled state. We sync from the YAML on every text
  // change (replacing the graph), but between edits the user is free to
  // drag nodes around — onNodesChange writes back here so positions
  // persist within the editing session.
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);

  // ── R10 #2: persisted-position overrides ────────────────────────────
  //
  // Lives separately from reactflow's ``nodes`` state because every
  // YAML keystroke rebuilds the graph via ``yamlToGraph`` — without an
  // out-of-band override map, a single keystroke would clobber every
  // user-drag position. The override map is seeded once from the
  // loaded flow's ``metadata.positions``, mutated on drag-end, and
  // overlaid on top of dagre's auto-layout inside ``yamlToGraph``.
  //
  // Persistence: ``onNodeDragStop`` debounces a PATCH to
  // ``/api/flows/{id}`` for the FULL map (the backend merges
  // metadata shallowly, so a partial map would erase un-dragged
  // siblings on the next write). The debounce timer is tracked in a
  // ref so multi-node drags batch into a single request.
  const [positionOverrides, setPositionOverrides] = useState<
    Record<string, { x: number; y: number }>
  >({});

  const updatePositionsMutation = useUpdateFlowPositions();
  const persistTimerRef = useRef<number | null>(null);

  // Seed overrides from the loaded flow's metadata once it arrives.
  // Only runs in edit mode (``flowId`` set) — new flows have no
  // persisted positions to seed from.
  useEffect(() => {
    if (!flowId || !existingFlow) return;
    const persisted = (existingFlow.metadata as { positions?: unknown } | null)
      ?.positions;
    if (persisted && typeof persisted === 'object' && !Array.isArray(persisted)) {
      setPositionOverrides(persisted as Record<string, { x: number; y: number }>);
    }
    // Intentionally one-shot per flow load. Subsequent overrides come
    // from the drag handler; re-running this on every existingFlow
    // identity change would clobber unsaved drags.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flowId, existingFlow?.id]);

  const overridesForRender: PositionOverrides = useMemo(
    () => (Object.keys(positionOverrides).length > 0 ? positionOverrides : null),
    [positionOverrides],
  );

  useEffect(() => {
    const graph = yamlToGraph(yamlText, overridesForRender);
    setNodes(graph.nodes);
    setEdges(graph.edges);
  }, [yamlText, overridesForRender, setNodes, setEdges]);

  // Drag-end handler. Reactflow guarantees this fires with the final
  // position of the dragged node — onNodesChange events during the
  // drag are noisy and not worth listening to. We update the override
  // map locally (so subsequent YAML keystrokes don't reset it) and
  // schedule a debounced PATCH to persist.
  const handleNodeDragStop: NodeDragHandler = (_event, node) => {
    setPositionOverrides((prev) => {
      const next = { ...prev, [node.id]: { x: node.position.x, y: node.position.y } };
      // Schedule the persist OUTSIDE the setter — setState callbacks
      // should be pure. We pass ``next`` via closure into the timeout
      // so the latest map is what hits the server.
      if (flowId) {
        if (persistTimerRef.current !== null) {
          window.clearTimeout(persistTimerRef.current);
        }
        persistTimerRef.current = window.setTimeout(() => {
          updatePositionsMutation.mutate({ flowId, positions: next });
          persistTimerRef.current = null;
        }, POSITION_PERSIST_DEBOUNCE_MS);
      }
      return next;
    });
  };

  // Flush any in-flight debounced PATCH on unmount so a fast nav-away
  // after a drag doesn't drop the position update.
  useEffect(() => {
    return () => {
      if (persistTimerRef.current !== null) {
        window.clearTimeout(persistTimerRef.current);
      }
    };
  }, []);

  // Drop overrides for node_ids that no longer appear in the graph
  // (renamed / deleted in the YAML). Keeps ``metadata.positions``
  // from accumulating stale entries indefinitely across edits.
  useEffect(() => {
    if (!flowId || nodes.length === 0) return;
    const liveIds = new Set(nodes.map((n: Node) => n.id));
    setPositionOverrides((prev) => {
      let changed = false;
      const next: Record<string, { x: number; y: number }> = {};
      for (const [id, pos] of Object.entries(prev)) {
        if (liveIds.has(id)) next[id] = pos;
        else changed = true;
      }
      return changed ? next : prev;
    });
  }, [flowId, nodes]);

  async function handleValidate() {
    setBanner(null);
    setErrors([]);
    try {
      const result = await validateMutation.mutateAsync(yamlText);
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
    try {
      // Edit mode (`flowId` set) uses the by-id endpoint so api_name rename
      // updates the existing row instead of upserting under a new name.
      // Create mode keeps the legacy upsert-by-api_name flow.
      const { flow, created } = flowId
        ? await saveByIdMutation.mutateAsync({ flowId, definition: yamlText })
        : await saveMutation.mutateAsync(yamlText);
      setBanner({
        kind: 'ok',
        text: created ? `Created "${flow.displayName}".` : `Saved "${flow.displayName}".`,
      });
      // Re-snapshot so the form goes back to "clean" after a successful
      // save. Without this, Save stays enabled until the next edit even
      // though the YAML now matches the persisted state.
      setInitialYamlText(yamlText);
      // For brand-new flows, swap the URL to /edit so reloads land back here.
      if (created && !flowId) {
        navigate(ROUTES.SETTINGS_FLOW_EDITOR.replace(':flowId', flow.id), {
          replace: true,
        });
      }
    } catch (err) {
      const saveErrors = extractSaveErrors(err);
      const collision = extractCollisionError(err);
      if (saveErrors.length > 0) {
        setErrors(saveErrors);
        setBanner({ kind: 'err', text: `Save rejected — ${saveErrors.length} issue(s).` });
      } else if (collision) {
        setErrors([collision]);
        setBanner({ kind: 'err', text: 'Rename rejected — api_name already in use.' });
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
            <h1 className="text-base font-semibold">
              {flowId
                ? existingFlow?.displayName ?? 'Edit flow'
                : 'New flow'}
            </h1>
            <p className="text-xs text-muted-foreground">
              YAML on the left · live preview on the right.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleValidate}
            disabled={validateMutation.isPending || !yamlText.trim()}
          >
            {validateMutation.isPending ? 'Validating…' : 'Validate'}
          </Button>
          <Button
            size="sm"
            onClick={handleSave}
            disabled={isSaving || !yamlText.trim() || !isDirty}
          >
            <Save size={14} aria-hidden="true" />
            {isSaving ? 'Saving…' : 'Save'}
          </Button>
        </div>
      </div>

      {/* ── Banner + error list ────────────────────────────────────────── */}
      {(banner || errors.length > 0) && (
        <div className="border-b border-border bg-card/40 px-4 py-2 space-y-1.5">
          {banner && (
            <div
              role="status"
              className={
                banner.kind === 'ok'
                  ? 'flex items-center gap-2 text-sm text-primary'
                  : 'flex items-center gap-2 text-sm text-destructive'
              }
            >
              {banner.kind === 'ok' ? (
                <CheckCircle2 size={14} aria-hidden="true" />
              ) : (
                <AlertCircle size={14} aria-hidden="true" />
              )}
              <span>{banner.text}</span>
            </div>
          )}
          {errors.length > 0 && (
            <ul className="space-y-1 text-xs font-mono" role="list">
              {errors.map((e, idx) => (
                <li key={idx} className="text-destructive">
                  <span className="text-muted-foreground">
                    {e.path || '(document)'}
                  </span>
                  {' — '}
                  {e.message}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* ── Split pane ─────────────────────────────────────────────────── */}
      <div className="grid flex-1 min-h-0 grid-cols-1 lg:grid-cols-2">
        {/* CodeMirror */}
        <div className="border-r border-border min-h-0 overflow-auto">
          <CodeMirror
            value={yamlText}
            extensions={[yamlLang()]}
            onChange={(value) => setYamlText(value)}
            theme={mode}
            basicSetup={{
              lineNumbers: true,
              foldGutter: true,
              highlightActiveLine: true,
              autocompletion: true,
            }}
            style={{ fontSize: 13, height: '100%' }}
            height="100%"
          />
        </div>

        {/* Read-only reactflow preview */}
        <div className="min-h-0 bg-background">
          {nodes.length === 0 ? (
            <div className="flex h-full items-center justify-center p-8 text-sm text-muted-foreground">
              {yamlText.trim()
                ? 'Add nodes under flow.nodes[] to see the graph.'
                : 'Start typing to see a live preview.'}
            </div>
          ) : (
            <ReactFlow
              nodes={nodes}
              edges={edges}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              // R10 #2: drag-end fires after the user releases a node.
              // ``onNodesChange`` also surfaces drag events but is
              // noisy (one event per frame) — we just want the final
              // position, which is what ``onNodeDragStop`` carries.
              onNodeDragStop={handleNodeDragStop}
              // R10 #1: register the custom loopback edge renderer
              // so back-edges tagged in yamlToGraph route via a side
              // channel instead of stacking on forward edges.
              edgeTypes={EDGE_TYPES}
              fitView
              // Nodes are draggable for readability tweaks. We deliberately
              // leave edge authoring off (`nodesConnectable`, `edgesUpdatable`)
              // — edges are written in YAML, so letting the canvas mutate
              // them would break the YAML-as-source-of-truth contract.
              nodesDraggable
              nodesConnectable={false}
              edgesUpdatable={false}
              proOptions={{ hideAttribution: true }}
            >
              {/* Background dots read from --color-border so they fade
                  with the active palette instead of staying near-black. */}
              <Background gap={20} color="var(--color-border)" />
              {/* Canvas zoom / fit-view controls. Placed on the right
                  so they don't sit underneath the YAML editor's split
                  pane and feel disconnected — matches the Figma / Miro
                  convention of canvas controls in the bottom-right. */}
              <Controls position="bottom-right" showInteractive={false} />
            </ReactFlow>
          )}
        </div>
      </div>
    </div>
  );
}

export default function FlowEditorView() {
  const { flowId } = useParams<{ flowId?: string }>();
  // ReactFlowProvider is required by reactflow v11 for instance-bound hooks
  // when components inside re-render heavily (CodeMirror keystrokes trigger
  // a graph rebuild on every change).
  return (
    <ReactFlowProvider>
      <ErrorFallback>
        <EditorInner flowId={flowId} />
      </ErrorFallback>
    </ReactFlowProvider>
  );
}

function ErrorFallback({ children }: { children: React.ReactNode }) {
  // Minimal local boundary — the global ErrorBoundary wraps the whole
  // settings tree but reactflow swallows some errors that bubble through
  // its internals.
  return (
    <div className="h-full">
      <Card className="hidden">
        {/* Placeholder so unused-import warnings don't fire. */}
        <CardContent>{null}</CardContent>
      </Card>
      {children}
    </div>
  );
}
