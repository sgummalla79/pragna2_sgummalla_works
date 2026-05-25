import { useQuery } from '@tanstack/react-query';
import { useServices } from '@/presentation/providers/ServiceContext';
import type { PersistedMessage } from '@/domain/types/conversation.types';

const KEY = (id: string | undefined) =>
  ['conversations', id ?? '__none__', 'messages'] as const;

interface UseConversationMessagesOptions {
  /**
   * When ``false``, suppress the network fetch entirely (data stays
   * ``undefined``). The session view passes ``false`` for brand-new
   * conversations whose row hasn't been persisted yet, to avoid a
   * structurally-guaranteed 404 polluting the browser console.
   * Defaults to ``true``.
   */
  enabled?: boolean;
}

/**
 * Fetch the persisted message log for a conversation.
 *
 * Disabled when ``conversationId`` is ``undefined`` (callers that aren't on
 * a ``/chat/:id`` route) OR when ``options.enabled`` is explicitly
 * ``false`` (brand-new conversation mid-handoff).
 *
 * History is effectively immutable from the client's perspective: once a
 * turn lands in the table it never rewrites, so ``staleTime: Infinity`` is
 * the right cache policy — we'll only refetch on explicit invalidation.
 *
 * Invalidation hooks:
 *   - When ``useChatSession`` finishes a new turn, it invalidates this key
 *     so the next mount sees the newly-persisted messages. In practice
 *     the chat surface keeps its in-memory ``HttpAgent.messages`` as the
 *     source of truth during an active session, so this hook only really
 *     matters on resume.
 */
export function useConversationMessages(
  conversationId: string | undefined,
  options: UseConversationMessagesOptions = {},
) {
  const { conversationService } = useServices();
  const enabled = (options.enabled ?? true) && Boolean(conversationId);
  return useQuery<PersistedMessage[]>({
    queryKey: KEY(conversationId),
    // 404 → empty list is handled at the REPO layer
    // (``ConversationRepository.getMessages``) as a race-guard. Hook
    // queryFn stays simple — never sees a 404.
    queryFn: () => conversationService.getMessages(conversationId!),
    enabled,
    staleTime: Infinity,
  });
}
