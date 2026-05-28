import { describe, expect, it } from 'vitest';
import type { Edge } from 'reactflow';

import { isValidFlowConnection } from '@/presentation/views/settings/FlowEditorView/connectionRules';
import { NODE_END, NODE_START } from '@/presentation/views/settings/FlowEditorView/editorTypes';

const conn = (source: string | null, target: string | null) => ({
  source,
  target,
  sourceHandle: null,
  targetHandle: null,
});

describe('isValidFlowConnection', () => {
  const edges: Edge[] = [{ id: 'e1', source: 'a', target: 'b' }];

  it('allows a normal new connection', () => {
    expect(isValidFlowConnection(edges, conn('a', 'c'))).toBe(true);
  });

  it('rejects self-loops', () => {
    expect(isValidFlowConnection(edges, conn('a', 'a'))).toBe(false);
  });

  it('rejects connecting INTO __start__', () => {
    expect(isValidFlowConnection(edges, conn('a', NODE_START))).toBe(false);
  });

  it('rejects connecting OUT OF __end__', () => {
    expect(isValidFlowConnection(edges, conn(NODE_END, 'a'))).toBe(false);
  });

  it('rejects a duplicate source→target', () => {
    expect(isValidFlowConnection(edges, conn('a', 'b'))).toBe(false);
  });

  it('rejects incomplete connections', () => {
    expect(isValidFlowConnection(edges, conn(null, 'b'))).toBe(false);
    expect(isValidFlowConnection(edges, conn('a', null))).toBe(false);
  });

  it('allows __start__ → node and node → __end__', () => {
    expect(isValidFlowConnection(edges, conn(NODE_START, 'a'))).toBe(true);
    expect(isValidFlowConnection(edges, conn('b', NODE_END))).toBe(true);
  });

  it('excludeEdgeId skips one edge in the duplicate check', () => {
    // Reproduces the reconnect snap-back: the author drags the endpoint
    // of edge 'e1' (a→b) onto a different handle on b. The new connection
    // is still a→b, which COLLIDES with the still-present old edge e1.
    // Without an exclusion, validation rejects and React Flow snaps the
    // endpoint back. Passing e1's id excludes it, so the same pair is
    // allowed — onReconnect then rewrites e1 in place.
    expect(isValidFlowConnection(edges, conn('a', 'b'), 'e1')).toBe(true);

    // Sanity: excluding a DIFFERENT edge id doesn't accidentally allow
    // a true duplicate against e1.
    expect(isValidFlowConnection(edges, conn('a', 'b'), 'e-other')).toBe(false);

    // Other rules still apply even when an id is excluded.
    expect(isValidFlowConnection(edges, conn('a', 'a'), 'e1')).toBe(false);
    expect(isValidFlowConnection(edges, conn('a', NODE_START), 'e1')).toBe(false);
  });
});
