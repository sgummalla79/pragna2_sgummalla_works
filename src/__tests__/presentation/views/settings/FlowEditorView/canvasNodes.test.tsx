/**
 * Render tests for the custom canvas node components. They use React
 * Flow `Handle`s, so we wrap in a `ReactFlowProvider` (which supplies the
 * store the handles read). We assert the visible content — node label,
 * agent display name, model badge / "no model", emit + slot chips, and
 * the Start/End boundary labels.
 */

import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ReactFlowProvider } from 'reactflow';

import { AgentNode, BoundaryNode } from '@/presentation/views/settings/FlowEditorView/canvasNodes';
import {
  type AgentNodeData,
  NODE_END,
  NODE_START,
} from '@/presentation/views/settings/FlowEditorView/editorTypes';

function renderInFlow(ui: React.ReactNode) {
  return render(<ReactFlowProvider>{ui}</ReactFlowProvider>);
}

function agentData(overrides: Partial<AgentNodeData['agent']> = {}, node: Partial<AgentNodeData> = {}): AgentNodeData {
  return {
    nodeId: 'researcher_1',
    agent: {
      apiName: 'researcher_1',
      displayName: 'Researcher',
      description: null,
      userModel: 'claude-sonnet-4-6',
      systemPrompt: '',
      tools: [],
      emits: ['passed', 'failed'],
      ...overrides,
    },
    ...node,
  };
}

describe('AgentNode', () => {
  it('shows node id, agent display name, model and emit chips', () => {
    // NodeProps has many required fields the component ignores; cast.
    renderInFlow(
      <AgentNode {...({ id: 'researcher_1', data: agentData(), selected: false } as any)} />,
    );
    expect(screen.getByText('researcher_1')).toBeInTheDocument();
    expect(screen.getByText('Researcher')).toBeInTheDocument();
    expect(screen.getByText('claude-sonnet-4-6')).toBeInTheDocument();
    expect(screen.getByText(/2 emits/)).toBeInTheDocument();
  });

  it('flags a missing model with a "no model" badge', () => {
    renderInFlow(
      <AgentNode {...({ id: 'x', data: agentData({ userModel: '' }), selected: false } as any)} />,
    );
    expect(screen.getByText('no model')).toBeInTheDocument();
  });

  it('shows a slots chip when context slots are declared', () => {
    renderInFlow(
      <AgentNode
        {...({
          id: 'x',
          data: agentData({}, { inputs: ['research_notes'] }),
          selected: false,
        } as any)}
      />,
    );
    expect(screen.getByText('slots')).toBeInTheDocument();
  });
});

describe('BoundaryNode', () => {
  it('renders the Start label', () => {
    renderInFlow(<BoundaryNode {...({ id: NODE_START, data: { boundary: NODE_START } } as any)} />);
    expect(screen.getByText(/Start/)).toBeInTheDocument();
  });

  it('renders the End label', () => {
    renderInFlow(<BoundaryNode {...({ id: NODE_END, data: { boundary: NODE_END } } as any)} />);
    expect(screen.getByText(/End/)).toBeInTheDocument();
  });
});
