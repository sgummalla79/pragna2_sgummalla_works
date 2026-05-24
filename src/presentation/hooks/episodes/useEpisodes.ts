import { useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
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

  return useMemo(
    () => ({
      openEpisode: openEpisodeQuery.data ?? null,
      isOpenEpisodeLoading: openEpisodeQuery.isLoading,
      create: createMutation,
      resume: resumeMutation,
    }),
    [openEpisodeQuery.data, openEpisodeQuery.isLoading, createMutation, resumeMutation],
  );
}
