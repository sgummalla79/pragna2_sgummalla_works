/**
 * Integration test for the full visual-authoring path at the model
 * level: drive the REAL editor store the way the canvas does (seed a new
 * flow, add nodes, rename them, edit their agents, draw + condition
 * edges) and assert the serialized YAML the Save button would POST.
 *
 * This exercises store + graphToYaml together — the same code the UI
 * runs — without needing the React Flow DOM.
 */

import { beforeEach, describe, expect, it } from 'vitest';
import yaml from 'js-yaml';

import { useFlowEditorStore } from '@/presentation/views/settings/FlowEditorView/useFlowEditorStore';
import { graphToYaml } from '@/presentation/views/settings/FlowEditorView/graphToYaml';
import { newFlowGraph, NODE_END, NODE_START } from '@/presentation/views/settings/FlowEditorView/editorTypes';
import { EDGE_CONDITIONS } from '@/constants/edgeConditions';

const store = () => useFlowEditorStore.getState();
const connect = (source: string, target: string) =>
  store().onConnect({ source, target, sourceHandle: 'bottom', targetHandle: 'top' });

describe('visual flow authoring → YAML (integration)', () => {
  beforeEach(() => {
    store().reset();
    store().hydrate(newFlowGraph()); // Start/End boundaries + slash-on defaults
  });

  it('builds a two-node review loop and serializes valid YAML', () => {
    // Add + name two agent nodes.
    const n1 = store().addAgentNode({ x: 250, y: 140 });
    store().updateNode(n1, { nodeId: 'researcher_1' });
    store().updateAgent('researcher_1', {
      displayName: 'Researcher',
      userModel: 'claude-sonnet-4-6',
      systemPrompt: 'You are a careful researcher.',
    });

    const n2 = store().addAgentNode({ x: 250, y: 260 });
    store().updateNode(n2, { nodeId: 'reviewer_1' });
    store().updateAgent('reviewer_1', {
      displayName: 'Reviewer',
      userModel: 'claude-sonnet-4-6',
      systemPrompt: 'Quality-check the draft.',
      emits: ['passed', 'failed'],
    });

    // Wire the topology, including a back-edge.
    connect(NODE_START, 'researcher_1');
    connect('researcher_1', 'reviewer_1');
    connect('reviewer_1', NODE_END);
    connect('reviewer_1', 'researcher_1');

    // Condition the two reviewer edges.
    const toEnd = store().edges.find((e) => e.source === 'reviewer_1' && e.target === NODE_END)!;
    const toLoop = store().edges.find((e) => e.source === 'reviewer_1' && e.target === 'researcher_1')!;
    store().setEdgeCondition(toEnd.id, EDGE_CONDITIONS.PASSED);
    store().setEdgeCondition(toLoop.id, EDGE_CONDITIONS.FAILED);

    // Serialize exactly what Save would POST.
    const doc = yaml.load(graphToYaml(store().meta, store().nodes, store().edges)) as Record<string, any>;

    // Flow-level fields (newFlowGraph defaults).
    expect(doc.api_name).toBe('my-flow');
    expect(doc.exposed_as_slash).toBe(true);

    // Agents: one per node, api_name collapsed onto node_id.
    expect(doc.agents.map((a: any) => a.api_name).sort()).toEqual(['researcher_1', 'reviewer_1']);
    const reviewer = doc.agents.find((a: any) => a.api_name === 'reviewer_1');
    expect(reviewer.user_model).toBe('claude-sonnet-4-6');
    expect(reviewer.emits).toEqual(['passed', 'failed']);

    // Nodes reference their own agent.
    expect(doc.flow.nodes.map((n: any) => n.node_id).sort()).toEqual(['researcher_1', 'reviewer_1']);
    expect(doc.flow.nodes.every((n: any) => n.agent === n.node_id)).toBe(true);

    // Edges: 4 total; conditions on the reviewer branches; default elsewhere.
    const byPair = Object.fromEntries(
      doc.flow.edges.map((e: any) => [`${e.from}->${e.to}`, e.condition]),
    );
    expect(byPair['__start__->researcher_1']).toBeUndefined(); // default omitted
    expect(byPair['researcher_1->reviewer_1']).toBeUndefined();
    expect(byPair['reviewer_1->__end__']).toBe('passed');
    expect(byPair['reviewer_1->researcher_1']).toBe('failed');

    // Positions persisted for every node (incl. boundaries).
    expect(doc.metadata.positions.researcher_1).toEqual({ x: 250, y: 140 });
    expect(doc.metadata.positions.__start__).toBeTruthy();
  });

  it('deleting a node removes it AND its connected edges', () => {
    const n1 = store().addAgentNode({ x: 0, y: 100 });
    store().updateNode(n1, { nodeId: 'a' });
    connect(NODE_START, 'a');
    connect('a', NODE_END);
    expect(store().edges).toHaveLength(2);

    store().deleteNode('a');
    expect(store().nodes.some((n) => n.id === 'a')).toBe(false);
    // Both edges touching 'a' are gone; only boundaries remain, unconnected.
    expect(store().edges).toHaveLength(0);
  });
});
