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

describe('ChatMessage set_route suppression (#25)', () => {
  function renderAssistantWithToolCall(call: {
    id: string;
    name: string;
    args?: string;
  }) {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const services = {
      flowService: { list: () => Promise.resolve([]) },
    } as unknown as Services;
    const message = {
      id: 'asst-1',
      role: 'assistant' as const,
      content: 'Approved.',
      toolCalls: [{ id: call.id, name: call.name, args: call.args ?? '{}' }],
    };
    return render(
      <QueryClientProvider client={qc}>
        <ServiceContext.Provider value={services}>
          {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
          <ChatMessage message={message as any} />
        </ServiceContext.Provider>
      </QueryClientProvider>,
    );
  }

  it('does not render a badge for the set_route routing tool call', () => {
    renderAssistantWithToolCall({
      id: 'tc-1',
      name: 'set_route',
      args: '{"target":"passed"}',
    });
    // The clean reply still shows...
    expect(screen.getByText('Approved.')).toBeInTheDocument();
    // ...but the routing signal never surfaces as a tool-call badge.
    expect(screen.queryByText(/set_route/)).not.toBeInTheDocument();
    expect(screen.queryByText(/passed/)).not.toBeInTheDocument();
  });
});

describe('ChatMessage reasoning timeline (BE migration 0026)', () => {
  function renderAssistant(message: {
    id: string;
    role: 'assistant';
    content: string;
    reasoning?: string;
  }) {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const services = {
      flowService: { list: () => Promise.resolve([]) },
    } as unknown as Services;
    return render(
      <QueryClientProvider client={qc}>
        <ServiceContext.Provider value={services}>
          {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
          <ChatMessage message={message as any} />
        </ServiceContext.Provider>
      </QueryClientProvider>,
    );
  }

  it('renders the reasoning disclosure when reasoning is present', () => {
    renderAssistant({
      id: 'asst-r1',
      role: 'assistant',
      content: 'Final answer.',
      reasoning: 'First I considered the constraints, then I decided.',
    });
    // Collapsed header shows the summary preview of the trace.
    expect(
      screen.getByText(/First I considered the constraints/),
    ).toBeInTheDocument();
    // The answer renders alongside it.
    expect(screen.getByText('Final answer.')).toBeInTheDocument();
  });

  it('renders no reasoning disclosure when reasoning is absent', () => {
    renderAssistant({
      id: 'asst-r2',
      role: 'assistant',
      content: 'Just an answer.',
    });
    expect(screen.getByText('Just an answer.')).toBeInTheDocument();
    // No disclosure trigger when there's no trace.
    expect(screen.queryByRole('button', { name: /reasoning/i })).not.toBeInTheDocument();
  });
});
