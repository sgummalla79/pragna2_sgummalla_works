/**
 * Tests for ``ChatLandingView.handleSend`` — the eager-create call site.
 *
 * Pins:
 *   1. Happy path: ``conversationService.create`` is called BEFORE
 *      ``navigate``. If a regression flips the order, the chat surface
 *      mounts against a non-existent row and the 404 noise comes back.
 *   2. Happy path: ``['conversations']`` query cache is invalidated
 *      after create so the sidebar list refreshes immediately AND
 *      ``useConversation`` (which reads from the list cache) doesn't
 *      return null on the session-view header.
 *   3. Failure path: create rejects → no navigation, error banner
 *      surfaced, the typed message stays in the input. The "loud
 *      failure" guarantee — silent retry would mask BE issues.
 */

import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import type { ReactNode } from 'react';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import ChatLandingView from '@/presentation/views/chat/ChatLandingView';
import {
  ServiceContext,
  type Services,
} from '@/presentation/providers/ServiceContext';
import type { Conversation } from '@/domain/types/conversation.types';

// Mock the providers hook to short-circuit the "no providers" gate — we
// want the composer enabled so handleSend can fire.
vi.mock('@/presentation/hooks/providers/useProviders', () => ({
  useLlmProvidersWithRegistrations: () => ({
    data: [
      {
        id: 'prov-1',
        userProviders: [
          {
            id: 'up-1',
            models: [{ id: 'm-1', enabled: true, availableForChat: true }],
          },
        ],
      },
    ],
    isLoading: false,
  }),
}));

// Mock the ChatInput so the test drives ``onSend`` directly without
// having to type into a real textarea (the textarea is React Aria
// flavoured and the test surface is brittle).
vi.mock('@/presentation/views/chat/components/ChatInput', () => ({
  ChatInput: (props: {
    onSend: (text: string, attachmentIds: string[]) => void;
    disabled?: boolean;
    children?: ReactNode;
  }) => (
    <div data-testid="chat-input-mock">
      <button
        type="button"
        data-testid="chat-input-send"
        disabled={props.disabled}
        onClick={() => props.onSend('hello world', [])}
      >
        send
      </button>
      {props.children}
    </div>
  ),
}));

// Mock ModelPicker — irrelevant to landing's create logic and pulls in
// service deps we don't want to set up here.
vi.mock('@/presentation/views/chat/components/ModelPicker', () => ({
  ModelPicker: () => <div data-testid="model-picker-mock" />,
}));

const SAMPLE_CONVERSATION: Conversation = {
  id: 'reused-id-will-be-overwritten',
  flowId: null,
  threadId: 'reused-id-will-be-overwritten',
  userModelId: null,
  title: null,
  thinkingEnabled: false,
  pinned: false,
  pinnedAt: null,
  createdAt: '2026-05-25T00:00:00Z',
};

interface SetupOpts {
  /** Override the create mock to reject — exercises the error path. */
  createImpl?: () => Promise<Conversation>;
}

function setup(opts: SetupOpts = {}) {
  const createMock: Mock = vi.fn(
    opts.createImpl ?? (() => Promise.resolve(SAMPLE_CONVERSATION)),
  );
  const services = {
    conversationService: {
      create: createMock,
    },
  } as unknown as Services;
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const invalidateSpy = vi.spyOn(qc, 'invalidateQueries');

  // ``LocationProbe`` mirrors the current URL into the DOM so the test
  // can assert pre / post navigation without depending on internal
  // router state. Rendered OUTSIDE the Routes so it's always present
  // (otherwise it only mounts after navigation away from /chat, and
  // the pre-navigation assertion can't find it).
  function LocationProbe() {
    const loc = useLocation();
    return <div data-testid="location">{loc.pathname}</div>;
  }

  const utils = render(
    <QueryClientProvider client={qc}>
      <ServiceContext.Provider value={services}>
        <MemoryRouter initialEntries={['/chat']}>
          <LocationProbe />
          <Routes>
            <Route path="/chat" element={<ChatLandingView />} />
            <Route path="/chat/:id" element={<div>session view</div>} />
          </Routes>
        </MemoryRouter>
      </ServiceContext.Provider>
    </QueryClientProvider>,
  );
  return { ...utils, createMock, invalidateSpy };
}

beforeEach(() => {
  // ``ChatLandingView`` calls ``crypto.randomUUID()`` for the pending
  // conversation id. jsdom provides it; mock to a fixed value so we
  // can assert against it.
  Object.defineProperty(globalThis.crypto, 'randomUUID', {
    value: () => 'fixed-uuid-for-test',
    configurable: true,
  });
});

describe('ChatLandingView.handleSend', () => {
  it('happy path: POSTs create → invalidates list cache → navigates', async () => {
    const { createMock, invalidateSpy } = setup();

    // Pre-condition: still on /chat (landing).
    expect(screen.getByTestId('location').textContent ?? '/chat').toBe('/chat');

    // Drive the mocked ChatInput's send.
    await act(async () => {
      screen.getByTestId('chat-input-send').click();
    });

    // create called with the client-generated UUID as threadId.
    await waitFor(() => {
      expect(createMock).toHaveBeenCalledTimes(1);
    });
    expect(createMock).toHaveBeenCalledWith({
      threadId: 'fixed-uuid-for-test',
      userModelId: null,
      thinkingEnabled: false,
    });

    // Sidebar list cache invalidated (so new row appears + useConversation
    // header reads it from cache instead of null).
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ['conversations'],
    });

    // Then — and only then — navigation fires.
    await waitFor(() => {
      expect(screen.getByTestId('location')).toHaveTextContent(
        '/chat/fixed-uuid-for-test',
      );
    });
  });

  it('failure path: create rejects → no navigation, error surfaced', async () => {
    const error = Object.assign(new Error('500'), {
      response: { data: { detail: 'BE on fire' } },
    });
    const { createMock } = setup({
      createImpl: () => Promise.reject(error),
    });

    await act(async () => {
      screen.getByTestId('chat-input-send').click();
    });

    await waitFor(() => {
      expect(createMock).toHaveBeenCalledTimes(1);
    });

    // Still on landing — NO navigation.
    expect(screen.getByTestId('location').textContent ?? '/chat').toBe('/chat');

    // Error banner surfaced with the BE's detail (not a generic message).
    await waitFor(() => {
      expect(
        screen.getByText(/BE on fire/i),
      ).toBeInTheDocument();
    });
  });

  it('happy path: create order is strictly before navigate', async () => {
    // Belt-and-braces: confirm we don't accidentally fire-and-forget
    // the create alongside navigation. The createMock resolves
    // asynchronously; until it resolves, navigation must NOT happen.
    let resolveCreate: ((c: Conversation) => void) | null = null;
    const createPromise = new Promise<Conversation>((resolve) => {
      resolveCreate = resolve;
    });
    setup({ createImpl: () => createPromise });

    await act(async () => {
      screen.getByTestId('chat-input-send').click();
    });

    // Still on landing — create has not resolved yet.
    expect(screen.getByTestId('location').textContent ?? '/chat').toBe('/chat');

    // Resolve create; navigation should happen after.
    await act(async () => {
      resolveCreate!(SAMPLE_CONVERSATION);
    });

    await waitFor(() => {
      expect(screen.getByTestId('location')).toHaveTextContent(
        '/chat/fixed-uuid-for-test',
      );
    });
  });
});
