import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AgentPicker } from '@/presentation/views/chat/components/AgentPicker';
import {
  ServiceContext,
  type Services,
} from '@/presentation/providers/ServiceContext';
import type { PragnaAgent } from '@/domain/types/agent.types';

function makeServices(agents: PragnaAgent[]): Services {
  return {
    agentService: {
      list: vi.fn().mockResolvedValue(agents),
    },
  } as unknown as Services;
}

/** Sentinel route that exposes the current pathname + search to assertions. */
function LocationProbe() {
  const location = useLocation();
  return (
    <div data-testid="probe">
      {location.pathname}
      {location.search}
    </div>
  );
}

function renderPicker(opts: {
  value: string;
  agents: PragnaAgent[];
  initialPath?: string;
}) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={qc}>
      <ServiceContext.Provider value={makeServices(opts.agents)}>
        <MemoryRouter initialEntries={[opts.initialPath ?? '/chat/c-1']}>
          <Routes>
            <Route path="/chat/:id" element={<AgentPicker value={opts.value} />} />
            <Route path="/chat" element={<LocationProbe />} />
          </Routes>
        </MemoryRouter>
      </ServiceContext.Provider>
    </QueryClientProvider>,
  );
}

describe('AgentPicker', () => {
  it('renders as inert text when only the default agent is available', async () => {
    renderPicker({
      value: 'default',
      agents: [{ name: 'default', description: 'Free chat' }],
    });

    // Wait one frame for useAgents to resolve.
    await screen.findByText('default');
    // The picker collapses to a plain label — no dropdown trigger button.
    expect(
      screen.queryByRole('button', { name: /switch agent/i }),
    ).not.toBeInTheDocument();
  });

  it('renders as a dropdown when multiple agents exist', async () => {
    renderPicker({
      value: 'default',
      agents: [
        { name: 'default', description: 'Free chat' },
        { name: 'research-pipeline', description: 'Research flow' },
      ],
    });

    expect(
      await screen.findByRole('button', { name: /switch agent/i }),
    ).toBeInTheDocument();
  });

  it('opens the menu and lists every agent', async () => {
    const user = userEvent.setup();
    renderPicker({
      value: 'default',
      agents: [
        { name: 'default', description: 'Free chat' },
        { name: 'research-pipeline', description: 'Research flow' },
        { name: 'marketing-flow', description: 'Marketing flow' },
      ],
    });

    await user.click(await screen.findByRole('button', { name: /switch agent/i }));

    // Radix DropdownMenu.Item renders as role="menuitem". Each agent in
    // the list surfaces under its own item.
    expect(await screen.findByRole('menuitem', { name: /default/i })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: /research-pipeline/i })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: /marketing-flow/i })).toBeInTheDocument();
  });

  it('navigates to /chat?agent={name} when a different agent is picked', async () => {
    const user = userEvent.setup();
    renderPicker({
      value: 'default',
      agents: [
        { name: 'default', description: 'Free chat' },
        { name: 'research-pipeline', description: 'Research flow' },
      ],
    });

    await user.click(await screen.findByRole('button', { name: /switch agent/i }));
    await user.click(
      await screen.findByRole('menuitem', { name: /research-pipeline/i }),
    );

    // The probe route at /chat captures the new pathname + search.
    const probe = await screen.findByTestId('probe');
    expect(probe.textContent).toBe('/chat?agent=research-pipeline');
  });

  it('always navigates even when the current agent is re-selected', async () => {
    // The contract is "selecting an agent always starts a new chat" — the
    // picker is not a no-op when re-selecting the active value, because
    // the user may want a fresh thread under the same agent.
    const user = userEvent.setup();
    renderPicker({
      value: 'research-pipeline',
      agents: [
        { name: 'default', description: 'Free chat' },
        { name: 'research-pipeline', description: 'Research flow' },
      ],
    });

    await user.click(await screen.findByRole('button', { name: /switch agent/i }));
    await user.click(
      await screen.findByRole('menuitem', { name: /research-pipeline/i }),
    );

    const probe = await screen.findByTestId('probe');
    expect(probe.textContent).toBe('/chat?agent=research-pipeline');
  });
});
