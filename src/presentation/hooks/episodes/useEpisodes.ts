import { useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import type {
  CreateEpisodePayload,
  EpisodeSnapshot,
  ResumeEpisodePayload,
} from '@/application/ports/IEpisodeRepository';
import { useServices } from '@/presentation/providers/ServiceContext';

/**
 * React Query hooks for the episode lifecycle (R6b).
 *
 * Three flavours of consumer:
 *
 *   * :func:`useCreateEpisode` — Confirm on :class:`FlowProposalCard`.
 *   * :func:`useResumeEpisode` — Submit on :class:`HITLFormCard`.
 *   * :func:`useOpenEpisode`   — chat surface on conversation load,
 *     so it can rehydrate the form for a paused episode.
 *
 * The list endpoint isn't surfaced as a hook yet — R6b ships no UI
 * that needs it. R9 adds an admin / "episodes" panel that can.
 *
 * On create + resume success the conversation's persisted message list
 * AND the open-episode query are invalidated so the chat refetches
 * messages + the new episode state. The shared cache keys are exported
 * so other call sites can invalidate the same slices coherently.
 */

/** Query key for "is there an open episode on this conversation?". */
export function openEpisodeQueryKey(conversationId: string | undefined) {
  return ['conversations', conversationId, 'open-episode'] as const;
}

/** Query key for "fetch this specific episode". Used by the rehydration
 *  path once :func:`useOpenEpisode` has told us an episode id exists. */
export function episodeQueryKey(
  conversationId: string | undefined,
  episodeId: string | undefined,
) {
  return ['conversations', conversationId, 'episodes', episodeId] as const;
}

/**
 * Fetch the open (``active`` or ``awaiting_user``) episode for a
 * conversation, if any. ``null`` when there is none.
 *
 * Backend doesn't expose a direct "open episode" endpoint — we look up
 * the most-recent episode via ``GET /episodes`` and return it iff its
 * status is open. The partial unique index on
 * ``conversation_episodes(conversation_id) WHERE status IN
 * ('active', 'awaiting_user')`` guarantees there's at most one such
 * row at any time, so the "most recent" check is sufficient.
 *
 * Disabled when ``conversationId`` is undefined (brand-new chat that
 * hasn't materialised a row yet — no episode possible).
 */
export function useOpenEpisode(conversationId: string | undefined) {
  const { episodeService } = useServices();
  return useQuery({
    queryKey: openEpisodeQueryKey(conversationId),
    queryFn: async (): Promise<EpisodeSnapshot | null> => {
      if (!conversationId) return null;
      try {
        const page = await episodeService.list(conversationId, {
          limit: 1,
          offset: 0,
        });
        const first = page.episodes[0];
        if (!first) return null;
        if (first.status === 'active' || first.status === 'awaiting_user') {
          return first;
        }
        return null;
      } catch (e) {
        // Race-guard (NOT a lazy-create workaround). Eager creation
        // means a fresh conversation has its row before the chat
        // surface mounts. Remaining 404 cases: active-delete race
        // (refetch between DELETE 204 and navigate-away) and
        // multi-tab delete. No conversation means no episodes.
        if (axios.isAxiosError(e) && e.response?.status === 404) {
          return null;
        }
        throw e;
      }
    },
    enabled: Boolean(conversationId),
    // Episodes change as a side-effect of /pragna and /episodes routes
    // — invalidate explicitly from those mutations instead of polling.
    staleTime: 30_000,
  });
}

/** Fetch a specific episode by id. Used by FE rehydration when the
 *  open-episode query has told us there's a paused episode and we need
 *  the full schema to re-render the form. */
export function useEpisode(
  conversationId: string | undefined,
  episodeId: string | undefined,
) {
  const { episodeService } = useServices();
  return useQuery({
    queryKey: episodeQueryKey(conversationId, episodeId),
    queryFn: () => episodeService.get(conversationId!, episodeId!),
    enabled: Boolean(conversationId && episodeId),
    staleTime: 30_000,
  });
}

/**
 * Mutation that creates a flow episode inside a conversation.
 *
 * On success the conversation's persisted message query AND its
 * open-episode query are invalidated so:
 *
 *   * the chat re-renders with the Confirm user-side message + the
 *     flow's assistant turn(s) that came back in the buffered SSE
 *     stream;
 *   * if the flow paused at ``ask_user`` the rehydration path picks
 *     up the new awaiting-user episode and renders the form.
 */
export function useCreateEpisode(conversationId: string | undefined) {
  const { episodeService } = useServices();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: CreateEpisodePayload) => {
      if (!conversationId) {
        throw new Error('useCreateEpisode: conversationId is required');
      }
      await episodeService.create(conversationId, payload);
    },
    onSuccess: () => {
      if (!conversationId) return;
      queryClient.invalidateQueries({
        queryKey: ['conversations', conversationId, 'messages'],
      });
      queryClient.invalidateQueries({
        queryKey: openEpisodeQueryKey(conversationId),
      });
    },
  });
}

/**
 * Mutation that resumes a paused episode with a HITL form submission.
 *
 * Invalidates the same slices as :func:`useCreateEpisode`. If the
 * resume run pauses again at another ``ask_user``, the refetched
 * open-episode query will surface the new schema and the form
 * re-renders; if the run completes, the open-episode query returns
 * ``null`` and the form unmounts.
 */
export function useResumeEpisode(
  conversationId: string | undefined,
  episodeId: string | undefined,
) {
  const { episodeService } = useServices();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: ResumeEpisodePayload) => {
      if (!conversationId || !episodeId) {
        throw new Error(
          'useResumeEpisode: conversationId + episodeId are required',
        );
      }
      await episodeService.resume(conversationId, episodeId, payload);
    },
    onSuccess: () => {
      if (!conversationId) return;
      // Optimistically clear the open-episode cache BEFORE the
      // invalidate-driven refetch fires. Without this, the cache
      // still holds the pre-submit row (status=awaiting_user,
      // schema set) for the ~100-300ms window between the
      // mutation resolving and the /episodes refetch landing. The
      // ChatSessionView form-render gate
      // (``hitlSchema && !resume.isPending``) flips back to TRUE
      // in that window because:
      //   * resume.isPending is now false (mutation done)
      //   * cached openEpisode still has awaiting_user → hitlSchema
      //     is still derived from it
      //   * → form briefly re-renders before the refetch clears it
      // That's the "form flashes for a sec or 2" symptom.
      //
      // Setting the cache to null here makes hitlSchema null
      // immediately. The invalidate-driven refetch lands shortly
      // after with the REAL post-submit episode (either null when
      // the run completed, or a new awaiting_user row for a
      // subsequent ask_user pause). Net effect: no flash on the
      // completed path; a clean transition to the next form on
      // the chained-pause path.
      queryClient.setQueryData(
        openEpisodeQueryKey(conversationId),
        null,
      );
      queryClient.invalidateQueries({
        queryKey: ['conversations', conversationId, 'messages'],
      });
      queryClient.invalidateQueries({
        queryKey: openEpisodeQueryKey(conversationId),
      });
      if (episodeId) {
        queryClient.invalidateQueries({
          queryKey: episodeQueryKey(conversationId, episodeId),
        });
      }
      // Refresh BOTH title-displaying surfaces. The BE writes the
      // conversation's title in the resume endpoint's auto-title call
      // (when this was the first turn pair against the conversation —
      // common case for ask_user pauses on a brand-new chat), but the
      // resume SSE stream is buffered as opaque text by the FE
      // EpisodeRepository, so we can't react to a TITLE_UPDATED event
      // mid-stream. Instead, refetch the list (sidebar) + the per-conv
      // 'single' query (ChatHeader) after the resume HTTP call
      // completes so the freshly-written title surfaces immediately.
      //
      // List-only via predicate (length === 2) to avoid prefix-matching
      // per-conv subqueries — matches the pattern in
      // useDeleteConversation and is documented in
      // docs/integration-contracts.md §3.
      queryClient.invalidateQueries({
        predicate: (q) =>
          q.queryKey[0] === 'conversations' && q.queryKey.length === 2,
      });
      queryClient.invalidateQueries({
        queryKey: ['conversations', conversationId, 'single'],
      });
    },
  });
}

/**
 * Mutation that cancels an open episode (R7 Tier 1 #2).
 *
 * Backs the × button on :class:`EpisodeBadge`. The destructive
 * confirm dialog lives at the call site (per the project's
 * destructive-action-confirm rule); this hook just dispatches the
 * DELETE and invalidates the open-episode + messages queries so the
 * badge disappears and any cancellation-related message
 * (placeholder, etc.) appears.
 *
 * On settlement the mutation invalidates the same slices as
 * :func:`useResumeEpisode` so the UI converges to the post-cancel
 * state without manual refetch.
 */
export function useCancelEpisode(
  conversationId: string | undefined,
  episodeId: string | undefined,
) {
  const { episodeService } = useServices();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      if (!conversationId || !episodeId) {
        throw new Error(
          'useCancelEpisode: conversationId + episodeId are required',
        );
      }
      await episodeService.cancel(conversationId, episodeId);
    },
    onSettled: () => {
      if (!conversationId) return;
      queryClient.invalidateQueries({
        queryKey: openEpisodeQueryKey(conversationId),
      });
      queryClient.invalidateQueries({
        queryKey: ['conversations', conversationId, 'messages'],
      });
      if (episodeId) {
        queryClient.invalidateQueries({
          queryKey: episodeQueryKey(conversationId, episodeId),
        });
      }
    },
  });
}

/** Bundle helper for callers that need both the open-episode query AND
 *  the matching mutations — keeps imports tidy at the call site. */
export function useEpisodes(conversationId: string | undefined) {
  const openEpisodeQuery = useOpenEpisode(conversationId);
  const createMutation = useCreateEpisode(conversationId);
  const resumeMutation = useResumeEpisode(
    conversationId,
    openEpisodeQuery.data?.id,
  );
  const cancelMutation = useCancelEpisode(
    conversationId,
    openEpisodeQuery.data?.id,
  );

  return useMemo(
    () => ({
      openEpisode: openEpisodeQuery.data ?? null,
      isOpenEpisodeLoading: openEpisodeQuery.isLoading,
      create: createMutation,
      resume: resumeMutation,
      cancel: cancelMutation,
    }),
    [
      openEpisodeQuery.data,
      openEpisodeQuery.isLoading,
      createMutation,
      resumeMutation,
      cancelMutation,
    ],
  );
}
