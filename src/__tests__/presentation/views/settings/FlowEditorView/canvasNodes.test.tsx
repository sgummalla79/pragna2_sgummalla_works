/**
 * Render tests for the custom canvas node components (post-#33).
 *
 * The card is intentionally minimal: icon + type label + agent display
 * name. Model badge, emit chip, slot pill, and node-id are NOT shown on
 * the card anymore — they live in the NodePanel side drawer.
 *
 * We use a `ReactFlowProvider` because React Flow `Handle`s read from the
 * provider's store.
 */

import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ReactFlowProvider } from 'reactflow';

import { AgentNode, BoundaryNode } from '@/presentation/views/settings/FlowEditorView/canvasNodes';
import {
  type AgentNodeData,
  NODE_END,
  NODE_START,
  PORT_HANDLE_ELSE,
  portHandleFor,
} from '@/presentation/views/settings/FlowEditorView/editorTypes';

function renderInFlow(ui: React.ReactNode) {
  return render(<ReactFlowProvider>{ui}</ReactFlowProvider>);
}

function agentData(
  overrides: Partial<AgentNodeData['agent']> = {},
  node: Partial<AgentNodeData> = {},
): AgentNodeData {
  return {
    nodeId: 'researcher_1',
    agent: {
      apiName: 'researcher_1',
      displayName: 'Researcher',
      description: null,
      userModel: 'claude-sonnet-4-6',
      systemPrompt: '',
      tools: [],
      emits: [],
      ...overrides,
    },
    ...node,
  };
}

describe('AgentNode', () => {
  it('shows type label "Agent" + display name on the minimal card (emits empty)', () => {
    const { container } = renderInFlow(
      <AgentNode {...({ id: 'researcher_1', data: agentData(), selected: false } as any)} />,
    );
    expect(screen.getByText('Agent')).toBeInTheDocument();
    expect(screen.getByText('Researcher')).toBeInTheDocument();
    // The node-id, model badge, emit count, slot pill all disappear in
    // the minimal-card model — verify they're not rendered to lock the
    // contract.
    expect(screen.queryByText('researcher_1')).not.toBeInTheDocument();
    expect(screen.queryByText('claude-sonnet-4-6')).not.toBeInTheDocument();
    expect(screen.queryByText(/emits?$/i)).not.toBeInTheDocument();
    // The chat agent gets 4 omni handles (preserves back-edge routing).
    const handles = container.querySelectorAll('.react-flow__handle');
    expect(handles).toHaveLength(4);
  });

  it('renders as If/Else with N+1 right-side ports when emits is non-empty', () => {
    const { container } = renderInFlow(
      <AgentNode
        {...({
          id: 'r1',
          data: agentData({ emits: ['passed', 'failed'], displayName: 'Reviewer' }),
          selected: false,
        } as any)}
      />,
    );
    // Type label flips to "Decision" because the node is now branching.
    expect(screen.getByText('Decision')).toBeInTheDocument();
    expect(screen.getByText('Reviewer')).toBeInTheDocument();
    // 1 inbound target on the left + N+1 source ports on the right
    // (one per emit + a permanent `port:else`).
    const handles = container.querySelectorAll('.react-flow__handle');
    expect(handles).toHaveLength(1 + 2 + 1);
    // The port handle ids are the contract graphToYaml relies on.
    expect(container.querySelector(`[data-handleid="${portHandleFor('passed')}"]`)).toBeTruthy();
    expect(container.querySelector(`[data-handleid="${portHandleFor('failed')}"]`)).toBeTruthy();
    expect(container.querySelector(`[data-handleid="${PORT_HANDLE_ELSE}"]`)).toBeTruthy();
  });

  it('falls back to the api_name when display name is empty', () => {
    renderInFlow(
      <AgentNode
        {...({ id: 'x', data: agentData({ displayName: '' }), selected: false } as any)}
      />,
    );
    // api_name is researcher_1 by default in the fixture.
    expect(screen.getByText('researcher_1')).toBeInTheDocument();
  });
});

describe('BoundaryNode', () => {
  it('renders the Start label with a single right-side source handle', () => {
    const { container } = renderInFlow(
      <BoundaryNode {...({ id: NODE_START, data: { boundary: NODE_START } } as any)} />,
    );
    expect(screen.getByText('Start')).toBeInTheDocument();
    const handles = container.querySelectorAll('.react-flow__handle');
    expect(handles).toHaveLength(1);
    expect(container.querySelector('[data-handleid="out"]')).toBeTruthy();
  });

  it('renders the End label with a single left-side target handle', () => {
    const { container } = renderInFlow(
      <BoundaryNode {...({ id: NODE_END, data: { boundary: NODE_END } } as any)} />,
    );
    expect(screen.getByText('End')).toBeInTheDocument();
    const handles = container.querySelectorAll('.react-flow__handle');
    expect(handles).toHaveLength(1);
    expect(container.querySelector('[data-handleid="in"]')).toBeTruthy();
  });
});
