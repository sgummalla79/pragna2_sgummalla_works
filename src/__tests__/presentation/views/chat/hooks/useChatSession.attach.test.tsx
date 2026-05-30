import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// vi.mock factories are hoisted ABOVE imports, so the class + tracking
// array MUST live inside the factory closure. We expose the array via
// a named export on the mock module so tests can introspect instances.
vi.mock('@ag-ui/client', () => {
  const instances: unknown[] = [];
  class MockHttpAgent {
    public url: string;
    public messages: unknown[];
    public abortRun = vi.fn();
    public setMessages = vi.fn((m: unknown[]) => {
      this.messages = m;
    });
    public subscribe = vi.fn(() => ({ unsubscribe: vi.fn() }));
    public runAgent = vi.fn().mockResolvedValue(undefined);

    constructor(opts: { url: string; initialMessages?: unknown[] }) {
      this.url = opts.url;
      // Honor initialMessages exactly like the real HttpAgent — without
      // this, syncMessages on the first useEffect would overwrite the
      // lazy useState init with [] and the flicker-prevention test
      // below would pass for the wrong reason (or fail spuriously).
      this.messages = opts.initialMessages ?? [];
      instances.push(this);
    }
  }
  return { HttpAgent: MockHttpAgent, __mockInstances: instances };
});

// usePragnaSlashFlows fetches via React Query — short-circuit with []
// so we don't need to wire ServiceContext for the slash flow lookup.
vi.mock('@/presentation/hooks/pragnaFlows/usePragnaSlashFlows', () => ({
  usePragnaSlashFlows: () => ({ data: [] }),
}));

import * as agUiClient from '@ag-ui/client';
import { useAuthStore } from '@/presentation/store/authStore';
import { useChatSession } from '@/presentation/views/chat/hooks/useChatSession';

// Typed accessor to the mock's tracked instances.
type MockAgent = {
  url: string;
  runAgent: ReturnType<typeof vi.fn>;
  subscribe: ReturnType<typeof vi.fn>;
};
const mockInstances = (
  agUiClient as unknown as { __mockInstances: MockAgent[] }
).__mockInstances;

function wrapper({ children }: { children: ReactNode }) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

describe('useChatSession.attach (Background-Run Execution M5.2)', () => {
  beforeEach(() => {
    mockInstances.length = 0;
    useAuthStore.setState({
      accessToken: 'test-token',
      user: {
        id: 'u1',
        email: 'a@b.com',
        name: null,
        identityProvider: 'local',
        settings: {},
      },
      isAuthenticated: true,
      bootstrapped: true,
    });
  });

  it('points the agent at the BE attach URL + calls runAgent({})', () => {
    const { result } = renderHook(
      () => useChatSession('default', { threadId: 'conv-uuid' }),
      { wrapper },
    );

    expect(mockInstances).toHaveLength(1);
    const built = mockInstances[0];
    const originalUrl = built.url;

    act(() => {
      result.current.attach('conv-uuid', 'ep-uuid');
    });

    expect(built.url).toBe(
      '/api/conversations/conv-uuid/episodes/ep-uuid/stream',
    );
    expect(built.runAgent).toHaveBeenCalledTimes(1);
    expect(built.runAgent.mock.calls[0][0]).toEqual({});
    // Sanity: the original URL was a /pragna/* URL (PRAGNA_BASE_URL),
    // distinct from the attach URL — proves we actually swapped.
    expect(originalUrl).not.toBe(built.url);
  });

  it('is a no-op while a run is in flight (does not double-POST)', () => {
    const { result } = renderHook(
      () => useChatSession('default', { threadId: 'conv-uuid' }),
      { wrapper },
    );

    expect(mockInstances).toHaveLength(1);
    const built = mockInstances[0];

    // Flip the hook into 'running' by calling onRunInitialized on the
    // subscriber it registered (same path HttpAgent takes when its
    // real runAgent starts).
    const firstSubscribeCall = built.subscribe.mock.calls[0];
    const subscriber = firstSubscribeCall[0] as {
      onRunInitialized?: (arg: unknown) => void;
    };
    act(() => {
      subscriber.onRunInitialized?.({});
    });

    const callsBefore = built.runAgent.mock.calls.length;

    act(() => {
      result.current.attach('conv-uuid', 'ep-uuid');
    });

    expect(built.runAgent.mock.calls.length).toBe(callsBefore);
  });
});

describe('useChatSession.onRunFailed AbortError guard (M5.2 follow-up)', () => {
  beforeEach(() => {
    mockInstances.length = 0;
    useAuthStore.setState({
      accessToken: 'test-token',
      user: {
        id: 'u1',
        email: 'a@b.com',
        name: null,
        identityProvider: 'local',
        settings: {},
      },
      isAuthenticated: true,
      bootstrapped: true,
    });
  });

  it('does NOT surface AbortError in the error banner (silent reset)', () => {
    const { result } = renderHook(
      () => useChatSession('default', { threadId: 'conv-uuid' }),
      { wrapper },
    );

    const built = mockInstances[mockInstances.length - 1];
    const subscriber = built.subscribe.mock.calls[0][0] as {
      onRunInitialized?: (arg: unknown) => void;
      onRunFailed?: (arg: { error: Error }) => void;
    };

    // Get into running state first.
    act(() => {
      subscriber.onRunInitialized?.({});
    });
    expect(result.current.status).toBe('running');

    // Fire an AbortError exactly the way HttpAgent's abort path
    // would (e.g. navigation triggers the useEffect cleanup ->
    // abortRun -> RunErrorEvent -> onRunFailed). Name='AbortError'
    // is the Web spec; message text comes from the browser.
    const abortErr = new Error('signal is aborted without reason');
    abortErr.name = 'AbortError';
    act(() => {
      subscriber.onRunFailed?.({ error: abortErr });
    });

    // Banner stays empty (no user-visible "signal is aborted") AND
    // status goes back to idle, not 'error'. This is the key
    // invariant the user reported as broken.
    expect(result.current.error).toBeNull();
    expect(result.current.status).toBe('idle');
    expect(result.current.progressLabel).toBeNull();
  });

  it('does NOT surface generic "aborted" messages either', () => {
    const { result } = renderHook(
      () => useChatSession('default', { threadId: 'conv-uuid' }),
      { wrapper },
    );

    const built = mockInstances[mockInstances.length - 1];
    const subscriber = built.subscribe.mock.calls[0][0] as {
      onRunInitialized?: (arg: unknown) => void;
      onRunFailed?: (arg: { error: Error }) => void;
    };
    act(() => {
      subscriber.onRunInitialized?.({});
    });

    // Some runtimes wrap the abort in a plain Error whose name is
    // 'Error' but whose message contains 'aborted'. The guard's
    // /aborted/i regex covers that variant.
    const wrappedAbort = new Error('The user aborted a request.');
    act(() => {
      subscriber.onRunFailed?.({ error: wrappedAbort });
    });

    expect(result.current.error).toBeNull();
    expect(result.current.status).toBe('idle');
  });

  it('STILL surfaces genuine non-abort failures in the error banner', () => {
    const { result } = renderHook(
      () => useChatSession('default', { threadId: 'conv-uuid' }),
      { wrapper },
    );

    const built = mockInstances[mockInstances.length - 1];
    const subscriber = built.subscribe.mock.calls[0][0] as {
      onRunInitialized?: (arg: unknown) => void;
      onRunFailed?: (arg: { error: Error }) => void;
    };
    act(() => {
      subscriber.onRunInitialized?.({});
    });

    // The guard must not swallow real failures. Pin that an LLM-side
    // error (rate limit, 5xx, etc) still hits the banner.
    const realFailure = new Error('Rate limit exceeded');
    act(() => {
      subscriber.onRunFailed?.({ error: realFailure });
    });

    expect(result.current.status).toBe('error');
    expect(result.current.error).toBe('Rate limit exceeded');
  });
});

describe('useChatSession messages lazy useState init (M5.2 follow-up — blank-screen flicker guard)', () => {
  beforeEach(() => {
    mockInstances.length = 0;
    useAuthStore.setState({
      accessToken: 'test-token',
      user: {
        id: 'u1',
        email: 'a@b.com',
        name: null,
        identityProvider: 'local',
        settings: {},
      },
      isAuthenticated: true,
      bootstrapped: true,
    });
  });

  it('first observable render has the initialMessages seed already mapped — NOT an empty list', () => {
    // The pre-fix behavior was ``useState<ChatMessage[]>([])`` and
    // ``syncMessages()`` ran in a useEffect AFTER the first commit.
    // That meant the first render showed an empty scroll area for one
    // frame, producing the "blank screen" the user reported on every
    // conversation switch (since ``key={conversationId}`` on
    // ChatSurface forces a fresh mount, re-tripping the empty-state
    // initial render). The fix is lazy useState init from the
    // ``initialMessages`` prop. This test fails if a refactor reverts
    // to the empty initial value.
    const seed = [
      { id: 'persisted-user-1', role: 'user' as const, content: 'hello' },
      {
        id: 'persisted-asst-1',
        role: 'assistant' as const,
        content: 'hi back',
      },
    ];

    const { result } = renderHook(
      () =>
        useChatSession('default', {
          threadId: 'conv-uuid',
          initialMessages: seed,
        }),
      { wrapper },
    );

    // The observable state (after renderHook's first commit + first
    // effect) should reflect the seed. The lazy initializer made
    // commit-1 have the seed; the post-commit syncMessages reads
    // ``agent.messages`` which the mock (mirroring the real
    // HttpAgent) also seeded from ``initialMessages``. Either way,
    // the user-visible messages should NEVER be ``[]`` for a
    // re-mount with seed data.
    expect(result.current.messages).toHaveLength(2);
    expect(result.current.messages[0]).toMatchObject({
      id: 'persisted-user-1',
      role: 'user',
      content: 'hello',
    });
    expect(result.current.messages[1]).toMatchObject({
      id: 'persisted-asst-1',
      role: 'assistant',
      content: 'hi back',
    });
  });

  it('first render is an empty list when no initialMessages prop is provided (brand-new chat)', () => {
    // Defensive: brand-new chats from the landing handoff pass no
    // initialMessages. The lazy init must default cleanly to [] in
    // that case (i.e. not crash + not introduce stale state).
    const { result } = renderHook(
      () => useChatSession('default', { threadId: 'fresh-uuid' }),
      { wrapper },
    );

    expect(result.current.messages).toEqual([]);
  });
});

describe('useChatSession reasoning_content event (BE migration 0026)', () => {
  beforeEach(() => {
    mockInstances.length = 0;
    useAuthStore.setState({
      accessToken: 'test-token',
      user: {
        id: 'u1',
        email: 'a@b.com',
        name: null,
        identityProvider: 'local',
        settings: {},
      },
      isAuthenticated: true,
      bootstrapped: true,
    });
  });

  type Subscriber = {
    onCustomEvent?: (arg: { event: { name: string; value: unknown } }) => void;
    onTextMessageStartEvent?: (arg: { event: { messageId: string } }) => void;
  };

  function mountWithSeed(
    seed: Array<{ id: string; role: 'assistant'; content: string }>,
  ) {
    const { result } = renderHook(
      () =>
        useChatSession('default', {
          threadId: 'conv-uuid',
          initialMessages: seed,
        }),
      { wrapper },
    );
    const built = mockInstances[mockInstances.length - 1] as unknown as {
      subscribe: ReturnType<typeof vi.fn>;
    };
    const subscriber = built.subscribe.mock.calls[0][0] as Subscriber;
    return { result, subscriber };
  }

  it('stamps reasoning onto the message named by the event message_id', () => {
    const { result, subscriber } = mountWithSeed([
      { id: 'm1', role: 'assistant', content: 'The answer.' },
    ]);

    act(() => {
      subscriber.onCustomEvent?.({
        event: {
          name: 'reasoning_content',
          value: { message_id: 'm1', reasoning: 'My private trace.' },
        },
      });
    });

    const asst = result.current.messages.find((m) => m.id === 'm1');
    expect(asst?.reasoning).toBe('My private trace.');
  });

  it('falls back to the last TEXT_MESSAGE_START id when message_id is omitted', () => {
    const { result, subscriber } = mountWithSeed([
      { id: 'm2', role: 'assistant', content: 'Answer two.' },
    ]);

    act(() => {
      // The BE accumulator's _last_message_id mirror: the most recent
      // streaming start is the implicit target.
      subscriber.onTextMessageStartEvent?.({ event: { messageId: 'm2' } });
      subscriber.onCustomEvent?.({
        event: {
          name: 'reasoning_content',
          value: { reasoning: 'Implicit target trace.' },
        },
      });
    });

    const asst = result.current.messages.find((m) => m.id === 'm2');
    expect(asst?.reasoning).toBe('Implicit target trace.');
  });

  it('ignores a reasoning_content event carrying no reasoning string', () => {
    const { result, subscriber } = mountWithSeed([
      { id: 'm3', role: 'assistant', content: 'Answer three.' },
    ]);

    act(() => {
      subscriber.onCustomEvent?.({
        event: { name: 'reasoning_content', value: { message_id: 'm3' } },
      });
    });

    const asst = result.current.messages.find((m) => m.id === 'm3');
    expect(asst?.reasoning).toBeUndefined();
  });
});

describe('useChatSession streaming-turn set (fan-out smooth reveal)', () => {
  beforeEach(() => {
    mockInstances.length = 0;
    useAuthStore.setState({
      accessToken: 'test-token',
      user: {
        id: 'u1',
        email: 'a@b.com',
        name: null,
        identityProvider: 'local',
        settings: {},
      },
      isAuthenticated: true,
      bootstrapped: true,
    });
  });

  type StreamSub = {
    onRunInitialized?: (arg: unknown) => void;
    onRunFinalized?: (arg: unknown) => void;
    onTextMessageStartEvent?: (arg: { event: { messageId: string } }) => void;
    onTextMessageEndEvent?: (arg: { event: { messageId: string } }) => void;
  };

  it('tracks EVERY concurrently-streaming turn, not just the last (fan-out)', () => {
    const { result } = renderHook(
      () => useChatSession('default', { threadId: 'conv-uuid' }),
      { wrapper },
    );
    const built = mockInstances[mockInstances.length - 1] as unknown as {
      subscribe: ReturnType<typeof vi.fn>;
    };
    const sub = built.subscribe.mock.calls[0][0] as StreamSub;

    // Two sub-agent turns open their streams before either ends — the
    // shape a parallel fan-out produces. BOTH must be marked streaming;
    // the pre-fix "last assistant only" logic would have animated just one.
    act(() => {
      sub.onRunInitialized?.({});
      sub.onTextMessageStartEvent?.({ event: { messageId: 'fanout-a' } });
      sub.onTextMessageStartEvent?.({ event: { messageId: 'fanout-b' } });
    });
    expect(result.current.streamingMessageIds.has('fanout-a')).toBe(true);
    expect(result.current.streamingMessageIds.has('fanout-b')).toBe(true);

    // Each turn leaves the set independently as its own END arrives.
    act(() => {
      sub.onTextMessageEndEvent?.({ event: { messageId: 'fanout-a' } });
    });
    expect(result.current.streamingMessageIds.has('fanout-a')).toBe(false);
    expect(result.current.streamingMessageIds.has('fanout-b')).toBe(true);
  });

  it('clears the streaming set when the run settles', () => {
    const { result } = renderHook(
      () => useChatSession('default', { threadId: 'conv-uuid' }),
      { wrapper },
    );
    const built = mockInstances[mockInstances.length - 1] as unknown as {
      subscribe: ReturnType<typeof vi.fn>;
    };
    const sub = built.subscribe.mock.calls[0][0] as StreamSub;

    act(() => {
      sub.onRunInitialized?.({});
      sub.onTextMessageStartEvent?.({ event: { messageId: 'm1' } });
    });
    expect(result.current.streamingMessageIds.size).toBe(1);

    // RUN_FINISHED is a backstop even if a trailing END never arrived.
    act(() => {
      sub.onRunFinalized?.({});
    });
    expect(result.current.streamingMessageIds.size).toBe(0);
  });
});
