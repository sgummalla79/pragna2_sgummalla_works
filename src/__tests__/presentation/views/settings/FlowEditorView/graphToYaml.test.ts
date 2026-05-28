import { describe, expect, it } from 'vitest';
import yaml from 'js-yaml';
import type { Edge, Node } from 'reactflow';

import { graphToYaml } from '@/presentation/views/settings/FlowEditorView/graphToYaml';
import { buildEditorGraph } from '@/presentation/views/settings/FlowEditorView/buildEditorGraph';
import { yamlToGraph } from '@/presentation/views/settings/FlowEditorView/yamlToGraph';
import {
  type AgentNodeData,
  type BoundaryNodeData,
  type ConditionEdgeData,
  type FlowMeta,
  NODE_END,
  NODE_START,
  NODE_TYPE_AGENT,
  NODE_TYPE_BOUNDARY,
} from '@/presentation/views/settings/FlowEditorView/editorTypes';

const META: FlowMeta = {
  apiName: 'research-pipeline',
  displayName: 'Research Pipeline',
  description: 'A two-node review loop.',
  slashApiName: 'research',
  exposedAsSlash: true,
  metadata: { max_revisions: 3 },
};

function agentNode(
  id: string,
  agentApiName: string,
  x: number,
  y: number,
  extra: Partial<AgentNodeData> = {},
): Node<AgentNodeData> {
  return {
    id,
    type: NODE_TYPE_AGENT,
    position: { x, y },
    data: {
      nodeId: id,
      agent: {
        apiName: agentApiName,
        displayName: agentApiName,
        description: null,
        userModel: 'claude-sonnet-4-6',
        systemPrompt: `You are ${agentApiName}.`,
        tools: [],
        emits: [],
      },
      ...extra,
    },
  };
}

function boundary(b: typeof NODE_START | typeof NODE_END, x: number, y: number): Node<BoundaryNodeData> {
  return { id: b, type: NODE_TYPE_BOUNDARY, position: { x, y }, data: { boundary: b } };
}

function edge(source: string, target: string, condition?: ConditionEdgeData['condition']): Edge<ConditionEdgeData> {
  return {
    id: `${source}->${target}`,
    source,
    target,
    data: condition ? { condition } : undefined,
  };
}

describe('graphToYaml', () => {
  const nodes = [
    boundary(NODE_START, 0, 0),
    agentNode('researcher_1', 'researcher', 100, 80),
    agentNode('reviewer_1', 'reviewer', 100, 200, { inputs: ['research_notes'] }),
    boundary(NODE_END, 100, 320),
  ];
  const edges = [
    edge(NODE_START, 'researcher_1'),
    edge('researcher_1', 'reviewer_1'),
    edge('reviewer_1', NODE_END, 'passed'),
    edge('reviewer_1', 'researcher_1', 'failed'),
  ];

  it('emits flow-level fields, slash config, and metadata positions', () => {
    const doc = yaml.load(graphToYaml(META, nodes, edges)) as Record<string, any>;
    expect(doc.api_name).toBe('research-pipeline');
    expect(doc.display_name).toBe('Research Pipeline');
    expect(doc.slash_api_name).toBe('research');
    expect(doc.exposed_as_slash).toBe(true);
    expect(doc.metadata.max_revisions).toBe(3);
    // Positions for every node including boundaries.
    expect(doc.metadata.positions.researcher_1).toEqual({ x: 100, y: 80 });
    expect(doc.metadata.positions.__start__).toEqual({ x: 0, y: 0 });
  });

  it('serialises inline agents (one per node) but skips boundary nodes', () => {
    const doc = yaml.load(graphToYaml(META, nodes, edges)) as Record<string, any>;
    const names = doc.agents.map((a: any) => a.api_name).sort();
    expect(names).toEqual(['researcher', 'reviewer']);
    expect(doc.flow.nodes).toHaveLength(2);
    expect(doc.flow.nodes.map((n: any) => n.node_id).sort()).toEqual([
      'researcher_1',
      'reviewer_1',
    ]);
  });

  it('omits default condition but keeps explicit ones; carries #26 slots', () => {
    const doc = yaml.load(graphToYaml(META, nodes, edges)) as Record<string, any>;
    const byPair = Object.fromEntries(
      doc.flow.edges.map((e: any) => [`${e.from}->${e.to}`, e.condition]),
    );
    expect(byPair['__start__->researcher_1']).toBeUndefined();
    expect(byPair['reviewer_1->__end__']).toBe('passed');
    expect(byPair['reviewer_1->researcher_1']).toBe('failed');
    const reviewer = doc.flow.nodes.find((n: any) => n.node_id === 'reviewer_1');
    expect(reviewer.inputs).toEqual(['research_notes']);
  });

  it('persists + restores per-side connector handles via metadata', () => {
    // A back-edge drawn left→left should keep its sides across a save +
    // reload so the hand-drawn routing doesn't snap back to defaults.
    const sideEdges = [
      edge(NODE_START, 'researcher_1'),
      { ...edge('reviewer_1', 'researcher_1', 'failed'), sourceHandle: 'left', targetHandle: 'left' },
    ];
    const doc = yaml.load(graphToYaml(META, nodes, sideEdges)) as Record<string, any>;
    expect(doc.metadata.edge_handles['reviewer_1|researcher_1']).toEqual({
      source: 'left',
      target: 'left',
    });
    // Round-trip back into the editor model.
    const rebuilt = buildEditorGraph(graphToYaml(META, nodes, sideEdges));
    const back = rebuilt.edges.find((e) => e.source === 'reviewer_1' && e.target === 'researcher_1');
    expect(back?.sourceHandle).toBe('left');
    expect(back?.targetHandle).toBe('left');
  });

  it('defaults edges to bottom→top when no handles are persisted (legacy flows)', () => {
    // A flow authored before per-side handles has no metadata.edge_handles.
    const legacyYaml = [
      'api_name: legacy',
      'display_name: Legacy',
      'agents:',
      '  - {api_name: a, display_name: A, user_model: m, system_prompt: x}',
      'flow:',
      '  nodes:',
      '    - {node_id: a, agent: a}',
      '  edges:',
      '    - {from: __start__, to: a}',
      '    - {from: a, to: __end__}',
    ].join('\n');
    const rebuilt = buildEditorGraph(legacyYaml);
    expect(rebuilt.edges).toHaveLength(2);
    for (const e of rebuilt.edges) {
      expect(e.sourceHandle).toBe('bottom');
      expect(e.targetHandle).toBe('top');
    }
  });

  it('collapses agent api_name onto node_id on load', () => {
    // Legacy YAML where node_id and agent name differ — the editor model
    // enforces agent.apiName === node_id (flow-local, 1-per-node).
    const yamlText = [
      'api_name: f',
      'display_name: F',
      'agents:',
      '  - {api_name: intake, display_name: Intake, user_model: m, system_prompt: x}',
      'flow:',
      '  nodes:',
      '    - {node_id: i1, agent: intake}',
    ].join('\n');
    const rebuilt = buildEditorGraph(yamlText);
    const node = rebuilt.nodes.find((n) => n.id === 'i1');
    expect((node!.data as any).agent.apiName).toBe('i1');
  });

  it('round-trips through yamlToGraph (node ids + edges preserved)', () => {
    const text = graphToYaml(META, nodes, edges);
    const graph = yamlToGraph(text);
    const ids = graph.nodes.map((n) => n.id).sort();
    expect(ids).toEqual(['__end__', '__start__', 'researcher_1', 'reviewer_1']);
    // 4 declared edges → 4 reactflow edges (no fan-in/out splitting here).
    expect(graph.edges).toHaveLength(4);
    const labels = graph.edges.map((e) => e.label).filter(Boolean).sort();
    expect(labels).toEqual(['failed', 'passed']);
  });
});
