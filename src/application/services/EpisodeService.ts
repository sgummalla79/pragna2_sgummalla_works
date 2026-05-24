import type {
  CreateEpisodePayload,
  EpisodeSnapshot,
  IEpisodeRepository,
  ListEpisodesParams,
  ListEpisodesResponse,
  ResumeEpisodePayload,
} from '@/application/ports/IEpisodeRepository';

/**
 * Application-layer service for episode lifecycle (R6b).
 *
 * Thin pass-through to :class:`IEpisodeRepository`. Exists for parity
 * with the rest of the service layer — every repository in this app
 * has a sibling service so hooks have a stable port-shaped target to
 * import. Replaces the now-deleted :class:`FlowRunService` (R6a's
 * one-shot ``/run-flow`` invocation has been folded into the
 * Episode lifecycle).
 */
export class EpisodeService {
  constructor(private readonly repo: IEpisodeRepository) {}

  /** Start a new flow episode inside a conversation. */
  create(conversationId: string, payload: CreateEpisodePayload): Promise<void> {
    return this.repo.create(conversationId, payload);
  }

  /** Submit a HITL form, resuming the paused episode. */
  resume(
    conversationId: string,
    episodeId: string,
    payload: ResumeEpisodePayload,
  ): Promise<void> {
    return this.repo.resume(conversationId, episodeId, payload);
  }

  /** Read a single episode (FE rehydration on conversation load). */
  get(conversationId: string, episodeId: string): Promise<EpisodeSnapshot> {
    return this.repo.get(conversationId, episodeId);
  }

  /** Paginated list of a conversation's episodes (newest first). */
  list(
    conversationId: string,
    params?: ListEpisodesParams,
  ): Promise<ListEpisodesResponse> {
    return this.repo.list(conversationId, params);
  }
}
