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
 * Returns ``null`` for ``data`` when the id isn't in the list (the
 * user's session never owned this conversation, OR — the common case
 * during the landing → session handoff — the row hasn't been persisted
 * yet because the user is still mid-send). ``null`` rather than
 * ``undefined`` because TanStack Query rejects ``undefined`` returns
 * from a queryFn ("Query data cannot be undefined"). Callers should
 * fall back to "New conversation" header state when ``data`` is nullish.
 */
export function useConversation(
  conversationId: string | undefined,
): UseQueryResult<Conversation | null> {
  const { conversationService } = useServices();

  return useQuery<Conversation | null>({
    queryKey: ['conversations', conversationId ?? '__none__', 'single'],
    queryFn: async () => {
      if (!conversationId) return null;
      // Fetch a generous page so most users have their target conversation
      // in the first response without paging.
      const list = await conversationService.list({ limit: 200, offset: 0 });
      return list.find((c) => c.id === conversationId) ?? null;
    },
    enabled: Boolean(conversationId),
    staleTime: 30_000,
  });
}
