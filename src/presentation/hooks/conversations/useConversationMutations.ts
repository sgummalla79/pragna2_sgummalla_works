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
