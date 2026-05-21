import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ConversationListItem } from '@/presentation/views/chat/components/ConversationListItem';
import {
  ServiceContext,
  type Services,
} from '@/presentation/providers/ServiceContext';
import type { Conversation } from '@/domain/types/conversation.types';

function makeConversation(overrides: Partial<Conversation> = {}): Conversation {
  return {
    id: 'conv-1',
    flowId: null,
    threadId: 'thread-1',
    userModelId: 'model-1',
    title: 'Research planning',
    createdAt: '2026-05-21T00:00:00Z',
    ...overrides,
  };
}

function renderItem(conversation: Conversation, initialPath = '/chat/new') {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const services = {
    conversationService: {
      update: vi.fn().mockResolvedValue(conversation),
      delete: vi.fn().mockResolvedValue(undefined),
    },
  } as unknown as Services;

  return render(
    <QueryClientProvider client={qc}>
      <ServiceContext.Provider value={services}>
        <MemoryRouter initialEntries={[initialPath]}>
          <Routes>
            <Route
              path="/chat/:id"
              element={<ConversationListItem conversation={conversation} />}
            />
            <Route
              path="/chat/new"
              element={<ConversationListItem conversation={conversation} />}
            />
          </Routes>
        </MemoryRouter>
      </ServiceContext.Provider>
    </QueryClientProvider>,
  );
}

describe('ConversationListItem', () => {
  it('renders the conversation title', () => {
    renderItem(makeConversation({ title: 'My chat' }));
    expect(screen.getByText('My chat')).toBeInTheDocument();
  });

  it('falls back to "Untitled chat" when title is null', () => {
    renderItem(makeConversation({ title: null }));
    expect(screen.getByText('Untitled chat')).toBeInTheDocument();
  });

  it('exposes rename and delete actions (icon-only buttons)', () => {
    renderItem(makeConversation());
    // Icon-only affordances — locate them by aria-label.
    expect(
      screen.getByRole('button', { name: /rename conversation/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /delete conversation/i }),
    ).toBeInTheDocument();
  });

  it('marks the row as the current page when route matches', () => {
    renderItem(makeConversation({ id: 'conv-1' }), '/chat/conv-1');
    const link = screen.getByRole('link');
    expect(link).toHaveAttribute('aria-current', 'page');
  });

  it('opens the rename dialog when the pencil is clicked', () => {
    renderItem(makeConversation());
    fireEvent.click(
      screen.getByRole('button', { name: /rename conversation/i }),
    );
    // Dialog title is rendered when open.
    expect(
      screen.getByRole('dialog', { name: /rename conversation/i }),
    ).toBeInTheDocument();
  });
});
