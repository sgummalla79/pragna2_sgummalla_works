import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import AgentsView from '@/presentation/views/settings/AgentsView/AgentsView';
import {
  ServiceContext,
  type Services,
} from '@/presentation/providers/ServiceContext';
import type { UserAgent } from '@/domain/types/userAgent.types';
import type { Model } from '@/domain/types/model.types';
import type { Flow } from '@/domain/types/flow.types';
import { EDGE_CONDITIONS } from '@/constants/edgeConditions';

const AGENT_A: UserAgent = {
  id: 'agent-a',
  apiName: 'researcher',
  displayName: 'Researcher',
  description: 'Does research',
  userModelId: 'model-1',
  systemPrompt: '',
  outputSchema: null,
  tools: [],
  emits: [],
  createdAt: '2026-05-27T00:00:00Z',
  modifiedAt: '2026-05-27T00:00:00Z',
};

const AGENT_B: UserAgent = {
  ...AGENT_A,
  id: 'agent-b',
  apiName: 'reviewer',
  displayName: 'Reviewer',
};

const MODEL: Model = {
  id: 'model-1',
  userProviderId: 'prov-1',
  modelName: 'claude-sonnet-4-6',
  displayName: 'Claude Sonnet 4.6',
  costPerInputToken: '0',
  costPerOutputToken: '0',
  enabled: true,
  availableForChat: true,
  availableForFlows: true,
  archived: false,
  metadata: {},
  supportsVision: false,
  supportsPdf: false,
};

function makeFlow(id: string, apiName: string, agentIds: string[]): Flow {
  return {
    id,
    apiName,
    displayName: apiName,
    description: null,
    enabled: true,
    slashApiName: null,
    exposedAsSlash: false,
    metadata: {},
    definition: null,
    nodes: agentIds.map((aid, i) => ({
      id: `${id}-n${i}`,
      nodeId: `n${i}`,
      userAgentId: aid,
    })),
    edges: [
      { id: `${id}-e0`, fromNode: '__start__', toNode: 'n0', condition: EDGE_CONDITIONS.DEFAULT },
    ],
  };
}

function renderView(opts: { agents?: UserAgent[]; flows?: Flow[] } = {}) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });

  const services = {
    userAgentService: {
      list: vi.fn().mockResolvedValue(opts.agents ?? []),
      delete: vi.fn(),
    },
    modelService: {
      list: vi.fn().mockResolvedValue([MODEL]),
    },
    flowService: {
      list: vi.fn().mockResolvedValue(opts.flows ?? []),
    },
  } as unknown as Services;

  const wrapper = ({ children }: { children: ReactNode }) => (
    <MemoryRouter>
      <QueryClientProvider client={qc}>
        <ServiceContext.Provider value={services}>
          {children}
        </ServiceContext.Provider>
      </QueryClientProvider>
    </MemoryRouter>
  );

  return render(<AgentsView />, { wrapper });
}

describe('AgentsView — used-by flow pills (2026-05-27)', () => {
  it("shows 'no flows' when the agent isn't referenced anywhere", async () => {
    renderView({ agents: [AGENT_A], flows: [] });
    expect(await screen.findByText('Researcher')).toBeInTheDocument();
    expect(screen.getByText('no flows')).toBeInTheDocument();
  });

  it('renders a pill for each flow referencing the agent', async () => {
    const flow1 = makeFlow('flow-1', 'intake-loop', ['agent-a']);
    const flow2 = makeFlow('flow-2', 'review-pass', ['agent-a', 'agent-b']);
    renderView({ agents: [AGENT_A, AGENT_B], flows: [flow1, flow2] });

    // Researcher (agent-a) appears in both flows.
    await screen.findByText('Researcher');
    const researcherCard = screen.getByText('Researcher').closest('li')!;
    expect(researcherCard).not.toBeNull();
    expect(researcherCard.querySelector('a[href="/settings/flows/flow-1/edit"]')).not.toBeNull();
    expect(researcherCard.querySelector('a[href="/settings/flows/flow-2/edit"]')).not.toBeNull();

    // Reviewer (agent-b) appears in flow-2 only.
    const reviewerCard = screen.getByText('Reviewer').closest('li')!;
    expect(reviewerCard.querySelector('a[href="/settings/flows/flow-1/edit"]')).toBeNull();
    expect(reviewerCard.querySelector('a[href="/settings/flows/flow-2/edit"]')).not.toBeNull();
  });

  it('dedupes when one flow references the same agent on multiple nodes', async () => {
    const flow = makeFlow('flow-1', 'self-loop', ['agent-a', 'agent-a', 'agent-a']);
    renderView({ agents: [AGENT_A], flows: [flow] });

    await screen.findByText('Researcher');
    const card = screen.getByText('Researcher').closest('li')!;
    const flowLinks = card.querySelectorAll('a[href="/settings/flows/flow-1/edit"]');
    // Exactly one pill for flow-1 even though it references agent-a 3×.
    expect(flowLinks.length).toBe(1);
  });
});
