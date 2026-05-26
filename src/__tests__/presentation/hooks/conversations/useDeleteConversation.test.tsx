/**
 * Tests for ``useDeleteConversation``.
 *
 * The mutation does three load-bearing things that this test pins:
 *
 *   1. ``onMutate`` cancels in-flight queries scoped to this conversation
 *      so a refetch in flight when DELETE is fired doesn't land AFTER
 *      the row is dropped (which would be a 404).
 *   2. ``onSuccess`` invalidates ONLY list queries (length-2 keys like
 *      ``['conversations', 0]`` and ``['conversations', 'pinned']``).
 *      A broad ``invalidateQueries({ queryKey: ['conversations'] })``
 *      prefix-matches the per-conv subtree (``['conversations', id,
 *      'usage']`` etc.) and triggers refetches on still-mounted
 *      observers → 404. Hence the predicate-based scoping.
 *   3. ``onSuccess`` does NOT call ``removeQueries`` on the per-conv
 *     subtree. react-query's documented behaviour: removing a cache
 *     entry that has active subscribers triggers an immediate refetch
 *     on those subscribers → 404. The sidebar's
 *     ``useConversationUsage(deletedId)`` observer is still mounted
 *     when ``onSuccess`` runs; it detaches naturally when the list
 *     refetch removes the row and the sidebar re-renders.
 *
 * If any of these regress, the /usage 404 users used to see after
 * deleting the active conversation comes back.
 */

import { describe, it, expect, vi, type Mock } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useDeleteConversation } from '@/presentation/hooks/conversations/useConversationMutations';
import {
  ServiceContext,
  type Services,
} from '@/presentation/providers/ServiceContext';

const CONVERSATION_ID = 'conv-to-delete';

function setup(opts: { deleteImpl?: (id: string) => Promise<void> } = {}) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const deleteMock: Mock = vi.fn(
    opts.deleteImpl ?? ((_id: string) => Promise.resolve()),
  );
  const services = {
    conversationService: { delete: deleteMock },
  } as unknown as Services;
  const cancelSpy = vi.spyOn(qc, 'cancelQueries');
  const invalidateSpy = vi.spyOn(qc, 'invalidateQueries');
  const removeSpy = vi.spyOn(qc, 'removeQueries');
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}>
      <ServiceContext.Provider value={services}>
        {children}
      </ServiceContext.Provider>
    </QueryClientProvider>
  );
  return { wrapper, qc, deleteMock, cancelSpy, invalidateSpy, removeSpy };
}

describe('useDeleteConversation', () => {
  it('cancels in-flight conversation-scoped queries BEFORE the DELETE fires', async () => {
    const { wrapper, deleteMock, cancelSpy } = setup();
    const { result } = renderHook(() => useDeleteConversation(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync(CONVERSATION_ID);
    });

    // cancelQueries must be called with the conversation-scoped prefix
    // BEFORE the actual DELETE round-trip. Without this, a refetch in
    // flight when DELETE is fired can land AFTER row removal → 404.
    expect(cancelSpy).toHaveBeenCalledWith({
      queryKey: ['conversations', CONVERSATION_ID],
    });
    // Ordering: cancel must precede the service call.
    const cancelOrder = cancelSpy.mock.invocationCallOrder[0];
    const deleteOrder = deleteMock.mock.invocationCallOrder[0];
    expect(cancelOrder).toBeLessThan(deleteOrder);
  });

  it('invalidates ONLY list queries on success (predicate-scoped)', async () => {
    const { wrapper, invalidateSpy } = setup();
    const { result } = renderHook(() => useDeleteConversation(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync(CONVERSATION_ID);
    });

    // Predicate must be present — broad ``queryKey: ['conversations']``
    // is the wrong shape (prefix-matches the per-conv subtree). Verify
    // the actual call used a ``predicate`` function.
    expect(invalidateSpy).toHaveBeenCalledTimes(1);
    const call = invalidateSpy.mock.calls[0][0] as {
      predicate?: (q: { queryKey: readonly unknown[] }) => boolean;
      queryKey?: unknown;
    };
    expect(call.predicate).toBeTypeOf('function');
    expect(call.queryKey).toBeUndefined();

    // Spot-check the predicate's behaviour:
    //   - ``['conversations', 0]`` (paged list) → true
    //   - ``['conversations', 'pinned']`` (pinned list) → true
    //   - ``['conversations', '<id>', 'usage']`` (per-conv) → false
    //   - ``['conversations', '<id>', 'messages']`` (per-conv) → false
    //   - ``['providers']`` (unrelated) → false
    const predicate = call.predicate!;
    expect(predicate({ queryKey: ['conversations', 0] })).toBe(true);
    expect(predicate({ queryKey: ['conversations', 'pinned'] })).toBe(true);
    expect(predicate({ queryKey: ['conversations', CONVERSATION_ID, 'usage'] })).toBe(false);
    expect(predicate({ queryKey: ['conversations', CONVERSATION_ID, 'messages'] })).toBe(false);
    expect(predicate({ queryKey: ['providers'] })).toBe(false);
  });

  it('does NOT call removeQueries on the per-conv subtree', async () => {
    const { wrapper, removeSpy } = setup();
    const { result } = renderHook(() => useDeleteConversation(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync(CONVERSATION_ID);
    });

    // ``removeQueries`` on an actively-subscribed cache entry
    // triggers an immediate refetch on the subscriber (react-query's
    // documented behaviour). The sidebar's
    // ``useConversationUsage(deletedId)`` observer is still mounted
    // at this point — if we removed its cache, it would refetch
    // → 404. Cache cleanup happens via natural unmount once the list
    // refetch removes the row from the sidebar.
    expect(removeSpy).not.toHaveBeenCalled();
  });

  it('does NOT invalidate or remove cache on DELETE failure', async () => {
    const { wrapper, invalidateSpy, removeSpy } = setup({
      deleteImpl: () => Promise.reject(new Error('500 BE down')),
    });
    const { result } = renderHook(() => useDeleteConversation(), { wrapper });

    await expect(
      act(async () => {
        await result.current.mutateAsync(CONVERSATION_ID);
      }),
    ).rejects.toThrow(/500/);

    // Pre-mutate cancel can fire (defensive); post-success cache
    // mutations MUST NOT — the row still exists in the DB so the
    // FE cache should still reflect it.
    expect(invalidateSpy).not.toHaveBeenCalled();
    expect(removeSpy).not.toHaveBeenCalled();
  });
});
