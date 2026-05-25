import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { McpServerCard } from '@/presentation/views/settings/McpServersView/McpServerCard';
import {
  ServiceContext,
  type Services,
} from '@/presentation/providers/ServiceContext';
import type { UserMcpServer } from '@/domain/types/mcp.types';
import type { Tool } from '@/domain/types/tool.types';

const SERVER: UserMcpServer = {
  id: 'srv-1',
  displayName: 'My Linear',
  transport: 'http',
  config: { url: 'https://x' },
  hasCredentials: true,
  enabled: true,
  tools: { total: 2, enabled: 1 },
  createdAt: '2026-05-25T00:00:00Z',
  modifiedAt: '2026-05-25T00:00:00Z',
};

const TOOLS: Tool[] = [
  {
    id: 'tool-1',
    userId: 'user-1',
    userMcpServerId: 'srv-1',
    apiName: 'mcp.my-linear.search',
    displayName: 'search',
    description: 'Search Linear',
    toolType: 'mcp',
    handlerFamily: null,
    systemManaged: false,
    autoBindToDefaultAgent: false,
    enabled: true,
    createdAt: '2026-05-25T00:00:00Z',
    modifiedAt: '2026-05-25T00:00:00Z',
  },
  {
    id: 'tool-2',
    userId: 'user-1',
    userMcpServerId: 'srv-1',
    apiName: 'mcp.my-linear.create_issue',
    displayName: 'create_issue',
    description: 'Create an issue',
    toolType: 'mcp',
    handlerFamily: null,
    systemManaged: false,
    autoBindToDefaultAgent: false,
    enabled: false,
    createdAt: '2026-05-25T00:00:00Z',
    modifiedAt: '2026-05-25T00:00:00Z',
  },
];

function renderCard(opts: {
  setEnabled?: ReturnType<typeof vi.fn>;
  archive?: ReturnType<typeof vi.fn>;
  refreshTools?: ReturnType<typeof vi.fn>;
} = {}) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const setEnabled =
    opts.setEnabled ?? vi.fn().mockImplementation((_id, p) => ({
      ...TOOLS[1],
      enabled: p.enabled,
    }));
  const archive = opts.archive ?? vi.fn().mockResolvedValue(undefined);
  const refreshTools =
    opts.refreshTools ??
    vi.fn().mockResolvedValue({ added: 0, unchanged: 2, archived: 0 });

  const services = {
    mcpServerService: {
      list: vi.fn().mockResolvedValue([SERVER]),
      register: vi.fn(),
      update: vi.fn().mockResolvedValue(SERVER),
      archive,
      refreshTools,
    },
    toolService: {
      list: vi.fn().mockResolvedValue(TOOLS),
      setEnabled,
    },
  } as unknown as Services;

  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}>
      <ServiceContext.Provider value={services}>
        {children}
      </ServiceContext.Provider>
    </QueryClientProvider>
  );

  return {
    ...render(<McpServerCard server={SERVER} />, { wrapper }),
    setEnabled,
    archive,
    refreshTools,
  };
}

describe('McpServerCard — collapsed state', () => {
  it('shows display_name, transport badge, and tool count', () => {
    renderCard();
    expect(screen.getByText('My Linear')).toBeInTheDocument();
    expect(screen.getByText('http')).toBeInTheDocument();
    expect(screen.getByText('1 / 2 tools enabled')).toBeInTheDocument();
  });

  it('does not render the expanded body initially', () => {
    renderCard();
    // The "Refresh tools" button only exists inside the expanded body.
    expect(screen.queryByText(/Refresh tools/)).toBeNull();
  });
});

describe('McpServerCard — expansion', () => {
  it('clicking the header expands the body', async () => {
    const user = userEvent.setup();
    renderCard();
    await user.click(screen.getByRole('button', { name: /My Linear/ }));
    expect(await screen.findByText(/Refresh tools/)).toBeInTheDocument();
  });
});

describe('McpServerCard — per-tool toggle', () => {
  it('toggling a tool dispatches setEnabled with the new value', async () => {
    const user = userEvent.setup();
    const { setEnabled } = renderCard();
    await user.click(screen.getByRole('button', { name: /My Linear/ }));

    // Wait for the tool list to render.
    const item = await screen.findByText('mcp.my-linear.create_issue');
    const checkbox = within(item.closest('li')!).getByRole('checkbox');
    await user.click(checkbox);

    expect(setEnabled).toHaveBeenCalledWith('tool-2', { enabled: true });
  });
});

describe('McpServerCard — archive (destructive confirm)', () => {
  it('clicking Archive opens a confirmation dialog (does NOT archive directly)', async () => {
    const user = userEvent.setup();
    const { archive } = renderCard();
    await user.click(screen.getByRole('button', { name: /My Linear/ }));
    await user.click(await screen.findByRole('button', { name: 'Archive…' }));

    // The dialog appears with the destructive copy AND the mutation
    // has NOT yet been called (gated behind the confirm button).
    await waitFor(() => {
      expect(
        screen.getByText(/Archive 'My Linear'\?/),
      ).toBeInTheDocument();
    });
    expect(archive).not.toHaveBeenCalled();

    // Clicking the dialog's confirm button fires the mutation.
    await user.click(screen.getByRole('button', { name: 'Archive' }));
    await waitFor(() => expect(archive).toHaveBeenCalledWith('srv-1'));
  });
});

describe('McpServerCard — refresh tools', () => {
  it('clicking Refresh tools dispatches refreshTools + surfaces the diff', async () => {
    const user = userEvent.setup();
    const { refreshTools } = renderCard({
      refreshTools: vi
        .fn()
        .mockResolvedValue({ added: 1, unchanged: 1, archived: 0 }),
    });
    await user.click(screen.getByRole('button', { name: /My Linear/ }));
    await user.click(await screen.findByRole('button', { name: /Refresh tools/ }));

    await waitFor(() => expect(refreshTools).toHaveBeenCalledWith('srv-1'));
    await waitFor(() => {
      expect(
        screen.getByText(/Refreshed: 1 added, 1 unchanged, 0 archived\./),
      ).toBeInTheDocument();
    });
  });
});
