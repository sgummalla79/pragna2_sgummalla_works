import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useServices } from '@/presentation/providers/ServiceContext';

/**
 * Mutations against a single conversation: rename, change active model,
 * delete.
 *
 * Each mutation invalidates ``['conversations']`` on success so any
 * sidebar list-rendering hook (currently :func:`useConversations`)
 * re-fetches and reflects the change. Optimistic updates are deliberately
 * left out for R1 to keep the surface small — TanStack default behaviour
 * (refetch on success) is responsive enough for sidebar-level edits.
 */

/** Rename a conversation. */
export function useRenameConversation() {
  const { conversationService } = useServices();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, title }: { id: string; title: string }) =>
      conversationService.update(id, { title }),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['conversations'] });
      qc.invalidateQueries({ queryKey: ['conversations', vars.id] });
    },
  });
}

/** Change the active model for a conversation; next turn uses the new one. */
export function useSetConversationModel() {
  const { conversationService } = useServices();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, userModelId }: { id: string; userModelId: string }) =>
      conversationService.update(id, { userModelId }),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['conversations'] });
      qc.invalidateQueries({ queryKey: ['conversations', vars.id] });
    },
  });
}

/** Hard-delete a conversation. FK cascade removes messages + usage rows. */
export function useDeleteConversation() {
  const { conversationService } = useServices();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => conversationService.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['conversations'] });
    },
  });
}

/**
 * R4 #1. Delete the chosen message and every message after it.
 *
 * Backs Regenerate (truncate the assistant turn, then the caller
 * re-runs the prior user message through the /pragna stream) and
 * Edit (truncate the user turn, then the caller re-submits with
 * the edited text). On success invalidates the messages query for
 * the conversation so the chat surface re-renders from a fresh
 * server fetch — keeps the local list in lock-step with the truncated
 * server state without optimistic-update bookkeeping.
 */
export function useTruncateFromMessage() {
  const { conversationService } = useServices();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ conversationId, messageId }: { conversationId: string; messageId: string }) =>
      conversationService.truncateFrom(conversationId, messageId),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({
        queryKey: ['conversations', vars.conversationId, 'messages'],
      });
    },
  });
}

/**
 * R4 #1. Fork the conversation at the chosen message; returns the
 * new conversation so the caller can navigate to ``/chat/{id}``.
 * Invalidates the conversation list so the new fork shows up in the
 * sidebar immediately.
 */
export function useBranchConversation() {
  const { conversationService } = useServices();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ conversationId, messageId }: { conversationId: string; messageId: string }) =>
      conversationService.branch(conversationId, messageId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['conversations'] });
    },
  });
}
