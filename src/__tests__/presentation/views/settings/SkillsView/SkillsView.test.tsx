import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import SkillsView from '@/presentation/views/settings/SkillsView/SkillsView';
import {
  ServiceContext,
  type Services,
} from '@/presentation/providers/ServiceContext';

function renderView(opts: {
  createImpl?: (payload: {
    name: string;
    description: string;
    skillType: string;
    userModelId?: string;
  }) => Promise<unknown>;
} = {}) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const create = vi.fn(
    opts.createImpl ??
      ((_payload) =>
        Promise.resolve({
          id: 'skill-1',
          name: _payload.name,
          description: _payload.description,
          skillType: 'agent',
          userModelId: null,
        })),
  );
  // Pre-seed list query so the empty-state path doesn't dominate the
  // tree — we want to focus on the create-form rendering.
  qc.setQueryData(['skills'], []);
  qc.setQueryData(['models'], []);

  const services = {
    skillService: {
      list: () => Promise.resolve([]),
      create,
      delete: vi.fn(),
    },
    modelService: { list: () => Promise.resolve([]) },
  } as unknown as Services;

  const utils = render(
    <QueryClientProvider client={qc}>
      <ServiceContext.Provider value={services}>
        <SkillsView />
      </ServiceContext.Provider>
    </QueryClientProvider>,
  );
  return { ...utils, create };
}

describe('SkillsView — cleanup-disable-function-skills', () => {
  it('does not render the skill-type picker', () => {
    renderView();
    fireEvent.click(screen.getByRole('button', { name: /new skill/i }));
    // The dropdown is gone — no label "Type" or option labels visible.
    expect(screen.queryByLabelText(/^type$/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/^function$/i)).not.toBeInTheDocument();
  });

  it('always submits skillType=agent (no user choice)', async () => {
    const { create } = renderView();
    fireEvent.click(screen.getByRole('button', { name: /new skill/i }));
    fireEvent.change(screen.getByLabelText(/slash command name/i), {
      target: { value: 'research' },
    });
    fireEvent.change(screen.getByLabelText(/description/i), {
      target: { value: 'Run the research pipeline.' },
    });
    fireEvent.click(screen.getByRole('button', { name: /create skill/i }));

    await waitFor(() => {
      expect(create).toHaveBeenCalledTimes(1);
      const payload = create.mock.calls[0][0];
      expect(payload.skillType).toBe('agent');
      expect(payload.name).toBe('research');
      expect(payload.description).toBe('Run the research pipeline.');
    });
  });

  it('keeps required-field gating intact (Create disabled until name + description)', () => {
    renderView();
    fireEvent.click(screen.getByRole('button', { name: /new skill/i }));
    const createBtn = screen.getByRole('button', { name: /create skill/i });
    expect(createBtn).toBeDisabled();

    fireEvent.change(screen.getByLabelText(/slash command name/i), {
      target: { value: 'research' },
    });
    // Name only → still disabled (description missing).
    expect(createBtn).toBeDisabled();

    fireEvent.change(screen.getByLabelText(/description/i), {
      target: { value: 'Run the research pipeline.' },
    });
    expect(createBtn).not.toBeDisabled();
  });
});
