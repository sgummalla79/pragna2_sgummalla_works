/**
 * Render + interaction tests for the flow-editor node panel.
 *
 * The panel is a plain form over the Zustand editor store (no React
 * Flow), so it mounts cleanly in jsdom. We mock the data hooks it pulls
 * (models list, ToolPicker) and drive the REAL store, asserting the
 * collapse invariant (agent api_name = node_id) and the node_id
 * uniqueness / reserved-id guards surface as inline errors.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import type { Node } from 'reactflow';

// Flow-eligible model list for the model <Select>.
vi.mock('@/presentation/hooks/models/useModels', () => ({
  useModels: () => ({
    data: [
      {
        id: 'm1',
        modelName: 'claude-sonnet-4-6',
        displayName: 'Claude Sonnet 4.6',
        enabled: true,
        archived: false,
        availableForFlows: true,
      },
    ],
  }),
}));

// ToolPicker pulls the tools service — stub it; it's not under test here.
vi.mock('@/presentation/components/settings/ToolPicker/ToolPicker', () => ({
  ToolPicker: ({ values }: { values: string[] }) => (
    <div data-testid="tool-picker">{values.join(',')}</div>
  ),
}));

// Radix Select infinite-loops under jsdom (compose-refs measurement);
// stub it to plain passthroughs — model selection isn't under test here.
vi.mock('@/presentation/components/ui/Select', () => ({
  Select: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SelectTrigger: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SelectContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SelectItem: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SelectValue: ({ placeholder }: { placeholder?: string }) => <span>{placeholder}</span>,
}));

import { NodePanel } from '@/presentation/views/settings/FlowEditorView/NodePanel';
import { useFlowEditorStore } from '@/presentation/views/settings/FlowEditorView/useFlowEditorStore';
import {
  type AgentNodeData,
  NODE_TYPE_AGENT,
} from '@/presentation/views/settings/FlowEditorView/editorTypes';

function agentNode(id: string, agentOverrides: Partial<AgentNodeData['agent']> = {}): Node<AgentNodeData> {
  return {
    id,
    type: NODE_TYPE_AGENT,
    position: { x: 0, y: 0 },
    data: {
      nodeId: id,
      agent: {
        apiName: id,
        displayName: id,
        description: null,
        userModel: '',
        systemPrompt: '',
        tools: [],
        emits: [],
        ...agentOverrides,
      },
    },
  };
}

const store = () => useFlowEditorStore.getState();

function seedAndSelect(selected = 'researcher_1') {
  store().hydrate({
    meta: {
      apiName: 'f',
      displayName: 'F',
      description: null,
      slashApiName: null,
      exposedAsSlash: false,
      metadata: {},
    },
    nodes: [
      agentNode('researcher_1', { displayName: 'Researcher', emits: ['passed'] }),
      agentNode('reviewer_1', { displayName: 'Reviewer' }),
    ],
    edges: [],
  });
  store().selectNode(selected);
}

describe('NodePanel', () => {
  beforeEach(() => {
    store().reset();
    seedAndSelect();
  });

  it('renders the selected node + agent fields', () => {
    render(<NodePanel />);
    expect((screen.getByLabelText('Node id') as HTMLInputElement).value).toBe('researcher_1');
    expect((screen.getByLabelText('Display name') as HTMLInputElement).value).toBe('Researcher');
  });

  it('editing display name updates the store agent', () => {
    render(<NodePanel />);
    fireEvent.change(screen.getByLabelText('Display name'), { target: { value: 'Lead Researcher' } });
    const node = store().nodes.find((n) => n.id === 'researcher_1');
    expect((node!.data as AgentNodeData).agent.displayName).toBe('Lead Researcher');
  });

  it('a unique node_id rename applies and drags the agent api_name with it', () => {
    render(<NodePanel />);
    const input = screen.getByLabelText('Node id');
    fireEvent.change(input, { target: { value: 'analyst' } });
    fireEvent.blur(input);
    const node = store().nodes.find((n) => n.id === 'analyst');
    expect(node).toBeTruthy();
    expect((node!.data as AgentNodeData).agent.apiName).toBe('analyst');
    expect(store().nodes.some((n) => n.id === 'researcher_1')).toBe(false);
  });

  it('rejects a duplicate node_id with an inline error and no store change', () => {
    render(<NodePanel />);
    const input = screen.getByLabelText('Node id');
    fireEvent.change(input, { target: { value: 'reviewer_1' } });
    fireEvent.blur(input);
    expect(screen.getByRole('alert')).toHaveTextContent(/already uses/i);
    // Store untouched — the original node id survives, no second 'reviewer_1'.
    expect(store().nodes.some((n) => n.id === 'researcher_1')).toBe(true);
    expect(store().nodes.filter((n) => n.id === 'reviewer_1')).toHaveLength(1);
  });

  it('rejects a reserved boundary id', () => {
    render(<NodePanel />);
    const input = screen.getByLabelText('Node id');
    fireEvent.change(input, { target: { value: '__start__' } });
    fireEvent.blur(input);
    expect(screen.getByRole('alert')).toHaveTextContent(/reserved/i);
    expect(store().nodes.some((n) => n.id === 'researcher_1')).toBe(true);
  });

  it('deletes the node', () => {
    render(<NodePanel />);
    fireEvent.click(screen.getByRole('button', { name: /delete node/i }));
    expect(store().nodes.some((n) => n.id === 'researcher_1')).toBe(false);
  });

  it('closes the panel', () => {
    render(<NodePanel />);
    fireEvent.click(screen.getByRole('button', { name: /close panel/i }));
    expect(store().selectedNodeId).toBeNull();
  });
});
