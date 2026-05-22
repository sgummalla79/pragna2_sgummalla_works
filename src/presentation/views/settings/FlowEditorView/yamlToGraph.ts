/**
 * Parse a flow YAML into reactflow-compatible nodes and edges,
 * laid out top-to-bottom with dagre.
 *
 * The viewer is read-only (R3.7): drag-to-author lives in the YAML
 * editor pane, not on the canvas. Parsing here is purely best-effort
 * preview — the server's `validate-yaml` endpoint is the authoritative
 * check.
 */
import dagre from 'dagre';
import yaml from 'js-yaml';
import type { Edge, Node } from 'reactflow';

/** Reserved graph boundary node ids understood by both ends. */
const NODE_START = '__start__';
const NODE_END = '__end__';

/** Default per-node box size used by dagre for layout. The actual
 *  React node may render larger; layout only cares about relative
 *  positioning. */
const NODE_WIDTH = 180;
const NODE_HEIGHT = 56;

interface ParsedNode {
  node_id: string;
  agent?: string;
}

interface ParsedEdge {
  from?: string;
  to?: string;
  condition?: string;
}

interface ParsedDoc {
  agents?: Array<{ api_name?: string; display_name?: string }>;
  flow?: {
    nodes?: ParsedNode[];
    edges?: ParsedEdge[];
  };
}

export interface YamlGraph {
  nodes: Node[];
  edges: Edge[];
}

/** Returns an empty graph when the YAML can't even be parsed at the
 *  top level. The editor falls back to "no preview" in that state. */
const EMPTY_GRAPH: YamlGraph = { nodes: [], edges: [] };

/**
 * Best-effort YAML → graph projection. Never throws — invalid YAML
 * returns an empty graph and the editor renders the validation
 * errors elsewhere.
 */
export function yamlToGraph(yamlText: string): YamlGraph {
  if (!yamlText.trim()) return EMPTY_GRAPH;

  let parsed: unknown;
  try {
    parsed = yaml.load(yamlText);
  } catch {
    return EMPTY_GRAPH;
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return EMPTY_GRAPH;
  }

  const doc = parsed as ParsedDoc;
  const nodes = doc.flow?.nodes ?? [];
  const edges = doc.flow?.edges ?? [];

  // Build the set of node ids referenced anywhere (declared + edge endpoints).
  // Edges may use comma-separated fan-out/fan-in syntax; split on commas.
  const declared = new Set<string>();
  for (const n of nodes) {
    if (n.node_id) declared.add(n.node_id);
  }
  const boundaries = new Set<string>();
  for (const e of edges) {
    for (const raw of [e.from, e.to]) {
      if (!raw) continue;
      for (const part of String(raw).split(',')) {
        const trimmed = part.trim();
        if (trimmed === NODE_START || trimmed === NODE_END) {
          boundaries.add(trimmed);
        }
      }
    }
  }

  // Look up agent display info to render on the node.
  const agentDisplay = new Map<string, string>();
  for (const agent of doc.agents ?? []) {
    if (agent?.api_name) {
      agentDisplay.set(agent.api_name, agent.display_name ?? agent.api_name);
    }
  }

  // ── Build flat node + edge lists, then run dagre for positions ───────
  const reactNodes: Node[] = [];
  for (const id of boundaries) {
    reactNodes.push({
      id,
      data: { label: id === NODE_START ? '▶ Start' : '■ End' },
      position: { x: 0, y: 0 },
      type: 'default',
      sourcePosition: 'bottom' as Node['sourcePosition'],
      targetPosition: 'top' as Node['targetPosition'],
      style: {
        background: 'var(--muted, #1f1f1f)',
        color: 'var(--muted-foreground, #a3a3a3)',
        border: '1px dashed #3a3a3a',
        borderRadius: 8,
        padding: '8px 12px',
        fontSize: 12,
      },
    });
  }
  for (const n of nodes) {
    if (!n.node_id) continue;
    const subtitle = n.agent ? agentDisplay.get(n.agent) ?? n.agent : '';
    reactNodes.push({
      id: n.node_id,
      data: { label: subtitle ? `${n.node_id}\n${subtitle}` : n.node_id },
      position: { x: 0, y: 0 },
      type: 'default',
      sourcePosition: 'bottom' as Node['sourcePosition'],
      targetPosition: 'top' as Node['targetPosition'],
      style: {
        background: 'var(--card, #171717)',
        color: 'var(--card-foreground, #ececea)',
        border: '1px solid #2a2a2a',
        borderRadius: 10,
        padding: '8px 12px',
        fontSize: 12,
        whiteSpace: 'pre-line',
        textAlign: 'center' as const,
        minWidth: NODE_WIDTH,
      },
    });
  }

  // Edges: fan-out (a → b,c) becomes one edge per target; fan-in (a,b → c)
  // becomes one edge per source.
  const reactEdges: Edge[] = [];
  let edgeCounter = 0;
  for (const e of edges) {
    if (!e.from || !e.to) continue;
    const sources = String(e.from)
      .split(',')
      .map((s) => s.trim())
      .filter((s) => declared.has(s) || s === NODE_START || s === NODE_END);
    const targets = String(e.to)
      .split(',')
      .map((s) => s.trim())
      .filter((s) => declared.has(s) || s === NODE_START || s === NODE_END);
    for (const src of sources) {
      for (const dst of targets) {
        reactEdges.push({
          id: `e_${edgeCounter++}`,
          source: src,
          target: dst,
          label: e.condition && e.condition !== 'default' ? e.condition : undefined,
          labelStyle: { fill: '#a3a3a3', fontSize: 10 },
          labelBgStyle: { fill: '#0d0d0d' },
          style: { stroke: '#3a3a3a', strokeWidth: 1.5 },
        });
      }
    }
  }

  // ── Auto-layout with dagre (top → bottom) ────────────────────────────
  const g = new dagre.graphlib.Graph();
  g.setGraph({ rankdir: 'TB', nodesep: 40, ranksep: 60 });
  g.setDefaultEdgeLabel(() => ({}));
  for (const node of reactNodes) {
    g.setNode(node.id, { width: NODE_WIDTH, height: NODE_HEIGHT });
  }
  for (const edge of reactEdges) {
    g.setEdge(edge.source, edge.target);
  }
  dagre.layout(g);

  for (const node of reactNodes) {
    const laid = g.node(node.id);
    if (laid) {
      // dagre returns center coords; reactflow expects top-left.
      node.position = { x: laid.x - NODE_WIDTH / 2, y: laid.y - NODE_HEIGHT / 2 };
    }
  }

  return { nodes: reactNodes, edges: reactEdges };
}
