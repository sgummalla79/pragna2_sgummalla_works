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
 * Cache lifecycle is the load-bearing detail here:
 *
 *   * **onMutate (pre-DELETE):** cancel any in-flight conversation-scoped
 *     queries for this id. Without this, a refetch that fired BEFORE we
 *     issued DELETE can land AFTER the BE has dropped the row → 404 in
 *     the network tab → ugly console noise even though the FE handles
 *     it gracefully via the per-hook race-guards.
 *   * **onSuccess (post-DELETE):** invalidate the list (sidebar reflects
 *     the removal) AND ``removeQueries`` for every cache entry keyed
 *     by ``['conversations', <id>, …]``. ``removeQueries`` (not
 *     ``invalidateQueries``) so the entries are EVICTED rather than
 *     marked-stale — invalidate would trigger a refetch that hits 404.
 *
 * Combined with the navigate-away-on-active-delete in
 * ``ConversationListItem`` (line 82), the three 404s users used to see
 * after a delete (/messages /usage /episodes) stop happening on the
 * normal flow. The race-guards inside the three hooks become true
 * multi-tab safety nets (tab B's queries 404 after tab A deletes —
 * tab B's cache isn't being managed by tab A's mutation).
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
    onSuccess: (_data, id) => {
      // Sidebar list refreshes (deleted row disappears).
      qc.invalidateQueries({ queryKey: ['conversations'] });
      // Evict every conversation-scoped cache entry so no refetch
      // can fire against the gone conversation: messages, usage,
      // open-episode, per-episode, and any future
      // ``['conversations', id, …]`` query.
      qc.removeQueries({ queryKey: ['conversations', id] });
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
