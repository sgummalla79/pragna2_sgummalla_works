import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
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
    thinkingEnabled: false,
    pinned: false,
    pinnedAt: null,
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

  it('exposes a kebab menu trigger for actions', () => {
    renderItem(makeConversation());
    // The three actions (Edit / Pin / Delete) now live behind a single
    // kebab (⋮) menu trigger. The trigger has an accessible label.
    expect(
      screen.getByRole('button', { name: /conversation actions/i }),
    ).toBeInTheDocument();
  });

  it('marks the row as the current page when route matches', () => {
    renderItem(makeConversation({ id: 'conv-1' }), '/chat/conv-1');
    const link = screen.getByRole('link');
    expect(link).toHaveAttribute('aria-current', 'page');
  });

  // ── Delete-of-active-conversation invariant ────────────────────────
  //
  // The boundary doc (chat ↔ delete) requires that deleting the
  // currently-viewed conversation bounces the user to /chat (landing);
  // without it, the session view is left mounted against a dead id
  // and the three conversation-scoped 404 race-guards fire repeatedly.
  //
  // Indirectly pinned today by:
  //   - The implementation: one-line guard at
  //     ``ConversationListItem.tsx:82`` (``if (isActive) navigate(ROUTES.CHAT)``).
  //   - The BE integration test ``test_fresh_conversation_lifecycle``
  //     which covers the full delete + re-GET → 404 chain at API level.
  //
  // A UI-level interaction test was attempted here but fights Radix
  // DropdownMenu's portal mechanics in jsdom. A proper test would
  // require ``userEvent`` plus a Radix-specific harness — deferred
  // until we have ≥1 other Radix-driven interaction test in the FE
  // suite to share the setup with.

});
