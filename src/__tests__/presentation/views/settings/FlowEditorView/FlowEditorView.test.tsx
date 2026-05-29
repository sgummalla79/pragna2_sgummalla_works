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

  it('renders the toolbar + flow-meta form + palette for a new flow', () => {
    renderEditor();
    // Toolbar buttons remain (Add-node was REMOVED post-#33 — its job
    // moved to the left-side palette panel, which lists Agent / If/Else
    // / End. Start is auto-placed by newFlowGraph().)
    expect(screen.getByRole('button', { name: /validate/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /save/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /add node/i })).not.toBeInTheDocument();
    // Palette: 3 click-to-add entries.
    expect(screen.getByRole('button', { name: /^Agent$/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Decision$/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^End$/i })).toBeInTheDocument();
    // Meta inputs (label dropped in favour of placeholder + aria-label).
    expect(screen.getByLabelText('Display name')).toBeInTheDocument();
    expect(screen.getByLabelText('API Name')).toBeInTheDocument();
    // New flow seeds ONLY Start. End nodes are added by the author from
    // the palette — keeping the canvas empty otherwise lets validate +
    // save surface "no terminal node" as a structured YAML error.
    const ids = useFlowEditorStore.getState().nodes.map((n) => n.id).sort();
    expect(ids).toEqual(['__start__']);
  });

  it('clicking the palette Agent entry adds a node and opens the node panel', () => {
    renderEditor();
    fireEvent.click(screen.getByRole('button', { name: /^Agent$/i }));
    const agentNodes = useFlowEditorStore.getState().nodes.filter((n) => n.type === 'agent');
    expect(agentNodes).toHaveLength(1);
    // The dropped node has emits=[] (chat agent), so the NodePanel
    // opens on the new node — its Agent id field is the panel's first
    // input. getByLabelText resolves the aria-label.
    expect(screen.getByLabelText('Agent')).toBeInTheDocument();
  });

  it('clicking the palette If/Else entry adds a node preset with emits=[passed,failed]', () => {
    renderEditor();
    fireEvent.click(screen.getByRole('button', { name: /^Decision$/i }));
    const agentNodes = useFlowEditorStore.getState().nodes.filter((n) => n.type === 'agent');
    expect(agentNodes).toHaveLength(1);
    expect((agentNodes[0].data as any).agent.emits).toEqual(['passed', 'failed']);
    expect((agentNodes[0].data as any).agent.displayName).toBe('Decision');
  });

  it('clicking the palette End entry adds an End boundary', () => {
    renderEditor();
    fireEvent.click(screen.getByRole('button', { name: /^End$/i }));
    const endNodes = useFlowEditorStore
      .getState()
      .nodes.filter((n) => n.type === 'boundary' && (n.data as any).boundary === '__end__');
    // New flow seeds zero End nodes; clicking palette End adds the first.
    expect(endNodes).toHaveLength(1);
    // First End palette drop gets the canonical `__end__` id (no `::n`
    // suffix); subsequent ones get `__end__::2`, `__end__::3`, etc.
    expect(endNodes.map((n) => n.id)).toEqual(['__end__']);
  });

  it('Save is disabled until there are unsaved changes', () => {
    renderEditor();
    expect(screen.getByRole('button', { name: /^save$/i })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: /^Agent$/i }));
    expect(screen.getByRole('button', { name: /^save$/i })).toBeEnabled();
  });

  it('YAML button opens the read-only source dialog', () => {
    renderEditor();
    fireEvent.click(screen.getByRole('button', { name: /view yaml source/i }));
    expect(screen.getByText(/Flow YAML \(read-only\)/i)).toBeInTheDocument();
  });
});
