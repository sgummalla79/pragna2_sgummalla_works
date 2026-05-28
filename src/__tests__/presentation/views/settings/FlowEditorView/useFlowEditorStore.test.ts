import { beforeEach, describe, expect, it } from 'vitest';

import { useFlowEditorStore } from '@/presentation/views/settings/FlowEditorView/useFlowEditorStore';
import {
  type AgentNodeData,
  NODE_TYPE_AGENT,
} from '@/presentation/views/settings/FlowEditorView/editorTypes';
import { EDGE_CONDITIONS } from '@/constants/edgeConditions';

const store = () => useFlowEditorStore.getState();

describe('useFlowEditorStore', () => {
  beforeEach(() => {
    store().reset();
  });

  it('reset starts clean and not dirty', () => {
    expect(store().nodes).toHaveLength(0);
    expect(store().edges).toHaveLength(0);
    expect(store().dirty).toBe(false);
  });

  it('addAgentNode appends an agent node, selects it, marks dirty', () => {
    const id = store().addAgentNode({ x: 10, y: 20 });
    const s = store();
    expect(s.nodes).toHaveLength(1);
    expect(s.nodes[0].type).toBe(NODE_TYPE_AGENT);
    expect((s.nodes[0].data as AgentNodeData).nodeId).toBe(id);
    expect(s.selectedNodeId).toBe(id);
    expect(s.dirty).toBe(true);
  });

  it('onConnect adds an edge and dedupes identical source→target', () => {
    const a = store().addAgentNode({ x: 0, y: 0 });
    const b = store().addAgentNode({ x: 0, y: 100 });
    store().onConnect({ source: a, target: b, sourceHandle: null, targetHandle: null });
    store().onConnect({ source: a, target: b, sourceHandle: null, targetHandle: null });
    expect(store().edges).toHaveLength(1);
    expect(store().edges[0].data?.condition).toBe(EDGE_CONDITIONS.DEFAULT);
  });

  it('deleteNode removes the node and any edges touching it', () => {
    const a = store().addAgentNode({ x: 0, y: 0 });
    const b = store().addAgentNode({ x: 0, y: 100 });
    store().onConnect({ source: a, target: b, sourceHandle: null, targetHandle: null });
    store().deleteNode(a);
    expect(store().nodes.map((n) => n.id)).toEqual([b]);
    expect(store().edges).toHaveLength(0);
  });

  it('renaming a node_id rewires edges, node id, AND the agent api_name', () => {
    const a = store().addAgentNode({ x: 0, y: 0 });
    const b = store().addAgentNode({ x: 0, y: 100 });
    store().onConnect({ source: a, target: b, sourceHandle: null, targetHandle: null });
    store().updateNode(a, { nodeId: 'researcher_1' });
    const s = store();
    expect(s.nodes.some((n) => n.id === 'researcher_1')).toBe(true);
    expect(s.nodes.some((n) => n.id === a)).toBe(false);
    expect(s.edges[0].source).toBe('researcher_1');
    expect(s.edges[0].target).toBe(b);
    // Collapse invariant: agent api_name tracks the node_id.
    const renamed = s.nodes.find((n) => n.id === 'researcher_1');
    expect((renamed!.data as AgentNodeData).agent.apiName).toBe('researcher_1');
  });

  it('updateAgent patches the inline agent on the node', () => {
    const a = store().addAgentNode({ x: 0, y: 0 });
    store().updateAgent(a, { userModel: 'claude-sonnet-4-6', emits: ['passed'] });
    const data = store().nodes[0].data as AgentNodeData;
    expect(data.agent.userModel).toBe('claude-sonnet-4-6');
    expect(data.agent.emits).toEqual(['passed']);
  });

  it('hydrate replaces the model and clears dirty', () => {
    store().addAgentNode({ x: 0, y: 0 });
    expect(store().dirty).toBe(true);
    store().hydrate({
      meta: {
        apiName: 'f',
        displayName: 'F',
        description: null,
        slashApiName: null,
        exposedAsSlash: false,
        metadata: {},
      },
      nodes: [],
      edges: [],
    });
    expect(store().nodes).toHaveLength(0);
    expect(store().dirty).toBe(false);
    expect(store().meta.apiName).toBe('f');
  });
});
