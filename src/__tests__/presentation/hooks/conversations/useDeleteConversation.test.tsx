/**
 * Tests for ``useDeleteConversation``.
 *
 * The mutation does three load-bearing things that this test pins:
 *
 *   1. ``onMutate`` cancels in-flight queries scoped to this conversation
 *      so a refetch in flight when DELETE is fired doesn't land AFTER
 *      the row is dropped (which would be a 404).
 *   2. ``onSuccess`` invalidates ``['conversations']`` (sidebar refresh).
 *   3. ``onSuccess`` REMOVES the ``['conversations', id]`` subtree from
 *      cache so no later refetch can fire against the gone row.
 *
 * If any of these regress, the three 404s users used to see after
 * delete (/messages /usage /episodes) come back. Tests pin the
 * mutation-side fix; the race-guards inside the hooks remain as
 * multi-tab safety nets.
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

  it('invalidates the conversations list on success (sidebar refresh)', async () => {
    const { wrapper, invalidateSpy } = setup();
    const { result } = renderHook(() => useDeleteConversation(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync(CONVERSATION_ID);
    });

    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ['conversations'],
    });
  });

  it('REMOVES the conversation-scoped cache subtree on success', async () => {
    const { wrapper, removeSpy } = setup();
    const { result } = renderHook(() => useDeleteConversation(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync(CONVERSATION_ID);
    });

    // removeQueries (NOT invalidateQueries) — invalidate would mark
    // stale + trigger a refetch that hits 404; remove evicts so no
    // refetch can fire. This is the single most important assertion
    // for the post-delete 404 fix.
    expect(removeSpy).toHaveBeenCalledWith({
      queryKey: ['conversations', CONVERSATION_ID],
    });
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
