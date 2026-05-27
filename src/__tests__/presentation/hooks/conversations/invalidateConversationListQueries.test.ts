import { describe, it, expect } from 'vitest';
import { QueryClient } from '@tanstack/react-query';
import { invalidateConversationListQueries } from '@/presentation/hooks/conversations/useConversations';

/**
 * Background-Run Execution M5.2 follow-up regression test.
 *
 * Pins the SCOPE of ``invalidateConversationListQueries``. The pre-fix
 * behavior at all 5 invalidation sites (useChatSession.onRunFinalized
 * + 4 conv mutations) was a blanket ``invalidateQueries({ queryKey:
 * ['conversations'] })`` — a prefix match that cascaded into EVERY
 * per-conv subquery (messages, usage, episodes, single) for EVERY
 * conversation in the cache. Single conversation switch produced ~27
 * BE requests in 7s. This test fails loudly if the helper's predicate
 * widens back to that behavior.
 */
describe('invalidateConversationListQueries (M5.2 follow-up — request-storm guard)', () => {
  function seedCache(qc: QueryClient) {
    // Sidebar lists.
    qc.setQueryData(['conversations', 0], [{ id: 'sidebar-page-0' }]);
    qc.setQueryData(['conversations', 1], [{ id: 'sidebar-page-1' }]);
    qc.setQueryData(['conversations', 'pinned'], [{ id: 'pinned-row' }]);

    // Per-conv subtrees for TWO distinct conversations.
    for (const cid of ['conv-A', 'conv-B']) {
      qc.setQueryData(['conversations', cid, 'single'], { id: cid });
      qc.setQueryData(['conversations', cid, 'messages'], []);
      qc.setQueryData(['conversations', cid, 'usage'], { records: [] });
      qc.setQueryData(['conversations', cid, 'episodes'], { episodes: [] });
    }

    // Off-prefix sanity entry — must NEVER be touched.
    qc.setQueryData(['tools'], []);
  }

  function stalenessMap(qc: QueryClient): Record<string, boolean> {
    const queries = qc.getQueryCache().findAll();
    const out: Record<string, boolean> = {};
    for (const q of queries) {
      out[JSON.stringify(q.queryKey)] = q.state.isInvalidated;
    }
    return out;
  }

  it('invalidates sidebar list pages + pinned list + (optionally) one single-lookup; NOT the per-conv subtrees', () => {
    const qc = new QueryClient();
    seedCache(qc);

    invalidateConversationListQueries(qc, { conversationId: 'conv-A' });

    const stale = stalenessMap(qc);

    // Must be invalidated:
    expect(stale[JSON.stringify(['conversations', 0])]).toBe(true);
    expect(stale[JSON.stringify(['conversations', 1])]).toBe(true);
    expect(stale[JSON.stringify(['conversations', 'pinned'])]).toBe(true);
    expect(stale[JSON.stringify(['conversations', 'conv-A', 'single'])]).toBe(
      true,
    );

    // MUST NOT be invalidated (the 27-requests bug). Each entry below
    // is a guard against accidental prefix-widening back to
    // ``invalidateQueries({ queryKey: ['conversations'] })``.
    expect(
      stale[JSON.stringify(['conversations', 'conv-A', 'messages'])],
    ).toBe(false);
    expect(stale[JSON.stringify(['conversations', 'conv-A', 'usage'])]).toBe(
      false,
    );
    expect(
      stale[JSON.stringify(['conversations', 'conv-A', 'episodes'])],
    ).toBe(false);
    // Unrelated conversation MUST be entirely untouched — including
    // its single-lookup (the helper only invalidates the NAMED conv's
    // single).
    expect(stale[JSON.stringify(['conversations', 'conv-B', 'single'])]).toBe(
      false,
    );
    expect(
      stale[JSON.stringify(['conversations', 'conv-B', 'messages'])],
    ).toBe(false);
    expect(stale[JSON.stringify(['conversations', 'conv-B', 'usage'])]).toBe(
      false,
    );

    // Off-prefix sanity.
    expect(stale[JSON.stringify(['tools'])]).toBe(false);
  });

  it('without a conversationId, invalidates list pages + pinned only — no single-lookup', () => {
    const qc = new QueryClient();
    seedCache(qc);

    // Used by useBranchConversation + useDeleteConversation paths
    // (new fork / removed row — no specific single-lookup to refresh).
    invalidateConversationListQueries(qc);

    const stale = stalenessMap(qc);
    expect(stale[JSON.stringify(['conversations', 0])]).toBe(true);
    expect(stale[JSON.stringify(['conversations', 1])]).toBe(true);
    expect(stale[JSON.stringify(['conversations', 'pinned'])]).toBe(true);

    // No single-lookup invalidated when no id is passed.
    expect(stale[JSON.stringify(['conversations', 'conv-A', 'single'])]).toBe(
      false,
    );
    expect(stale[JSON.stringify(['conversations', 'conv-B', 'single'])]).toBe(
      false,
    );

    // Per-conv subtrees still untouched.
    expect(
      stale[JSON.stringify(['conversations', 'conv-A', 'messages'])],
    ).toBe(false);
    expect(
      stale[JSON.stringify(['conversations', 'conv-B', 'messages'])],
    ).toBe(false);
  });
});
