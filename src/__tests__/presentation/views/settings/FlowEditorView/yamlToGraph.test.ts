import { describe, expect, it } from 'vitest';
import { yamlToGraph } from '@/presentation/views/settings/FlowEditorView/yamlToGraph';

const SAMPLE = `
api_name: f
display_name: F
agents:
  - api_name: intake
    display_name: Intake
    user_model: m1
  - api_name: reviewer
    display_name: Reviewer
    user_model: m1
flow:
  nodes:
    - {node_id: intake_1, agent: intake}
    - {node_id: review_1, agent: reviewer}
  edges:
    - {from: __start__, to: intake_1}
    - {from: intake_1, to: review_1}
    - {from: review_1, to: __end__, condition: passed}
    - {from: review_1, to: intake_1, condition: failed}
`;

describe('yamlToGraph', () => {
  it('returns an empty graph for empty / whitespace input', () => {
    expect(yamlToGraph('')).toEqual({ nodes: [], edges: [] });
    expect(yamlToGraph('   \n\n')).toEqual({ nodes: [], edges: [] });
  });

  it('tolerates malformed YAML without throwing', () => {
    const result = yamlToGraph('api_name: "unclosed\n');
    expect(result.nodes).toEqual([]);
    expect(result.edges).toEqual([]);
  });

  it('renders declared nodes plus boundary nodes referenced by edges', () => {
    const { nodes } = yamlToGraph(SAMPLE);
    const ids = nodes.map((n) => n.id).sort();
    expect(ids).toEqual(['__end__', '__start__', 'intake_1', 'review_1']);
  });

  it('produces one edge per (source, target) pair (including conditionals)', () => {
    const { edges } = yamlToGraph(SAMPLE);
    expect(edges).toHaveLength(4);
    const pairs = edges.map((e) => `${e.source}->${e.target}`).sort();
    expect(pairs).toEqual([
      '__start__->intake_1',
      'intake_1->review_1',
      'review_1->__end__',
      'review_1->intake_1',
    ]);
  });

  it('shows the condition label on non-default edges and hides it otherwise', () => {
    const { edges } = yamlToGraph(SAMPLE);
    const passed = edges.find((e) => e.source === 'review_1' && e.target === '__end__');
    const intakeIn = edges.find((e) => e.source === '__start__' && e.target === 'intake_1');
    expect(passed?.label).toBe('passed');
    expect(intakeIn?.label).toBeUndefined();
  });

  it('expands fan-out and fan-in via comma-separated endpoints', () => {
    const yamlText = `
api_name: f
display_name: F
flow:
  nodes:
    - {node_id: a, agent: x}
    - {node_id: b, agent: x}
    - {node_id: c, agent: x}
    - {node_id: d, agent: x}
  edges:
    - {from: a, to: 'b,c'}
    - {from: 'b,c', to: d}
`;
    const { edges } = yamlToGraph(yamlText);
    const pairs = edges.map((e) => `${e.source}->${e.target}`).sort();
    expect(pairs).toEqual(['a->b', 'a->c', 'b->d', 'c->d']);
  });

  it('runs dagre so node positions are not all (0,0)', () => {
    const { nodes } = yamlToGraph(SAMPLE);
    const distinct = new Set(nodes.map((n) => `${n.position.x},${n.position.y}`));
    expect(distinct.size).toBeGreaterThan(1);
  });

  // Loopback bulge tagging was removed — the visual editor uses free-hand
  // bezier connectors (ConditionEdge) for all edges, and consumes only
  // yamlToGraph's node positions. All edges stay the default smoothstep
  // here (this edge list is unused by the editor).
  it('leaves all edges as smoothstep (no loopback bulge)', () => {
    const { edges } = yamlToGraph(SAMPLE);
    expect(edges.every((e) => e.type === 'smoothstep')).toBe(true);
    // The back-edge still exists; it's just not specially tagged.
    expect(edges.some((e) => e.source === 'review_1' && e.target === 'intake_1')).toBe(true);
  });

  // R10 #2 — position overrides applied AFTER dagre lays out, keyed
  // on node_id. Unknown ids in the override map are ignored (they
  // refer to nodes since renamed / deleted).
  it('applies positionOverrides on top of the dagre layout', () => {
    const overrides = {
      intake_1: { x: 400, y: 50 },
      ghost_node: { x: 999, y: 999 }, // not in the YAML — ignored
    };
    const { nodes } = yamlToGraph(SAMPLE, overrides);
    const intake = nodes.find((n) => n.id === 'intake_1');
    expect(intake?.position).toEqual({ x: 400, y: 50 });
    const review = nodes.find((n) => n.id === 'review_1');
    // review_1 wasn't overridden → keeps its dagre coords (whatever
    // they are, just not (400, 50)).
    expect(review?.position).not.toEqual({ x: 400, y: 50 });
    // Ghost id didn't materialise as a new node.
    expect(nodes.find((n) => n.id === 'ghost_node')).toBeUndefined();
  });

  it('null/empty positionOverrides yields the same graph as dagre alone', () => {
    const a = yamlToGraph(SAMPLE);
    const b = yamlToGraph(SAMPLE, null);
    const c = yamlToGraph(SAMPLE, {});
    const positionsA = a.nodes.map((n) => `${n.id}:${n.position.x},${n.position.y}`);
    const positionsB = b.nodes.map((n) => `${n.id}:${n.position.x},${n.position.y}`);
    const positionsC = c.nodes.map((n) => `${n.id}:${n.position.x},${n.position.y}`);
    expect(positionsB).toEqual(positionsA);
    expect(positionsC).toEqual(positionsA);
  });
});
