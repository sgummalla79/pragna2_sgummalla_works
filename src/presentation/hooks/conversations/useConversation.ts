import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import { useServices } from '@/presentation/providers/ServiceContext';
import type { Conversation } from '@/domain/types/conversation.types';

/**
 * Resolve a single conversation by id from the dedicated
 * ``GET /api/conversations/{id}`` endpoint.
 *
 * Drives the chat-header title + the model-picker + the extended-
 * thinking toggle on the chat surface — anywhere we need the
 * conversation row's persisted shape independent of the message
 * stream.
 *
 * Returns ``null`` for ``data`` when the id isn't owned by the
 * authenticated user OR the row doesn't exist (the repo maps BE 404
 * to ``null``). ``null`` rather than ``undefined`` because TanStack
 * Query rejects ``undefined`` returns from a queryFn ("Query data
 * cannot be undefined"). Callers fall back to "New chat" header state
 * when ``data`` is nullish.
 *
 * 2026-05-27 — switched from "filter from sidebar list cache" to a
 * dedicated network fetch. The cache-derived path raced with
 * ``useChatSession.onRunFinalized``'s invalidation: the single-conv
 * lookup re-read the sidebar cache BEFORE the sidebar's own refetch
 * landed, repopulating its own cache with the stale pre-title row.
 * Result: freshly-titled conversations stuck on the "New chat"
 * placeholder until manual refresh. The dedicated endpoint eliminates
 * the cache-coordination race — the hook's refetch goes straight to
 * the DB and gets the post-title-flow row regardless of sidebar
 * timing.
 */
export function useConversation(
  conversationId: string | undefined,
): UseQueryResult<Conversation | null> {
  const { conversationService } = useServices();

  return useQuery<Conversation | null>({
    queryKey: ['conversations', conversationId ?? '__none__', 'single'],
    queryFn: async () => {
      if (!conversationId) return null;
      return conversationService.get(conversationId);
    },
    enabled: Boolean(conversationId),
    staleTime: 30_000,
  });
}
