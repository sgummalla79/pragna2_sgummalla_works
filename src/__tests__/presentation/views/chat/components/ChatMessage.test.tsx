import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ChatMessage } from '@/presentation/views/chat/components/ChatMessage';
import {
  ServiceContext,
  type Services,
} from '@/presentation/providers/ServiceContext';

function renderMessage(message: {
  id: string;
  role: 'user' | 'assistant' | 'tool' | 'system';
  content: string;
}) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  // Minimal stub — ChatMessage's system/tool branches don't touch services,
  // and useFlows is wrapped in QueryClient with retry disabled so an
  // unmocked fetch fails fast without affecting rendering.
  const services = {
    flowService: { list: () => Promise.resolve([]) },
  } as unknown as Services;
  return render(
    <QueryClientProvider client={qc}>
      <ServiceContext.Provider value={services}>
        <ChatMessage message={message} />
      </ServiceContext.Provider>
    </QueryClientProvider>,
  );
}

describe('ChatMessage role=system (R7.1#3 cancel breadcrumb)', () => {
  it('renders a system message as centered muted text', () => {
    renderMessage({
      id: 'sys-1',
      role: 'system',
      content: "You cancelled 'Research Pipeline'.",
    });
    const span = screen.getByText("You cancelled 'Research Pipeline'.");
    expect(span).toBeInTheDocument();
    // The styling is meant to be subtle — italic + muted — so the
    // user reads it as a system note, not a chat turn.
    expect(span.className).toMatch(/italic/);
    expect(span.className).toMatch(/text-muted-foreground/);
  });

  it('suppresses tool-role messages entirely', () => {
    const { container } = renderMessage({
      id: 'tool-1',
      role: 'tool',
      content: 'irrelevant tool payload',
    });
    expect(container.firstChild).toBeNull();
    expect(screen.queryByText(/irrelevant/)).not.toBeInTheDocument();
  });

  it('does not render the user/assistant bubble chrome for system rows', () => {
    renderMessage({
      id: 'sys-2',
      role: 'system',
      content: 'You cancelled the agent’s response.',
    });
    // The user/assistant rendering paths add an action footer (Edit /
    // Branch / Re-run buttons). System rows must not.
    expect(
      screen.queryByRole('button', { name: /edit/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /branch/i }),
    ).not.toBeInTheDocument();
  });
});
