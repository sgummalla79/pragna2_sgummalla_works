import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import { useServices } from '@/presentation/providers/ServiceContext';
import type { Conversation } from '@/domain/types/conversation.types';

/**
 * Resolve a single conversation by id.
 *
 * The backend doesn't expose a dedicated ``GET /api/conversations/{id}``
 * endpoint; we derive the single conversation from the list query.
 * Reasoning:
 *
 *   1. The sidebar already lists conversations on mount, so for the common
 *      "click a row in the sidebar" navigation the data is already cached.
 *   2. For deep-link navigation to ``/chat/:id`` (no prior list load), the
 *      list fetch is one round-trip; the same as a single-fetch would be.
 *   3. Skipping the dedicated endpoint keeps the backend surface narrower.
 *
 * Returns ``undefined`` for ``data`` when the id isn't in the list (the
 * user's session never owned this conversation, or it was just deleted).
 * Callers should fall back to "New conversation" header state in that case.
 */
export function useConversation(
  conversationId: string | undefined,
): UseQueryResult<Conversation | undefined> {
  const { conversationService } = useServices();

  return useQuery<Conversation | undefined>({
    queryKey: ['conversations', conversationId ?? '__none__', 'single'],
    queryFn: async () => {
      if (!conversationId) return undefined;
      // Fetch a generous page so most users have their target conversation
      // in the first response without paging.
      const list = await conversationService.list({ limit: 200, offset: 0 });
      return list.find((c) => c.id === conversationId);
    },
    enabled: Boolean(conversationId),
    staleTime: 30_000,
  });
}
