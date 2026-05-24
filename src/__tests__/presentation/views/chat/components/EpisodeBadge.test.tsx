import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { EpisodeBadge } from '@/presentation/views/chat/components/EpisodeBadge';
import {
  ServiceContext,
  type Services,
} from '@/presentation/providers/ServiceContext';

const CONVERSATION_ID = 'conv-1';
const EPISODE_ID = 'ep-1';
const FLOW_ID = 'flow-1';

function renderBadge(opts: {
  episode:
    | null
    | {
        id: string;
        status: 'active' | 'awaiting_user' | 'completed' | 'failed' | 'cancelled';
        flowId: string | null;
      };
  flowDisplayName?: string;
}) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  // Pre-seed the queries the badge reads — avoids needing to mock the
  // network. Keys mirror those in useOpenEpisode / useFlows.
  qc.setQueryData(
    ['conversations', CONVERSATION_ID, 'open-episode'],
    opts.episode,
  );
  qc.setQueryData(
    ['flows'],
    opts.flowDisplayName !== undefined
      ? [{ id: FLOW_ID, apiName: 'flow', displayName: opts.flowDisplayName }]
      : [],
  );

  const services = {
    episodeService: { getOpen: vi.fn(), cancel: vi.fn() },
    flowService: { list: vi.fn() },
  } as unknown as Services;

  return render(
    <QueryClientProvider client={qc}>
      <ServiceContext.Provider value={services}>
        <EpisodeBadge conversationId={CONVERSATION_ID} />
      </ServiceContext.Provider>
    </QueryClientProvider>,
  );
}

describe('EpisodeBadge (R7.1#3 — pure status pill, no cancel affordance)', () => {
  it('renders nothing when no open episode exists', () => {
    const { container } = renderBadge({ episode: null });
    expect(container.firstChild).toBeNull();
  });

  it('shows "Running …" for active flow episodes with the flow display name', () => {
    renderBadge({
      episode: { id: EPISODE_ID, status: 'active', flowId: FLOW_ID },
      flowDisplayName: 'Research Pipeline',
    });
    expect(screen.getByText(/Running Research Pipeline/)).toBeInTheDocument();
  });

  it('shows "Paused: …" for awaiting_user episodes', () => {
    renderBadge({
      episode: { id: EPISODE_ID, status: 'awaiting_user', flowId: FLOW_ID },
      flowDisplayName: 'Research Pipeline',
    });
    expect(screen.getByText(/Paused: Research Pipeline/)).toBeInTheDocument();
  });

  it('falls back to "agent" label for default-agent episodes (flow_id NULL)', () => {
    renderBadge({
      episode: { id: EPISODE_ID, status: 'awaiting_user', flowId: null },
    });
    expect(screen.getByText(/Paused: agent/)).toBeInTheDocument();
  });

  it('does NOT render a cancel × button (R7.1#3 — moved to ChatInput Stop + form Cancel)', () => {
    renderBadge({
      episode: { id: EPISODE_ID, status: 'active', flowId: FLOW_ID },
      flowDisplayName: 'Research Pipeline',
    });
    // No button at all inside the badge — it's a pure status indicator.
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    // Also no literal × character (sanity check against a future
    // regression that adds a non-button × span).
    expect(screen.queryByText('×')).not.toBeInTheDocument();
  });
});
