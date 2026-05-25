import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import McpServersView from '@/presentation/views/settings/McpServersView/McpServersView';
import {
  ServiceContext,
  type Services,
} from '@/presentation/providers/ServiceContext';
import type { UserMcpServer } from '@/domain/types/mcp.types';

const SAMPLE_SERVER: UserMcpServer = {
  id: 'srv-1',
  displayName: 'My Linear',
  transport: 'http',
  config: { url: 'https://x' },
  hasCredentials: true,
  enabled: true,
  tools: { total: 3, enabled: 1 },
  createdAt: '2026-05-25T00:00:00Z',
  modifiedAt: '2026-05-25T00:00:00Z',
};

function renderView(opts: {
  servers?: UserMcpServer[];
  register?: ReturnType<typeof vi.fn>;
} = {}) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const servers = opts.servers ?? [];
  const register =
    opts.register ??
    vi.fn().mockResolvedValue({
      ...SAMPLE_SERVER,
      discoveredToolApiNames: ['mcp.x.search'],
    });

  const services = {
    mcpServerService: {
      list: vi.fn().mockResolvedValue(servers),
      register,
      update: vi.fn(),
      archive: vi.fn(),
      refreshTools: vi.fn(),
    },
    toolService: {
      list: vi.fn().mockResolvedValue([]),
      setEnabled: vi.fn(),
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

  return {
    ...render(<McpServersView />, { wrapper }),
    register,
  };
}

describe('McpServersView — empty state', () => {
  it('shows the empty-state CTA when no servers exist', async () => {
    renderView({ servers: [] });
    // Empty state text was reflowed during the ui-fixes alignment
    // commit (ffbbefc) — it's now one combined sentence. Use a regex
    // so the matcher survives further copy tweaks without breaking.
    expect(
      await screen.findByText(/No MCP servers yet/),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /Register server/ }),
    ).toBeInTheDocument();
  });
});

describe('McpServersView — populated state', () => {
  it('renders one card per server', async () => {
    renderView({ servers: [SAMPLE_SERVER] });
    expect(await screen.findByText('My Linear')).toBeInTheDocument();
    expect(screen.queryByText(/No MCP servers yet/)).toBeNull();
  });
});

describe('McpServersView — register modal', () => {
  it('opening the register CTA opens the modal with the form', async () => {
    const user = userEvent.setup();
    renderView({ servers: [] });
    await user.click(
      await screen.findByRole('button', {
        name: /Register server/,
      }),
    );
    expect(
      await screen.findByText('Register an MCP server'),
    ).toBeInTheDocument();
    // Form's display_name field is the first focusable input.
    expect(screen.getByLabelText('Display name')).toBeInTheDocument();
  });

  it('successful register closes the modal + shows the success banner', async () => {
    const user = userEvent.setup();
    const register = vi.fn().mockResolvedValue({
      ...SAMPLE_SERVER,
      discoveredToolApiNames: ['mcp.my-linear.search', 'mcp.my-linear.lookup'],
    });
    renderView({ servers: [], register });

    await user.click(
      await screen.findByRole('button', {
        name: /Register server/,
      }),
    );
    await user.type(screen.getByLabelText('Display name'), 'My Linear');
    await user.type(
      screen.getByLabelText('Server URL'),
      'https://mcp.linear.app/sse',
    );
    await user.click(
      screen.getByRole('button', { name: /Register \+ discover tools/ }),
    );

    await waitFor(() => expect(register).toHaveBeenCalled());
    // Success banner appears with the discovered count.
    await waitFor(() => {
      expect(
        screen.getByText(/with 2 tools discovered\./),
      ).toBeInTheDocument();
    });
  });
});
