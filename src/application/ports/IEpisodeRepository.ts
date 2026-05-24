/**
 * Port for the ``/api/conversations/{id}/episodes`` family of endpoints (R6b).
 *
 * Episodes are pause-able invocations inside a conversation: a flow run
 * that ``ask_user`` paused, or a default-agent turn whose LLM tool-called
 * ``ask_user``. The FE drives them through four operations:
 *
 *   1. ``create``  — user clicks Confirm on a :class:`FlowProposalCard`.
 *   2. ``resume``  — user submits a :class:`HITLFormCard`.
 *   3. ``get``     — rehydrate the form on browser reload.
 *   4. ``list``    — (admin / debug) inspect a conversation's episodes.
 *
 * The streaming endpoints (create + resume) return AG-UI SSE events.
 * R6b's MVP buffers the full stream into memory before resolving — same
 * pattern as the now-deleted ``FlowRunRepository`` — and the chat surface
 * refetches the conversation's persisted message list on completion. A
 * later release can swap this for a live event subscriber.
 */

/**
 * Snapshot shape returned by ``GET /api/conversations/{id}/episodes/{ep_id}``
 * (and the inner items in ``GET /api/conversations/{id}/episodes``).
 *
 * Mirrors :class:`src.presentation.api.schemas.episode.EpisodeResponse`
 * from the backend exactly — keep the two in sync.
 */
export interface EpisodeSnapshot {
  /** Episode primary key. */
  id: string;
  /** Parent conversation FK. */
  conversationId: string;
  /** Flow being run, or ``null`` for default-agent ``ask_user`` pauses
   *  (R6b decision #14). */
  flowId: string | null;
  /** LangGraph saver thread id for this episode. */
  threadId: string;
  /** One of ``active`` / ``awaiting_user`` / ``completed`` / ``failed``. */
  status: 'active' | 'awaiting_user' | 'completed' | 'failed';
  /** Snapshot of the proposing LLM's ``summary`` argument (flow
   *  proposals only — ``null`` for default-agent pauses). */
  seedSummary: string | null;
  /** Free-text the user typed into the proposal card. ``null`` for
   *  default-agent pauses. */
  seedUserInput: string | null;
  /** Persisted copy of the LangGraph ``interrupt(value=...)`` payload —
   *  typically ``{schema: {...form schema...}}``. Used by the FE to
   *  re-render :class:`HITLFormCard` on browser reload without
   *  replaying the SSE stream. ``null`` while the episode is still
   *  ``active`` (the saver hasn't paused yet). */
  interruptValue: Record<string, unknown> | null;
  /** UTC creation timestamp (ISO 8601). */
  createdAt: string;
  /** UTC timestamp of the last status update. */
  modifiedAt: string;
  /** UTC timestamp when the episode reached a terminal state, or
   *  ``null`` while still open. */
  endedAt: string | null;
}

/** Request body for ``POST /api/conversations/{id}/episodes``. */
export interface CreateEpisodePayload {
  /** ``flows.api_name`` to invoke (must be owned + enabled by user). */
  flowApiName: string;
  /** The propose-flow tool call's ``summary`` arg. Stored verbatim on
   *  the episode row for audit + render of the Confirm message. */
  seedSummary?: string | null;
  /** Free-text the user added in the proposal card's "additional
   *  context" field, if any. */
  seedUserInput?: string | null;
}

/** Request body for ``POST /api/conversations/{id}/episodes/{ep_id}/resume``. */
export interface ResumeEpisodePayload {
  /** ``field_name → value`` map matching the form schema persisted on
   *  the episode. Backend re-validates server-side (decision #9). */
  form: Record<string, unknown>;
  /** Free-text from the composer when ``allow_text_input=true``. Empty
   *  string when not used. */
  text: string;
}

/** Wire shape for ``GET /api/conversations/{id}/episodes`` responses. */
export interface ListEpisodesResponse {
  episodes: EpisodeSnapshot[];
  limit: number;
  offset: number;
}

/** Optional pagination params for :func:`IEpisodeRepository.list`. */
export interface ListEpisodesParams {
  limit?: number;
  offset?: number;
}

export interface IEpisodeRepository {
  /** POST ``/api/conversations/{id}/episodes`` and wait for the SSE
   *  stream to complete. Server persists the episode + Confirm message
   *  + assistant turn in its ``finally`` block, so callers can
   *  invalidate the conversation's messages query on resolution. */
  create(conversationId: string, payload: CreateEpisodePayload): Promise<void>;
  /** POST ``/api/conversations/{id}/episodes/{ep_id}/resume`` and wait
   *  for the SSE stream to complete. Same persist-then-refetch lifecycle
   *  as :func:`create`. */
  resume(
    conversationId: string,
    episodeId: string,
    payload: ResumeEpisodePayload,
  ): Promise<void>;
  /** GET ``/api/conversations/{id}/episodes/{ep_id}``. Used by the
   *  chat view's rehydration path on conversation load when an open
   *  episode exists. */
  get(conversationId: string, episodeId: string): Promise<EpisodeSnapshot>;
  /** GET ``/api/conversations/{id}/episodes`` (paginated). Newest
   *  first. */
  list(
    conversationId: string,
    params?: ListEpisodesParams,
  ): Promise<ListEpisodesResponse>;
}
