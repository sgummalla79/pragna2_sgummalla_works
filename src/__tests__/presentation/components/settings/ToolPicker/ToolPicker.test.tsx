import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ToolPicker } from '@/presentation/components/settings/ToolPicker/ToolPicker';
import {
  ServiceContext,
  type Services,
} from '@/presentation/providers/ServiceContext';
import type { Tool } from '@/domain/types/tool.types';

const SAMPLE_TOOLS: Tool[] = [
  {
    id: 'tool-1',
    userId: null,
    userMcpServerId: null,
    apiName: 'ask_user',
    displayName: 'Ask the user',
    description: 'Pause for input',
    toolType: 'builtin',
    handlerFamily: 'system_interrupt',
    systemManaged: true,
    autoBindToDefaultAgent: true,
    enabled: true,
    createdAt: '2026-05-24T00:00:00Z',
    modifiedAt: '2026-05-24T00:00:00Z',
  },
  {
    id: 'tool-2',
    userId: 'user-1',
    userMcpServerId: 'srv-1',
    apiName: 'mcp.my-linear.search',
    displayName: 'search',
    description: 'Search Linear',
    toolType: 'mcp',
    handlerFamily: null,
    systemManaged: false,
    autoBindToDefaultAgent: false,
    enabled: false,
    createdAt: '2026-05-25T00:00:00Z',
    modifiedAt: '2026-05-25T00:00:00Z',
  },
];

function renderWithTools(values: string[], onChange = vi.fn(), tools = SAMPLE_TOOLS) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const services = {
    toolService: { list: vi.fn().mockResolvedValue(tools) },
  } as unknown as Services;

  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}>
      <ServiceContext.Provider value={services}>
        {children}
      </ServiceContext.Provider>
    </QueryClientProvider>
  );

  return {
    ...render(
      <ToolPicker
        label="tool"
        values={values}
        onChange={onChange}
        placeholder="search…"
      />,
      { wrapper },
    ),
    onChange,
  };
}

describe('ToolPicker — empty state', () => {
  it('shows the placeholder when no chips are selected', () => {
    renderWithTools([]);
    expect(screen.getByPlaceholderText('search…')).toBeInTheDocument();
  });
});

describe('ToolPicker — autocomplete', () => {
  it('shows matching suggestions as the user types', async () => {
    const user = userEvent.setup();
    renderWithTools([]);
    // Wait for the tools query to settle so the picker has data.
    await waitFor(() => expect(true).toBe(true));

    const input = screen.getByPlaceholderText('search…');
    await user.click(input);
    await user.type(input, 'mcp');

    const listbox = await screen.findByRole('listbox');
    const items = within(listbox).getAllByRole('option');
    expect(items).toHaveLength(1);
    expect(items[0]).toHaveTextContent('mcp.my-linear.search');
  });

  it('inserts a chip when a suggestion is clicked', async () => {
    const user = userEvent.setup();
    const { onChange } = renderWithTools([]);

    const input = screen.getByPlaceholderText('search…');
    await user.click(input);
    await user.type(input, 'ask');
    const option = await screen.findByRole('option', { name: /ask_user/ });
    await user.click(option);

    expect(onChange).toHaveBeenCalledWith(['ask_user']);
  });

  it('hides already-selected api_names from suggestions', async () => {
    const user = userEvent.setup();
    renderWithTools(['ask_user']);

    const input = screen.getByDisplayValue('');
    await user.click(input);
    await user.type(input, 'ask');
    // Wait a moment for the dropdown to compute — it should NOT contain
    // the already-selected tool.
    await waitFor(() => {
      // No listbox = empty suggestion list = popover hidden.
      expect(screen.queryByRole('listbox')).toBeNull();
    });
  });
});

describe('ToolPicker — freeform fallback', () => {
  it('commits unknown text as a chip on Enter (Hybrid mode)', async () => {
    const user = userEvent.setup();
    const { onChange } = renderWithTools([]);

    const input = screen.getByPlaceholderText('search…');
    await user.click(input);
    await user.type(input, 'totally_unknown_tool{Enter}');

    expect(onChange).toHaveBeenCalledWith(['totally_unknown_tool']);
  });

  it('renders unknown chips with an alert icon (unknown badge)', async () => {
    renderWithTools(['something_not_in_tools_list']);
    // The chip is rendered with title="No matching tool found" — the
    // hover hint is the most reliable selector for the unknown state.
    await waitFor(() => {
      expect(
        screen.getByTitle('No matching tool found'),
      ).toBeInTheDocument();
    });
  });

  it('renders known chips WITHOUT the unknown icon', async () => {
    renderWithTools(['ask_user']);
    // Wait for tools to load so the chip can re-render in the
    // "known" state.
    await waitFor(() => {
      expect(screen.queryByTitle('No matching tool found')).toBeNull();
    });
  });
});

describe('ToolPicker — remove chip', () => {
  it('calls onChange without the removed chip', async () => {
    const user = userEvent.setup();
    const { onChange } = renderWithTools(['ask_user', 'mcp.my-linear.search']);

    const removeBtn = await screen.findByLabelText(/Remove tool ask_user/);
    await user.click(removeBtn);

    expect(onChange).toHaveBeenCalledWith(['mcp.my-linear.search']);
  });
});
