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

  it('falls back to "New chat" placeholder when title is null', () => {
    // Background-Run M4: the placeholder for a not-yet-titled row is
    // "New chat" (signals freshness; auto-title is in flight) — NOT
    // 'Untitled chat' which signals user-initiated emptiness.
    renderItem(makeConversation({ title: null }));
    expect(screen.getByText('New chat')).toBeInTheDocument();
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
  // currently-viewed conversation bounces the user to /chat (landing)
  // BEFORE the DELETE round-trip starts. The earlier shape (await
  // mutateAsync → navigate) left the chat session view mounted across
  // the DELETE; its hooks (messages, usage, open-episode) re-fetched
  // when ``onSuccess`` evicted the cache, hitting the just-deleted
  // row → 404. Reordered to navigate-first so the view unmounts and
  // its query observers detach before cache eviction.
  //
  // Indirectly pinned today by:
  //   - The implementation: navigate-before-mutate ordering at
  //     ``ConversationListItem.tsx`` ``handleDeleteConfirm``.
  //   - The hook-level tests in
  //     ``useDeleteConversation.test.tsx`` which pin
  //     ``cancelQueries`` + ``removeQueries`` semantics.
  //   - The BE integration test ``test_fresh_conversation_lifecycle``
  //     which covers the full delete + re-GET → 404 chain at API level.
  //
  // A UI-level interaction test was attempted here but fights Radix
  // DropdownMenu's portal mechanics in jsdom. A proper test would
  // require ``userEvent`` plus a Radix-specific harness — deferred
  // until we have ≥1 other Radix-driven interaction test in the FE
  // suite to share the setup with.

});
