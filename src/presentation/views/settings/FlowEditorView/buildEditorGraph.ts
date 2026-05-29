/**
 * Build the editable graph model (meta + nodes + edges) from a flow's
 * stored YAML `definition`. Used to seed the Zustand store when opening
 * an existing flow (or the starter template for a new flow).
 *
 * Layout is delegated to {@link yamlToGraph} (dagre + persisted
 * `metadata.positions` overrides); this module enriches each positioned
 * node with its full inline agent definition so the canvas + side-panel
 * can edit it. Edges are read straight from the YAML (split on the
 * comma fan-in/out syntax) so each carries its routing condition.
 */

import yaml from 'js-yaml';
import type { Edge, Node } from 'reactflow';

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
  PORT_HANDLE_ELSE,
  blankAgent,
  isEndInstanceId,
  portHandleFor,
} from './editorTypes';
import { yamlToGraph } from './yamlToGraph';

type EditorNode = Node<AgentNodeData | BoundaryNodeData>;
type EditorEdge = Edge<ConditionEdgeData>;

interface RawAgent {
  api_name?: string;
  display_name?: string;
  description?: string | null;
  user_model?: string;
  system_prompt?: string;
  tools?: string[];
  emits?: string[];
}
interface RawNode {
  node_id?: string;
  agent?: string;
  inputs?: string[];
  outputs?: string[];
  reducers?: Record<string, string>;
}
interface RawEdge {
  from?: string;
  to?: string;
  condition?: string;
}
interface RawDoc {
  api_name?: string;
  display_name?: string;
  description?: string | null;
  slash_api_name?: string | null;
  exposed_as_slash?: boolean;
  metadata?: Record<string, unknown>;
  agents?: RawAgent[];
  flow?: { nodes?: RawNode[]; edges?: RawEdge[] };
}

function toAgent(raw: RawAgent): EditorAgent {
  const apiName = raw.api_name ?? '';
  return {
    apiName,
    displayName: raw.display_name ?? apiName,
    description: raw.description ?? null,
    userModel: raw.user_model ?? '',
    systemPrompt: raw.system_prompt ?? '',
    tools: raw.tools ?? [],
    emits: raw.emits ?? [],
  };
}

export interface EditorGraph {
  meta: FlowMeta;
  nodes: EditorNode[];
  edges: EditorEdge[];
}

/** Parse a flow YAML string into the editable graph model. Best-effort:
 *  malformed YAML yields empty nodes/edges + whatever meta parsed. */
export function buildEditorGraph(yamlText: string): EditorGraph {
  let doc: RawDoc = {};
  try {
    const parsed = yaml.load(yamlText);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      doc = parsed as RawDoc;
    }
  } catch {
    /* keep doc = {} */
  }

  const meta: FlowMeta = {
    apiName: doc.api_name ?? '',
    displayName: doc.display_name ?? '',
    description: doc.description ?? null,
    slashApiName: doc.slash_api_name ?? null,
    exposedAsSlash: doc.exposed_as_slash ?? false,
    // Strip positions out of metadata — they're rebuilt from live node
    // coordinates on save, not carried as authored config.
    metadata: stripPositions(doc.metadata),
  };

  // Layout via the existing read-only projector (dagre + persisted
  // position overrides). Gives every node a coordinate.
  const positionsRaw = (doc.metadata?.positions ?? null) as
    | Record<string, { x: number; y: number }>
    | null;
  const laid = yamlToGraph(yamlText, positionsRaw);
  const positionById = new Map(laid.nodes.map((n) => [n.id, n.position]));

  const agentByName = new Map<string, EditorAgent>();
  for (const a of doc.agents ?? []) {
    if (a.api_name) agentByName.set(a.api_name, toAgent(a));
  }

  const nodes: EditorNode[] = [];
  // Singleton Start boundary.
  const startPos = positionById.get(NODE_START) ?? positionsRaw?.[NODE_START];
  if (startPos) {
    nodes.push({
      id: NODE_START,
      type: NODE_TYPE_BOUNDARY,
      position: startPos,
      data: { boundary: NODE_START },
    });
  }

  // Multi-instance End boundaries (#33). The YAML only knows `__end__` as
  // a single sentinel; the per-instance `::n` ids are FE-only and live in
  // `metadata.positions`. So we scan the metadata directly (yamlToGraph
  // never sees the suffixed ids).
  const endIds = positionsRaw
    ? Object.keys(positionsRaw).filter(isEndInstanceId)
    : [];
  // Legacy flows: just one `__end__` (yamlToGraph adds it from the edges).
  if (endIds.length === 0 && positionById.has(NODE_END)) endIds.push(NODE_END);
  if (endIds.length === 0) endIds.push(NODE_END); // empty/new flow fallback
  for (const id of endIds) {
    nodes.push({
      id,
      type: NODE_TYPE_BOUNDARY,
      position: positionsRaw?.[id] ?? positionById.get(id) ?? { x: 720, y: 200 },
      data: { boundary: NODE_END },
    });
  }
  // Agent nodes.
  for (const n of doc.flow?.nodes ?? []) {
    if (!n.node_id) continue;
    const base = (n.agent && agentByName.get(n.agent)) || blankAgent(n.node_id);
    // Collapse invariant: an agent's api_name is its node_id (flow-local,
    // 1-per-node, no reuse). Clone so two nodes that referenced the same
    // legacy agent name each get their own copy under their node_id.
    const agent = { ...base, apiName: n.node_id };
    const data: AgentNodeData = { nodeId: n.node_id, agent };
    if (n.inputs?.length) data.inputs = n.inputs;
    if (n.outputs?.length) data.outputs = n.outputs;
    if (n.reducers && Object.keys(n.reducers).length) data.reducers = n.reducers;
    nodes.push({
      id: n.node_id,
      type: NODE_TYPE_AGENT,
      position: positionById.get(n.node_id) ?? { x: 0, y: 0 },
      data,
    });
  }

  // Persisted per-edge side-handle routing. The post-#33 key is
  // `source|sourceHandle|target`; legacy flows used `source|target`. Try
  // the new format first, then fall back so old saved flows still load.
  const edgeHandles = (doc.metadata?.edge_handles ?? {}) as Record<
    string,
    { source?: string; target?: string }
  >;
  // Multi-End round-trip (#33): retarget `to: __end__` edges back to the
  // specific End instance they attached to. Map key: `from|condition`.
  const endRouting = (doc.metadata?.end_routing ?? {}) as Record<string, string>;

  // Map node_id → emits so we can decide if a source is branching (and
  // therefore its outbound condition derives its source handle id).
  const emitsByNodeId = new Map<string, string[]>();
  for (const n of nodes) {
    if (n.type === NODE_TYPE_AGENT) {
      emitsByNodeId.set(n.id, (n.data as AgentNodeData).agent.emits);
    }
  }

  // Edges: expand comma fan-in/out into one edge per (source, target).
  const declared = new Set(nodes.map((n) => n.id));
  const edges: EditorEdge[] = [];
  let counter = 0;
  for (const e of doc.flow?.edges ?? []) {
    if (!e.from || !e.to) continue;
    const condition = (e.condition ?? EDGE_CONDITIONS.DEFAULT) as EdgeConditionValue;
    const sources = String(e.from).split(',').map((s) => s.trim());
    const rawTargets = String(e.to).split(',').map((s) => s.trim());
    for (const source of sources) {
      if (!declared.has(source)) continue;
      // Compute source handle:
      //  - branching agent → derive from condition (port:<x> or port:else)
      //  - chat agent / Start → persisted handle, else right (horizontal)
      const sourceIsBranching = (emitsByNodeId.get(source)?.length ?? 0) > 0;
      let sourceHandle: string | undefined;
      if (sourceIsBranching) {
        sourceHandle =
          condition === EDGE_CONDITIONS.DEFAULT
            ? PORT_HANDLE_ELSE
            : portHandleFor(condition);
      }
      for (const rawTarget of rawTargets) {
        // Multi-End retarget: `to: __end__` may belong to any End
        // instance — let metadata.end_routing tell us which.
        let target = rawTarget;
        if (target === NODE_END) {
          const routed = endRouting[`${source}|${condition}`];
          if (routed && declared.has(routed)) target = routed;
        }
        if (!declared.has(target)) continue;
        // Look up persisted handle sides — new key first, then legacy.
        const handles =
          edgeHandles[`${source}|${sourceHandle ?? ''}|${target}`] ??
          edgeHandles[`${source}|${target}`];
        // Default handle ids:
        //  - source = Start → 'out' (its only handle)
        //  - source = branching agent → already set above
        //  - source = chat agent → persisted, else 'bottom' (legacy)
        //  - target = End instance → 'in' (its only handle)
        //  - target = non-End → persisted, else 'top' (legacy)
        const finalSourceHandle =
          sourceHandle ??
          handles?.source ??
          (source === NODE_START ? 'out' : 'bottom');
        const finalTargetHandle =
          handles?.target ?? (isEndInstanceId(target) ? 'in' : 'top');
        edges.push({
          id: `e_${counter++}`,
          source,
          target,
          sourceHandle: finalSourceHandle,
          targetHandle: finalTargetHandle,
          type: EDGE_TYPE_CONDITION,
          data: { condition },
        });
      }
    }
  }

  return { meta, nodes, edges };
}

/** Return metadata without the editor's layout keys (`positions`,
 *  `edge_handles`, `end_routing`) — those are rebuilt from live canvas
 *  state on save, not authored config the user manages. */
function stripPositions(
  metadata: Record<string, unknown> | undefined,
): Record<string, unknown> {
  if (!metadata) return {};
  const {
    positions: _positions,
    edge_handles: _edgeHandles,
    end_routing: _endRouting,
    ...rest
  } = metadata as Record<string, unknown>;
  return rest;
}
