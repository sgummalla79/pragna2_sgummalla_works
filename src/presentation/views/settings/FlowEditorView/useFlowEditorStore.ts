/**
 * Zustand store backing the visual flow editor.
 *
 * Holds the canonical editing model — React Flow nodes (each agent node
 * carrying its inline, flow-owned agent), edges (each carrying a routing
 * condition), and flow-level metadata. React Flow renders from this
 * store and writes back through `onNodesChange` / `onEdgesChange` /
 * `onConnect`. On Save the store is serialised by `graphToYaml`.
 *
 * Nothing here touches the network or persists anything — staged agents
 * and topology live only in memory until the user clicks Save, which is
 * exactly the "don't create agents until the flow is saved" contract.
 */

import {
  type Connection,
  type Edge,
  type EdgeChange,
  type Node,
  type NodeChange,
  addEdge,
  applyEdgeChanges,
  applyNodeChanges,
  reconnectEdge,
} from 'reactflow';
import { create } from 'zustand';

import { EDGE_CONDITIONS, type EdgeConditionValue } from '@/constants/edgeConditions';
import {
  type AgentNodeData,
  type BoundaryNodeData,
  type ConditionEdgeData,
  type EditorAgent,
  type FlowMeta,
  EDGE_TYPE_CONDITION,
  NODE_END,
  NODE_START,
  NODE_TYPE_AGENT,
  NODE_TYPE_BOUNDARY,
  blankAgent,
  blankIfElseAgent,
  nextEndInstanceId,
} from './editorTypes';

type EditorNode = Node<AgentNodeData | BoundaryNodeData>;
type EditorEdge = Edge<ConditionEdgeData>;

const EMPTY_META: FlowMeta = {
  apiName: '',
  displayName: '',
  description: null,
  slashApiName: null,
  exposedAsSlash: false,
  metadata: {},
};

interface FlowEditorState {
  meta: FlowMeta;
  nodes: EditorNode[];
  edges: EditorEdge[];
  selectedNodeId: string | null;
  dirty: boolean;
  /** The id of the edge currently being reconnect-dragged, or null when
   *  no reconnect is in flight. Used by `isValidFlowConnection` to skip
   *  that edge in its duplicate-source→target check so the author can
   *  re-route an endpoint to a different handle on the SAME pair of
   *  nodes (which would otherwise collide with the still-present old
   *  edge and snap back). Set by `beginReconnect`, cleared by
   *  `endReconnect`. */
  reconnectingEdgeId: string | null;

  /** Replace the whole editing model (on load). Resets dirty. */
  hydrate: (model: { meta: FlowMeta; nodes: EditorNode[]; edges: EditorEdge[] }) => void;
  /** Clear everything (on unmount). */
  reset: () => void;
  /** Mark the model as saved (after a successful Save). */
  markClean: () => void;

  onNodesChange: (changes: NodeChange[]) => void;
  onEdgesChange: (changes: EdgeChange[]) => void;
  onConnect: (conn: Connection) => void;
  /** Move an existing edge's endpoint to a different node/handle. The
   *  edge's data (routing condition, etc.) is preserved; only
   *  source/target/sourceHandle/targetHandle change. */
  onReconnect: (oldEdge: EditorEdge, newConnection: Connection) => void;
  /** Mark a reconnect as in-flight by edge id. Wired to React Flow's
   *  `onReconnectStart`. */
  beginReconnect: (edgeId: string) => void;
  /** Clear the in-flight reconnect marker. Wired to React Flow's
   *  `onReconnectEnd` (fires after every drag — successful or not). */
  endReconnect: () => void;

  setMeta: (patch: Partial<FlowMeta>) => void;
  /** Add a fresh Agent node (emits empty, 1-in/1-out) at a position;
   *  returns its node_id and selects it. */
  addAgentNode: (position: { x: number; y: number }) => string;
  /** Add an If/Else node — same kind as Agent, just preset with
   *  emits=[passed, failed] + a classify-style prompt; returns its
   *  node_id and selects it. */
  addIfElseNode: (position: { x: number; y: number }) => string;
  /** Add another End sink at a position; returns its FE-only node id.
   *  All End instances serialize to `to: __end__` in YAML. */
  addEndNode: (position: { x: number; y: number }) => string;
  deleteNode: (nodeId: string) => void;
  selectNode: (nodeId: string | null) => void;
  /** Patch node-level fields (node_id rename, #26 slots). */
  updateNode: (nodeId: string, patch: Partial<AgentNodeData>) => void;
  /** Patch the inline agent on a node. */
  updateAgent: (nodeId: string, patch: Partial<EditorAgent>) => void;
  setEdgeCondition: (edgeId: string, condition: EdgeConditionValue) => void;
  deleteEdge: (edgeId: string) => void;
}

/** Changes that mutate the persisted model (vs. pure UI like selection). */
function isMutatingNodeChange(c: NodeChange): boolean {
  if (c.type === 'position') return c.dragging === false; // drag-end only
  return c.type === 'remove' || c.type === 'add' || c.type === 'reset';
}

/** Allocate an agent id not already used on the canvas. The YAML wire
 *  field is still `node_id` (BE schema unchanged), but the auto-allocated
 *  VALUE uses an `agent_` prefix so users see `agent_1`, `agent_2`, …
 *  on the canvas + side panel — never `node_1` (we stopped surfacing
 *  "node" in agent UI strings). */
function nextNodeId(nodes: EditorNode[]): string {
  const used = new Set(nodes.map((n) => n.id));
  let i = nodes.filter((n) => n.type === NODE_TYPE_AGENT).length + 1;
  while (used.has(`agent_${i}`)) i += 1;
  return `agent_${i}`;
}

export const useFlowEditorStore = create<FlowEditorState>((set, get) => ({
  meta: EMPTY_META,
  nodes: [],
  edges: [],
  selectedNodeId: null,
  dirty: false,
  reconnectingEdgeId: null,

  hydrate: ({ meta, nodes, edges }) =>
    set({ meta, nodes, edges, selectedNodeId: null, dirty: false, reconnectingEdgeId: null }),

  reset: () =>
    set({
      meta: EMPTY_META,
      nodes: [],
      edges: [],
      selectedNodeId: null,
      dirty: false,
      reconnectingEdgeId: null,
    }),

  markClean: () => set({ dirty: false }),

  beginReconnect: (edgeId) => set({ reconnectingEdgeId: edgeId }),
  endReconnect: () => set({ reconnectingEdgeId: null }),

  onNodesChange: (changes) =>
    set((s) => {
      // Strip any change that would remove the singleton Start node.
      // Start is auto-placed on every new flow and intentionally absent
      // from the palette (LangGraph has exactly one entry, so we'd have
      // no way to add it back). The Backspace/Delete keybinding +
      // multi-select-delete in React Flow would otherwise let users
      // drop Start and brick the canvas.
      const safe = changes.filter(
        (c) => !(c.type === 'remove' && c.id === NODE_START),
      );
      return {
        nodes: applyNodeChanges(safe, s.nodes) as EditorNode[],
        dirty: s.dirty || safe.some(isMutatingNodeChange),
      };
    }),

  onEdgesChange: (changes) =>
    set((s) => ({
      edges: applyEdgeChanges(changes, s.edges) as EditorEdge[],
      dirty: s.dirty || changes.some((c) => c.type === 'remove' || c.type === 'add'),
    })),

  onConnect: (conn) =>
    set((s) => {
      if (!conn.source || !conn.target) return s;
      // Dedupe identical source→target (conditions distinguish parallel
      // routes, but a duplicate default edge is just noise).
      const exists = s.edges.some(
        (e) => e.source === conn.source && e.target === conn.target,
      );
      if (exists) return s;
      const edge: EditorEdge = {
        id: `${conn.source}__${conn.target}__${Date.now()}`,
        source: conn.source,
        target: conn.target,
        // Remember which side each end attached to so the connector keeps
        // its hand-drawn routing across reload (persisted in metadata).
        sourceHandle: conn.sourceHandle ?? undefined,
        targetHandle: conn.targetHandle ?? undefined,
        type: EDGE_TYPE_CONDITION,
        data: { condition: EDGE_CONDITIONS.DEFAULT },
      };
      return { edges: addEdge(edge, s.edges) as EditorEdge[], dirty: true };
    }),

  onReconnect: (oldEdge, newConnection) =>
    set((s) => {
      // React Flow's reconnectEdge rewrites source/target/sourceHandle/
      // targetHandle in place; routing `condition` (in `data`) and the
      // rest of the edge survive verbatim. That's the exact semantic for
      // "user drags an endpoint to a different handle / different node".
      //
      // `shouldReplaceId: false` keeps the original edge id stable —
      // without it, the helper synthesises a new id from the new
      // endpoints (`reactflow__edge-<src><srcH>-<tgt><tgtH>`), React
      // would treat the edge as fully unmounted-and-remounted under a
      // new key, and any per-edge UI state would reset. Marks dirty so
      // the new handle sides save to metadata.edge_handles next save.
      const next = reconnectEdge(oldEdge, newConnection, s.edges, {
        shouldReplaceId: false,
      }) as EditorEdge[];
      return { edges: next, dirty: true };
    }),

  setMeta: (patch) => set((s) => ({ meta: { ...s.meta, ...patch }, dirty: true })),

  addAgentNode: (position) => {
    const nodeId = nextNodeId(get().nodes);
    const node: Node<AgentNodeData> = {
      id: nodeId,
      type: NODE_TYPE_AGENT,
      position,
      data: { nodeId, agent: blankAgent(nodeId) },
    };
    set((s) => ({ nodes: [...s.nodes, node], selectedNodeId: nodeId, dirty: true }));
    return nodeId;
  },

  addIfElseNode: (position) => {
    const nodeId = nextNodeId(get().nodes);
    const node: Node<AgentNodeData> = {
      id: nodeId,
      type: NODE_TYPE_AGENT,
      position,
      // Same UserAgent storage as a regular Agent — the if/else affordance
      // is just emits non-empty + the classify-style prompt template. The
      // BE doesn't know about a separate kind (future-discussions #33).
      data: { nodeId, agent: blankIfElseAgent(nodeId) },
    };
    set((s) => ({ nodes: [...s.nodes, node], selectedNodeId: nodeId, dirty: true }));
    return nodeId;
  },

  addEndNode: (position) => {
    const existing = new Set(get().nodes.map((n) => n.id));
    const id = nextEndInstanceId(existing);
    const node: Node<BoundaryNodeData> = {
      id,
      type: NODE_TYPE_BOUNDARY,
      position,
      data: { boundary: NODE_END },
    };
    set((s) => ({ nodes: [...s.nodes, node], selectedNodeId: null, dirty: true }));
    return id;
  },

  deleteNode: (nodeId) =>
    set((s) => {
      // Same guard as onNodesChange — Start is singleton + un-replaceable
      // (not in the palette), so we silently ignore a delete request on
      // it instead of bricking the canvas.
      if (nodeId === NODE_START) return s;
      return {
        nodes: s.nodes.filter((n) => n.id !== nodeId),
        edges: s.edges.filter((e) => e.source !== nodeId && e.target !== nodeId),
        selectedNodeId: s.selectedNodeId === nodeId ? null : s.selectedNodeId,
        dirty: true,
      };
    }),

  selectNode: (nodeId) => set({ selectedNodeId: nodeId }),

  updateNode: (nodeId, patch) =>
    set((s) => ({
      nodes: s.nodes.map((n) => {
        if (n.id !== nodeId || n.type !== NODE_TYPE_AGENT) return n;
        const data = { ...(n.data as AgentNodeData), ...patch };
        // Agent identity is collapsed onto the node_id (agents are
        // flow-local, 1-per-node, no reuse) — so a node_id rename also
        // renames its agent's api_name. One identity to keep unique.
        if (patch.nodeId) data.agent = { ...data.agent, apiName: patch.nodeId };
        // Keep React Flow node id in sync with a node_id rename so edges
        // and selection keep resolving.
        return { ...n, id: data.nodeId, data };
      }),
      // If the node_id changed, rewire edges + selection to the new id.
      edges:
        patch.nodeId && patch.nodeId !== nodeId
          ? s.edges.map((e) => ({
              ...e,
              source: e.source === nodeId ? patch.nodeId! : e.source,
              target: e.target === nodeId ? patch.nodeId! : e.target,
            }))
          : s.edges,
      selectedNodeId:
        patch.nodeId && s.selectedNodeId === nodeId ? patch.nodeId : s.selectedNodeId,
      dirty: true,
    })),

  updateAgent: (nodeId, patch) =>
    set((s) => ({
      nodes: s.nodes.map((n) =>
        n.id === nodeId && n.type === NODE_TYPE_AGENT
          ? { ...n, data: { ...(n.data as AgentNodeData), agent: { ...(n.data as AgentNodeData).agent, ...patch } } }
          : n,
      ),
      dirty: true,
    })),

  setEdgeCondition: (edgeId, condition) =>
    set((s) => ({
      edges: s.edges.map((e) =>
        e.id === edgeId ? { ...e, data: { ...e.data, condition } } : e,
      ),
      dirty: true,
    })),

  deleteEdge: (edgeId) =>
    set((s) => ({ edges: s.edges.filter((e) => e.id !== edgeId), dirty: true })),
}));

// E2E hook: expose the store on `window` in dev so Playwright specs can
// drive complex graphs (especially the per-port edges on If/Else nodes)
// without fighting React Flow's coordinate system. Stripped from
// production builds via the Vite `import.meta.env.DEV` flag (which is
// `false` in `vite build`'s output).
if (typeof window !== 'undefined' && import.meta.env.DEV) {
  (window as unknown as { __flowEditorStore?: typeof useFlowEditorStore }).__flowEditorStore =
    useFlowEditorStore;
}
