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

/**
 * Toggle the per-user pin flag on a conversation. Pinning stamps
 * ``pinned_at = now()`` server-side; unpinning clears it. Invalidates
 * both the paginated conversation list AND the pinned-only query so
 * the sidebar's Pinned section refreshes immediately.
 */
export function useSetPinned() {
  const { conversationService } = useServices();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, pinned }: { id: string; pinned: boolean }) =>
      conversationService.update(id, { pinned }),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['conversations'] });
      qc.invalidateQueries({ queryKey: ['conversations', vars.id] });
    },
  });
}

/**
 * Toggle the per-conversation Anthropic extended-thinking flag.
 *
 * Persistence only at this stage — the backend column round-trips
 * through PATCH but does not yet propagate to the Anthropic LLM call.
 * Tracked as a follow-up.
 */
export function useSetThinkingEnabled() {
  const { conversationService } = useServices();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, thinkingEnabled }: { id: string; thinkingEnabled: boolean }) =>
      conversationService.update(id, { thinkingEnabled }),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['conversations'] });
      qc.invalidateQueries({ queryKey: ['conversations', vars.id] });
    },
  });
}

/** Hard-delete a conversation. FK cascade removes messages + usage rows.
 *
 * Cache lifecycle is the load-bearing detail here. Two earlier shapes
 * were wrong, both because they triggered refetches against
 * still-mounted observers:
 *
 *   * ``removeQueries({ queryKey: ['conversations', id] })`` —
 *     react-query's documented behaviour: removing a cache entry that
 *     has ACTIVE subscribers triggers an immediate refetch on those
 *     subscribers (unless ``staleTime: Infinity``). The sidebar's
 *     ``useConversationUsage(deletedId)`` observer in
 *     ``ConversationListItem`` was still mounted when ``onSuccess``
 *     ran → refetch → 404 in the network tab.
 *   * ``invalidateQueries({ queryKey: ['conversations'] })`` (broad
 *     prefix match) — invalidates EVERY key starting with
 *     ``['conversations']``, including ``['conversations', id, …]``.
 *     Same outcome: still-mounted observers refetch immediately.
 *
 * Correct pattern (the one this hook ships):
 *
 *   * **onMutate (pre-DELETE):** ``cancelQueries`` on the per-conv
 *     subtree to abort any in-flight refetch that would otherwise
 *     land AFTER the BE has dropped the row.
 *   * **onSuccess (post-DELETE):** invalidate ONLY the list queries
 *     (``['conversations', 0]``, ``['conversations', 'pinned']``,
 *     etc. — length-2 keys). Skip the per-conv subtree entirely.
 *     The list refetch returns without the deleted row → sidebar
 *     re-renders → ``ConversationListItem`` for the deleted row
 *     unmounts → its ``useConversationUsage`` observer detaches
 *     naturally → orphan cache entries are harmless and get GC'd.
 *     For the chat view (the OTHER subscriber to ``['conversations',
 *     id, …]``), ``ConversationListItem.handleDeleteConfirm``
 *     navigates AWAY from ``/chat/<id>`` BEFORE awaiting this
 *     mutation, so its observers (``useConversation``,
 *     ``useConversationMessages``, ``useOpenEpisode``) detach before
 *     the cache touches them.
 *
 * Together these two collaborators (navigate-first + list-only
 * invalidate) leave no live observer pointing at the deleted id by
 * the time the cache work runs, so no refetch fires. The race-guards
 * inside the per-conv hooks (404 → zero-state) remain as multi-tab
 * safety nets only — they should never fire on the single-tab flow.
 */
export function useDeleteConversation() {
  const { conversationService } = useServices();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => conversationService.delete(id),
    onMutate: async (id: string) => {
      // Stop any in-flight refetches for this conversation BEFORE
      // we drop the row. Otherwise a refetch that started during
      // the DELETE round-trip lands after the row is gone → 404.
      await qc.cancelQueries({ queryKey: ['conversations', id] });
    },
    onSuccess: () => {
      // Invalidate ONLY list queries (length-2 keys like
      // ``['conversations', 0]`` and ``['conversations', 'pinned']``).
      // A broad ``invalidateQueries({ queryKey: ['conversations'] })``
      // prefix-matches the per-conv subtree too, which triggers
      // refetches on still-mounted observers → 404. See docstring.
      qc.invalidateQueries({
        predicate: (q) =>
          q.queryKey[0] === 'conversations' && q.queryKey.length === 2,
      });
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
