import { describe, it, expect, vi } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  useCancelEpisode,
  openEpisodeQueryKey,
  episodeQueryKey,
} from '@/presentation/hooks/episodes/useEpisodes';
import {
  ServiceContext,
  type Services,
} from '@/presentation/providers/ServiceContext';

const CONVERSATION_ID = 'conv-1';
const EPISODE_ID = 'ep-1';

function makeWrapper(opts: {
  cancelImpl?: (conversationId: string, episodeId: string) => Promise<unknown>;
}) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const cancel = vi.fn(
    opts.cancelImpl ??
      ((_cid: string, _eid: string) => Promise.resolve()),
  );
  const services = {
    episodeService: { cancel },
  } as unknown as Services;
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}>
      <ServiceContext.Provider value={services}>
        {children}
      </ServiceContext.Provider>
    </QueryClientProvider>
  );
  return { wrapper, qc, cancel };
}

describe('useCancelEpisode (R7.1#2 — DELETE /api/conversations/{id}/episodes/{ep_id})', () => {
  it('calls episodeService.cancel(conversationId, episodeId) on mutate', async () => {
    const { wrapper, cancel } = makeWrapper({});
    const { result } = renderHook(
      () => useCancelEpisode(CONVERSATION_ID, EPISODE_ID),
      { wrapper },
    );

    await act(async () => {
      await result.current.mutateAsync();
    });

    expect(cancel).toHaveBeenCalledTimes(1);
    expect(cancel).toHaveBeenCalledWith(CONVERSATION_ID, EPISODE_ID);
  });

  it('throws when conversationId or episodeId is missing — guards the FE against firing a malformed DELETE', async () => {
    const { wrapper, cancel } = makeWrapper({});
    const { result } = renderHook(
      () => useCancelEpisode(undefined, EPISODE_ID),
      { wrapper },
    );

    await expect(result.current.mutateAsync()).rejects.toThrow(/required/i);
    expect(cancel).not.toHaveBeenCalled();
  });

  it('invalidates open-episode + messages + per-episode queries on settle', async () => {
    const { wrapper, qc, cancel } = makeWrapper({});
    const invalidateSpy = vi.spyOn(qc, 'invalidateQueries');
    void cancel;

    const { result } = renderHook(
      () => useCancelEpisode(CONVERSATION_ID, EPISODE_ID),
      { wrapper },
    );

    await act(async () => {
      await result.current.mutateAsync();
    });

    // All three settle invalidations fire so the UI converges to the
    // post-cancel state without manual refetch.
    const calls = invalidateSpy.mock.calls.map((args) => args[0]);
    expect(calls).toContainEqual({
      queryKey: openEpisodeQueryKey(CONVERSATION_ID),
    });
    expect(calls).toContainEqual({
      queryKey: ['conversations', CONVERSATION_ID, 'messages'],
    });
    expect(calls).toContainEqual({
      queryKey: episodeQueryKey(CONVERSATION_ID, EPISODE_ID),
    });
  });

  it('still invalidates on cancel failure so the UI re-fetches authoritative state', async () => {
    const { wrapper, qc } = makeWrapper({
      cancelImpl: () => Promise.reject(new Error('409 already terminal')),
    });
    const invalidateSpy = vi.spyOn(qc, 'invalidateQueries');

    const { result } = renderHook(
      () => useCancelEpisode(CONVERSATION_ID, EPISODE_ID),
      { wrapper },
    );

    await expect(
      act(async () => {
        await result.current.mutateAsync();
      }),
    ).rejects.toThrow(/409/);

    await waitFor(() => {
      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: openEpisodeQueryKey(CONVERSATION_ID),
      });
    });
  });
});


/* ── useOpenEpisode 404 handling ───────────────────────────────────────
 * A fresh "+ New chat" generates a client-side thread_id. The
 * conversation row is created lazily on first send, so the FE's initial
 * useOpenEpisode query against /api/conversations/{id}/episodes returns
 * 404 (conversation doesn't exist yet for this user). That 404 is the
 * natural "no open episode" state — not a query error.
 */

import { useOpenEpisode } from '@/presentation/hooks/episodes/useEpisodes';

describe('useOpenEpisode — fresh-conversation 404 handling', () => {
  function makeListWrapper(opts: {
    listImpl: (
      conversationId: string,
      params: { limit?: number; offset?: number },
    ) => Promise<unknown>;
  }) {
    const qc = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const list = vi.fn(opts.listImpl);
    const services = {
      episodeService: { list },
    } as unknown as Services;
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={qc}>
        <ServiceContext.Provider value={services}>
          {children}
        </ServiceContext.Provider>
      </QueryClientProvider>
    );
    return { wrapper, qc, list };
  }

  /** Build an axios-shaped error with a given HTTP status. The hook's
   *  catch arm uses ``axios.isAxiosError`` so the shape (``isAxiosError:
   *  true`` + ``response.status``) is what matters. */
  function axiosLikeError(status: number): Error & {
    isAxiosError: boolean;
    response: { status: number };
  } {
    const err = new Error(`HTTP ${status}`) as Error & {
      isAxiosError: boolean;
      response: { status: number };
    };
    err.isAxiosError = true;
    err.response = { status };
    return err;
  }

  it('returns null when the episodes list endpoint 404s — the fresh-chat case', async () => {
    const { wrapper, list } = makeListWrapper({
      listImpl: () => Promise.reject(axiosLikeError(404)),
    });

    const { result } = renderHook(() => useOpenEpisode(CONVERSATION_ID), {
      wrapper,
    });

    // Query resolves (not in error state) and returns null.
    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
    expect(result.current.data).toBeNull();
    expect(result.current.isError).toBe(false);
    expect(list).toHaveBeenCalledTimes(1);
  });

  it('propagates non-404 errors so genuine failures stay visible', async () => {
    const { wrapper } = makeListWrapper({
      listImpl: () => Promise.reject(axiosLikeError(500)),
    });

    const { result } = renderHook(() => useOpenEpisode(CONVERSATION_ID), {
      wrapper,
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });
    // A 500 must not be silently swallowed — that would mask BE bugs.
    expect(result.current.data).toBeUndefined();
  });

  it('skips the query entirely when conversationId is undefined', async () => {
    const { wrapper, list } = makeListWrapper({
      listImpl: () => Promise.resolve({ episodes: [], limit: 1, offset: 0 }),
    });

    const { result } = renderHook(() => useOpenEpisode(undefined), {
      wrapper,
    });

    // ``enabled: false`` keeps the query in idle (fetchStatus 'idle')
    // and the queryFn never runs.
    expect(result.current.fetchStatus).toBe('idle');
    expect(list).not.toHaveBeenCalled();
  });
});
