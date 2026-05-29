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

  it('onReconnect rewires endpoints but preserves id, condition, and other props', () => {
    // Author user reports: an edge from __start__ stuck on the bottom
    // handle can't be dragged to a side handle. Root cause: React Flow's
    // reconnect was never wired, so dragging an existing endpoint did
    // nothing. After wiring, onReconnect must (a) accept the new handle
    // ids, (b) keep the routing condition the user picked, (c) keep the
    // edge id stable (so any per-edge UI state doesn't get reset), and
    // (d) flip dirty so the new sides save to metadata.edge_handles.
    const a = store().addAgentNode({ x: 0, y: 0 });
    const b = store().addAgentNode({ x: 0, y: 100 });
    const c = store().addAgentNode({ x: 200, y: 100 });
    store().onConnect({ source: a, target: b, sourceHandle: 'bottom', targetHandle: 'top' });
    const original = store().edges[0];
    // The author picks a non-default condition on the edge.
    store().setEdgeCondition(original.id, EDGE_CONDITIONS.PASSED);
    store().markClean();
    expect(store().dirty).toBe(false);

    // Author drags the source endpoint from a:bottom to a:right.
    store().onReconnect(store().edges[0], {
      source: a,
      target: b,
      sourceHandle: 'right',
      targetHandle: 'top',
    });

    let updated = store().edges[0];
    expect(updated.id).toBe(original.id); // id stable
    expect(updated.sourceHandle).toBe('right'); // new handle taken
    expect(updated.data?.condition).toBe(EDGE_CONDITIONS.PASSED); // condition kept
    expect(store().dirty).toBe(true); // saves to edge_handles on next save

    // Author drops the target endpoint onto a different node (b → c).
    store().onReconnect(store().edges[0], {
      source: a,
      target: c,
      sourceHandle: 'right',
      targetHandle: 'left',
    });

    updated = store().edges[0];
    expect(updated.target).toBe(c);
    expect(updated.targetHandle).toBe('left');
    expect(updated.data?.condition).toBe(EDGE_CONDITIONS.PASSED);
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

  describe('#35 — edge selection + dispatch field updates', () => {
    it('selectEdge sets selectedEdgeId and clears selectedNodeId', () => {
      const a = store().addAgentNode({ x: 0, y: 0 });
      const b = store().addAgentNode({ x: 0, y: 100 });
      store().onConnect({ source: a, target: b, sourceHandle: null, targetHandle: null });
      const edgeId = store().edges[0].id;

      // A node is currently selected (addAgentNode auto-selects).
      expect(store().selectedNodeId).toBe(b);

      store().selectEdge(edgeId);
      expect(store().selectedEdgeId).toBe(edgeId);
      // Mutual exclusion: selecting an edge clears node selection.
      expect(store().selectedNodeId).toBe(null);
    });

    it('selectNode after selectEdge clears the edge selection', () => {
      const a = store().addAgentNode({ x: 0, y: 0 });
      const b = store().addAgentNode({ x: 0, y: 100 });
      store().onConnect({ source: a, target: b, sourceHandle: null, targetHandle: null });
      store().selectEdge(store().edges[0].id);
      expect(store().selectedEdgeId).not.toBeNull();

      store().selectNode(a);
      expect(store().selectedNodeId).toBe(a);
      expect(store().selectedEdgeId).toBe(null);
    });

    it('updateEdgeData sets dispatch fields together and marks dirty', () => {
      const a = store().addAgentNode({ x: 0, y: 0 });
      const b = store().addAgentNode({ x: 0, y: 100 });
      store().onConnect({ source: a, target: b, sourceHandle: null, targetHandle: null });
      const edgeId = store().edges[0].id;
      store().markClean();

      store().updateEdgeData(edgeId, {
        dispatchMode: 'per_item',
        itemsSlot: 'raw_claims',
        itemSlot: 'claim_to_verify',
      });

      const updated = store().edges[0].data;
      expect(updated?.dispatchMode).toBe('per_item');
      expect(updated?.itemsSlot).toBe('raw_claims');
      expect(updated?.itemSlot).toBe('claim_to_verify');
      // Condition still default — patch is shallow merge, doesn't clobber.
      expect(updated?.condition).toBe(EDGE_CONDITIONS.DEFAULT);
      expect(store().dirty).toBe(true);
    });

    it('updateEdgeData with undefined keys clears them (turn dispatch off)', () => {
      const a = store().addAgentNode({ x: 0, y: 0 });
      const b = store().addAgentNode({ x: 0, y: 100 });
      store().onConnect({ source: a, target: b, sourceHandle: null, targetHandle: null });
      const edgeId = store().edges[0].id;
      store().updateEdgeData(edgeId, {
        dispatchMode: 'per_item',
        itemsSlot: 'raw_claims',
        itemSlot: 'claim_to_verify',
      });

      // All three set initially.
      expect(store().edges[0].data?.dispatchMode).toBe('per_item');

      // Author toggles dispatch off — all three cleared together.
      store().updateEdgeData(edgeId, {
        dispatchMode: undefined,
        itemsSlot: undefined,
        itemSlot: undefined,
      });

      const cleared = store().edges[0].data;
      expect(cleared?.dispatchMode).toBeUndefined();
      expect(cleared?.itemsSlot).toBeUndefined();
      expect(cleared?.itemSlot).toBeUndefined();
      // Condition survives the clear — the all-or-none invariant only
      // covers the three dispatch keys, not the routing condition.
      expect(cleared?.condition).toBe(EDGE_CONDITIONS.DEFAULT);
    });

    it('deleteEdge clears selectedEdgeId when the deleted edge was selected', () => {
      const a = store().addAgentNode({ x: 0, y: 0 });
      const b = store().addAgentNode({ x: 0, y: 100 });
      store().onConnect({ source: a, target: b, sourceHandle: null, targetHandle: null });
      const edgeId = store().edges[0].id;
      store().selectEdge(edgeId);

      store().deleteEdge(edgeId);
      expect(store().edges).toHaveLength(0);
      expect(store().selectedEdgeId).toBe(null);
    });
  });
});
