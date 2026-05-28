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
});
