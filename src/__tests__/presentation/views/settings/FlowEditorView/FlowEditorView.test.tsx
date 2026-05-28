/**
 * Shell mount test for the visual flow editor. Renders the real
 * component (incl. the React Flow canvas) inside the router + service +
 * query providers and verifies the toolbar, the flow-meta form, and the
 * "Add node → node panel opens" path. Canvas node geometry isn't
 * asserted (React Flow can't measure in jsdom) — the store + node/panel
 * rendering are covered by the sibling tests.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

vi.mock('@/presentation/hooks/models/useModels', () => ({
  useModels: () => ({ data: [] }),
}));
vi.mock('@/presentation/components/settings/ToolPicker/ToolPicker', () => ({
  ToolPicker: () => <div data-testid="tool-picker" />,
}));
vi.mock('@/presentation/components/ui/Select', () => ({
  Select: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SelectTrigger: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SelectContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SelectItem: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SelectValue: ({ placeholder }: { placeholder?: string }) => <span>{placeholder}</span>,
}));

import FlowEditorView from '@/presentation/views/settings/FlowEditorView/FlowEditorView';
import { ServiceContext, type Services } from '@/presentation/providers/ServiceContext';
import { useFlowEditorStore } from '@/presentation/views/settings/FlowEditorView/useFlowEditorStore';

const services = {
  flowService: {
    get: vi.fn(),
    saveFromYaml: vi.fn(),
    saveFromYamlById: vi.fn(),
    validateYaml: vi.fn(),
  },
} as unknown as Services;

function renderEditor() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <ServiceContext.Provider value={services}>
        <MemoryRouter initialEntries={['/settings/flows/new']}>
          <Routes>
            <Route path="/settings/flows/new" element={<FlowEditorView />} />
            <Route path="/settings/flows/:flowId/edit" element={<FlowEditorView />} />
          </Routes>
        </MemoryRouter>
      </ServiceContext.Provider>
    </QueryClientProvider>,
  );
}

describe('FlowEditorView (shell)', () => {
  beforeEach(() => {
    useFlowEditorStore.getState().reset();
  });

  it('renders the toolbar + flow-meta form for a new flow', () => {
    renderEditor();
    expect(screen.getByRole('button', { name: /add node/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /validate/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /save/i })).toBeInTheDocument();
    expect(screen.getByLabelText('Display name')).toBeInTheDocument();
    expect(screen.getByLabelText('API name')).toBeInTheDocument();
    // New flow seeds Start + End boundary nodes into the store.
    const ids = useFlowEditorStore.getState().nodes.map((n) => n.id).sort();
    expect(ids).toEqual(['__end__', '__start__']);
  });

  it('Add node adds an agent node to the store and opens the node panel', () => {
    renderEditor();
    fireEvent.click(screen.getByRole('button', { name: /add node/i }));
    const agentNodes = useFlowEditorStore.getState().nodes.filter((n) => n.type === 'agent');
    expect(agentNodes).toHaveLength(1);
    // Panel opens on the new node → its Node id field appears.
    expect(screen.getByLabelText('Node id')).toBeInTheDocument();
  });

  it('Save is disabled until there are unsaved changes', () => {
    renderEditor();
    expect(screen.getByRole('button', { name: /^save$/i })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: /add node/i }));
    expect(screen.getByRole('button', { name: /^save$/i })).toBeEnabled();
  });

  it('YAML button opens the read-only source dialog', () => {
    renderEditor();
    fireEvent.click(screen.getByRole('button', { name: /view yaml source/i }));
    expect(screen.getByText(/Flow YAML \(read-only\)/i)).toBeInTheDocument();
  });
});
