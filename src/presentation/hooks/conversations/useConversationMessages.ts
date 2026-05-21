import { useQuery } from '@tanstack/react-query';
import { useServices } from '@/presentation/providers/ServiceContext';
import type { PersistedMessage } from '@/domain/types/conversation.types';

const KEY = (id: string | undefined) =>
  ['conversations', id ?? '__none__', 'messages'] as const;

/**
 * Fetch the persisted message log for a conversation.
 *
 * Disabled when ``conversationId`` is ``undefined`` (the ``/chat/new`` route).
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
export function useConversationMessages(conversationId: string | undefined) {
  const { conversationService } = useServices();
  return useQuery<PersistedMessage[]>({
    queryKey: KEY(conversationId),
    queryFn: () => conversationService.getMessages(conversationId!),
    enabled: Boolean(conversationId),
    staleTime: Infinity,
  });
}
