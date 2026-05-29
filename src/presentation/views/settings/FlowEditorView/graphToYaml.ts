/**
 * Serialise the visual editor's graph back into flow YAML — the inverse
 * of {@link yamlToGraph}. The result is POSTed to
 * `/api/flows[/{id}]/from-yaml`, which validates it and projects it into
 * the relational tables (flow + flow-owned agents + nodes + edges).
 *
 * YAML is a derived artifact here, not a hand-edited source: the canvas
 * is the authoring surface and this function is the only writer.
 *
 * Node positions are emitted under `metadata.positions` (a
 * `{node_id: {x, y}}` map) so layout persists with the flow in the same
 * atomic save — no separate position-persistence call.
 */

import yaml from 'js-yaml';
import type { Edge, Node } from 'reactflow';

import { EDGE_CONDITIONS } from '@/constants/edgeConditions';
import {
  type AgentNodeData,
  type BoundaryNodeData,
  type ConditionEdgeData,
  type FlowMeta,
  NODE_END,
  NODE_TYPE_AGENT,
  PORT_HANDLE_ELSE,
  PORT_HANDLE_PREFIX,
  isEndInstanceId,
} from './editorTypes';

type EditorNode = Node<AgentNodeData | BoundaryNodeData>;
type EditorEdge = Edge<ConditionEdgeData>;

/** The condition this edge carries, derived from which port it leaves.
 *
 *  - A branching agent's right-side ports have ids `port:<emit>` and
 *    `port:else`; `port:else` maps to `EDGE_CONDITIONS.DEFAULT`, every
 *    other port unwraps to its emit label.
 *  - A non-port source handle (chat agent's omni handles, Start's `out`,
 *    legacy edges) is unconditional → `EDGE_CONDITIONS.DEFAULT`. */
function deriveEdgeCondition(e: EditorEdge): string {
  const sh = e.sourceHandle ?? '';
  if (!sh.startsWith(PORT_HANDLE_PREFIX)) return EDGE_CONDITIONS.DEFAULT;
  if (sh === PORT_HANDLE_ELSE) return EDGE_CONDITIONS.DEFAULT;
  return sh.slice(PORT_HANDLE_PREFIX.length);
}

/** One serialised `agents:` entry. Optional keys are omitted when empty
 *  so the YAML stays clean and round-trips to defaults. */
function agentEntry(a: AgentNodeData['agent']): Record<string, unknown> {
  const entry: Record<string, unknown> = {
    api_name: a.apiName,
    display_name: a.displayName,
    user_model: a.userModel,
    system_prompt: a.systemPrompt,
  };
  if (a.description) entry.description = a.description;
  if (a.tools.length) entry.tools = [...a.tools];
  if (a.emits.length) entry.emits = [...a.emits];
  return entry;
}

/** One serialised `flow.nodes:` entry, including #26 slot wiring. */
function nodeEntry(data: AgentNodeData): Record<string, unknown> {
  const entry: Record<string, unknown> = {
    node_id: data.nodeId,
    agent: data.agent.apiName,
  };
  if (data.inputs?.length) entry.inputs = [...data.inputs];
  if (data.outputs?.length) entry.outputs = [...data.outputs];
  if (data.reducers && Object.keys(data.reducers).length) {
    entry.reducers = { ...data.reducers };
  }
  return entry;
}

/**
 * Build the flow YAML document from the canvas graph.
 *
 * @param meta  Flow-level fields edited in the header form.
 * @param nodes React Flow nodes (agent nodes carry their inline agent;
 *              boundary nodes are skipped from `agents`/`nodes` but
 *              still contribute a position).
 * @param edges React Flow edges; `data.condition` drives routing.
 * @returns A YAML string ready for `/api/flows[/{id}]/from-yaml`.
 */
export function graphToYaml(
  meta: FlowMeta,
  nodes: EditorNode[],
  edges: EditorEdge[],
): string {
  const agentNodes = nodes.filter(
    (n): n is Node<AgentNodeData> => n.type === NODE_TYPE_AGENT,
  );

  // Agents: one entry per distinct agent api_name (the GUI authors one
  // agent per node, but dedupe defensively so a duplicate name can't
  // emit two conflicting blocks).
  const agentsByName = new Map<string, Record<string, unknown>>();
  for (const n of agentNodes) {
    const a = n.data.agent;
    if (!agentsByName.has(a.apiName)) agentsByName.set(a.apiName, agentEntry(a));
  }

  // Positions for EVERY node (incl. boundaries) so layout round-trips.
  const positions: Record<string, { x: number; y: number }> = {};
  for (const n of nodes) {
    positions[n.id] = {
      x: Math.round(n.position.x),
      y: Math.round(n.position.y),
    };
  }

  // Per-edge side-handle routing. The key format depends on whether the
  // source is a branching agent:
  //   - branching → `source|sourceHandle|target` (sourceHandle is a
  //     `port:*` id that distinguishes N+1 outbound edges from the same
  //     source); buildEditorGraph derives sourceHandle from condition.
  //   - chat / Start → legacy `source|target` (sourceHandle is the side
  //     the user dragged from; buildEditorGraph recovers it from here).
  // Both formats coexist in the same map; buildEditorGraph reads both.
  const emitsByNodeId = new Map<string, number>();
  for (const n of agentNodes) {
    emitsByNodeId.set(n.id, n.data.agent.emits.length);
  }
  const edgeHandles: Record<string, { source?: string; target?: string }> = {};
  for (const e of edges) {
    if (!e.sourceHandle && !e.targetHandle) continue;
    const targetForKey = isEndInstanceId(e.target) ? NODE_END : e.target;
    const sourceBranches = (emitsByNodeId.get(e.source) ?? 0) > 0;
    const key = sourceBranches
      ? `${e.source}|${e.sourceHandle ?? ''}|${targetForKey}`
      : `${e.source}|${targetForKey}`;
    edgeHandles[key] = {
      source: e.sourceHandle ?? undefined,
      target: e.targetHandle ?? undefined,
    };
  }

  // Multi-End round-trip (#33): the YAML `to: __end__` is ambiguous when
  // multiple End instances exist on the canvas. We record which canvas
  // End each terminating edge attaches to, keyed by `from|condition`.
  // buildEditorGraph reads this to re-route on reload; legacy flows
  // without this map fall back to the single original End.
  const endRouting: Record<string, string> = {};
  for (const e of edges) {
    if (!isEndInstanceId(e.target)) continue;
    if (e.target === NODE_END) continue; // single End — no entry needed
    const condition = deriveEdgeCondition(e);
    endRouting[`${e.source}|${condition}`] = e.target;
  }

  const metadata: Record<string, unknown> = { ...meta.metadata, positions };
  if (Object.keys(edgeHandles).length) metadata.edge_handles = edgeHandles;
  if (Object.keys(endRouting).length) metadata.end_routing = endRouting;

  const doc: Record<string, unknown> = {
    api_name: meta.apiName,
    display_name: meta.displayName,
  };
  if (meta.description) doc.description = meta.description;
  // Slash fields are written explicitly (not absent-tolerant here) — the
  // editor always knows the intended state. BE treats present values as
  // authoritative.
  if (meta.slashApiName) doc.slash_api_name = meta.slashApiName;
  doc.exposed_as_slash = meta.exposedAsSlash;
  doc.metadata = metadata;
  doc.agents = [...agentsByName.values()];
  doc.flow = {
    nodes: agentNodes.map((n) => nodeEntry(n.data)),
    edges: edges.map((e) => {
      const condition = deriveEdgeCondition(e);
      // Collapse any End id suffix back to the BE sentinel `__end__`.
      const to = isEndInstanceId(e.target) ? NODE_END : e.target;
      const entry: Record<string, unknown> = { from: e.source, to };
      if (condition !== EDGE_CONDITIONS.DEFAULT) entry.condition = condition;
      return entry;
    }),
  };

  // `lineWidth: -1` disables line wrapping so long system prompts stay on
  // one logical line; `noRefs` avoids YAML anchors/aliases for repeated
  // structures (cleaner, human-readable output for the "view source").
  return yaml.dump(doc, { lineWidth: -1, noRefs: true });
}
