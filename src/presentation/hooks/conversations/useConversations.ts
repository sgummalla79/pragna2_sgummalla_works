import { useQuery, type QueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { useServices } from '@/presentation/providers/ServiceContext';
import { DEFAULT_PAGE_SIZE } from '@/constants/pagination';
import type { ConversationUsage } from '@/domain/types/conversation.types';

const CONVERSATIONS_KEY = (page: number) => ['conversations', page] as const;
const PINNED_KEY = ['conversations', 'pinned'] as const;
const USAGE_KEY = (id: string) => ['conversations', id, 'usage'] as const;

/**
 * Invalidate ONLY the sidebar list queries (and optionally one
 * specific conversation's ``single`` lookup) — NEVER the per-conv
 * ``messages`` / ``usage`` / ``episodes`` subtree.
 *
 * Background-Run Execution M5.2 follow-up — the previous pattern at
 * every mutation onSuccess + at ``useChatSession.onRunFinalized`` was
 * ``qc.invalidateQueries({ queryKey: ['conversations'] })`` (prefix
 * match). That cascaded into EVERY per-conv subquery for EVERY
 * conversation in the cache: messages, usage, episodes — for unrelated
 * chats too. Single conversation switch fired ~27 BE requests in 7s
 * because of this.
 *
 * The narrow predicate matches:
 *   - sidebar list pages: ``['conversations', <pageNumber>]``
 *   - pinned list: ``['conversations', 'pinned']``
 *   - (optional) the named conversation's single-lookup, used by the
 *     chat header: ``['conversations', <id>, 'single']``
 *
 * Per-conv subtrees are owned by their respective mutation paths
 * (``useTruncateFromMessage``, ``useResumeEpisode``, etc.) — let them
 * invalidate explicitly where it matters. Don't blanket-cascade here.
 */
export function invalidateConversationListQueries(
  qc: QueryClient,
  options: { conversationId?: string } = {},
): void {
  const targetId = options.conversationId;
  qc.invalidateQueries({
    predicate: (q) => {
      const k = q.queryKey;
      if (!Array.isArray(k) || k[0] !== 'conversations') return false;
      // Sidebar list pages.
      if (k.length === 2 && typeof k[1] === 'number') return true;
      // Pinned list.
      if (k.length === 2 && k[1] === 'pinned') return true;
      // Named conversation's single-lookup (chat header title).
      if (
        targetId
        && k.length === 3
        && k[1] === targetId
        && k[2] === 'single'
      ) {
        return true;
      }
      return false;
    },
  });
}

export function useConversations(page = 0) {
  const { conversationService } = useServices();
  return useQuery({
    queryKey: CONVERSATIONS_KEY(page),
    queryFn: () =>
      conversationService.list({
        limit: DEFAULT_PAGE_SIZE,
        offset: page * DEFAULT_PAGE_SIZE,
      }),
    // Background-Run Execution M5.2 follow-up — the sidebar list is
    // hot-path on every mount, and used to refetch on every mount with
    // staleTime: 0 (~5+ duplicate hits per conversation switch in dev).
    // 30s matches the pattern in useTools / useUserAgents / useModels.
    // Mutations that genuinely change the list (auto-title arrival,
    // pin/unpin, delete) still invalidate this key explicitly via
    // useConversationMutations / useChatSession.onRunFinalized.
    staleTime: 30_000,
  });
}

/**
 * Pinned conversations only — used by the sidebar's "Pinned" group.
 * Loaded as a single request (no pagination); typical pin counts are
 * small enough that a hard cap isn't needed. Ordered by ``pinned_at``
 * desc server-side.
 */
export function usePinnedConversations() {
  const { conversationService } = useServices();
  return useQuery({
    queryKey: PINNED_KEY,
    queryFn: () =>
      conversationService.list({
        limit: DEFAULT_PAGE_SIZE,
        offset: 0,
        pinned: true,
      }),
    // Same rationale as ``useConversations`` above.
    staleTime: 30_000,
  });
}

export function useConversationUsage(conversationId: string) {
  const { conversationService } = useServices();
  return useQuery<ConversationUsage>({
    queryKey: USAGE_KEY(conversationId),
    queryFn: async () => {
      try {
        return await conversationService.getUsage(conversationId);
      } catch (e) {
        // Race-guard (NOT a lazy-create workaround). Eager creation
        // means a fresh conversation has its row before the chat
        // surface mounts. Remaining 404 cases: (1) active-delete
        // race (DELETE 204 → in-flight refetch → navigate), (2) cost
        // chip on a sidebar row that was just deleted in another tab,
        // (3) multi-tab delete. Zero-state is the right response —
        // no conversation means no usage.
        if (axios.isAxiosError(e) && e.response?.status === 404) {
          return {
            conversationId,
            records: [],
            totalInputTokens: 0,
            totalOutputTokens: 0,
            totalCostUsd: '0',
          };
        }
        throw e;
      }
    },
    staleTime: 60_000,
    enabled: Boolean(conversationId),
  });
}
