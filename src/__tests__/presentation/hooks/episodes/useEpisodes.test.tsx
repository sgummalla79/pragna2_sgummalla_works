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
