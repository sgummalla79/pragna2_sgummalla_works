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

/** R10 #2: per-node manual overrides applied AFTER dagre lays out.
 *  Keyed on ``node_id`` so they survive any topology change that
 *  doesn't rename / remove the node. ``null`` map means "no overrides
 *  — use dagre output verbatim". */
export type PositionOverrides = Record<string, { x: number; y: number }> | null;

/**
 * Best-effort YAML → graph projection. Never throws — invalid YAML
 * returns an empty graph and the editor renders the validation
 * errors elsewhere.
 *
 * R10 #1 + #2:
 * - Edges whose target sits at or above their source in the dagre
 *   layout (= visual loop-backs) are tagged ``type: 'loopback'`` so a
 *   custom edge component can route them along a side channel
 *   instead of overlapping the forward edges.
 * - Caller can pass ``positionOverrides`` to apply persisted
 *   user-drag positions on top of the dagre layout. Nodes absent
 *   from the override map keep their dagre coordinates so a
 *   newly-added node still appears in the auto-laid graph.
 */
export function yamlToGraph(
  yamlText: string,
  positionOverrides: PositionOverrides = null,
): YamlGraph {
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
      // Read from --color-* tokens so the canvas follows palette swaps.
      // (Earlier versions used `--muted` without the prefix — that
      // doesn't match our Tailwind v4 naming, so it always fell back.)
      style: {
        background: 'var(--color-muted)',
        color: 'var(--color-muted-foreground)',
        border: '1px dashed var(--color-border)',
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
        background: 'var(--color-card)',
        color: 'var(--color-card-foreground)',
        border: '1px solid var(--color-border)',
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
          // smoothstep routes orthogonally around the node boxes — easier
          // to read than the default bezier when dagre packs nodes
          // tightly. Default bezier sometimes slices through unrelated
          // nodes when the graph is dense. R10 #1 reassigns this to
          // 'loopback' below for back-edges so they don't overlap.
          type: 'smoothstep',
          label: e.condition && e.condition !== 'default' ? e.condition : undefined,
          // SVG `fill` / `stroke` need real CSS color strings — we read
          // the same tokens the rest of the canvas uses so palette swaps
          // flow through edge styling too.
          labelStyle: { fill: 'var(--color-muted-foreground)', fontSize: 10 },
          labelBgStyle: { fill: 'var(--color-popover)' },
          style: { stroke: 'var(--color-border)', strokeWidth: 1.5 },
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

  // Record dagre's per-node center y so we can detect backward edges
  // BEFORE applying user position overrides (overrides would distort
  // the rank-based check). Falls back to 0 for any node dagre didn't
  // place (shouldn't happen — every node was added above).
  const dagreCenterY = new Map<string, number>();
  for (const node of reactNodes) {
    const laid = g.node(node.id);
    if (laid) dagreCenterY.set(node.id, laid.y);
  }

  for (const node of reactNodes) {
    const laid = g.node(node.id);
    if (laid) {
      // dagre returns center coords; reactflow expects top-left.
      node.position = { x: laid.x - NODE_WIDTH / 2, y: laid.y - NODE_HEIGHT / 2 };
    }
    // R10 #2: apply user override (if present) AFTER dagre. Unknown
    // node_ids in the override map are ignored — they refer to nodes
    // that have since been deleted or renamed in the YAML.
    const override = positionOverrides?.[node.id];
    if (override) {
      node.position = override;
    }
  }

  // R10 #1: tag back-edges as 'loopback' so the custom edge component
  // can route them along a side channel instead of overlapping the
  // forward edges. An edge is "backward" when its target sits at or
  // above its source in dagre's TB layout — i.e. the visual line
  // would have to travel UP, which smoothstep handles by retracing
  // the same vertical channel as the forward path and producing the
  // stacked-edges look the user originally flagged.
  //
  // Self-loops (src === dst) are always tagged loopback so they
  // surface as a visible bulge instead of collapsing to a point.
  for (const edge of reactEdges) {
    if (edge.source === edge.target) {
      edge.type = 'loopback';
      continue;
    }
    const sourceY = dagreCenterY.get(edge.source);
    const targetY = dagreCenterY.get(edge.target);
    if (sourceY !== undefined && targetY !== undefined && targetY <= sourceY) {
      edge.type = 'loopback';
    }
  }

  return { nodes: reactNodes, edges: reactEdges };
}
