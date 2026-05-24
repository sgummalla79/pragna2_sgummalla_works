import type { AxiosInstance } from 'axios';
import type {
  CreateEpisodePayload,
  EpisodeSnapshot,
  IEpisodeRepository,
  ListEpisodesParams,
  ListEpisodesResponse,
  ResumeEpisodePayload,
} from '@/application/ports/IEpisodeRepository';

/**
 * HTTP implementation of :class:`IEpisodeRepository` (R6b).
 *
 * The two streaming endpoints (create + resume) return
 * ``text/event-stream``. R6b's MVP buffers the entire SSE response into
 * a single string before resolving — same approach the now-deleted
 * ``FlowRunRepository`` used. The reason it has to read to completion:
 *
 *   1. The server's ``finally`` block (in
 *      ``conversation_episodes.event_generator``) runs after the last
 *      event yields, and that's where the episode row's terminal
 *      status (``awaiting_user`` / ``completed`` / ``failed``) and the
 *      Confirm/Submit user messages get persisted.
 *   2. Axios's promise resolves only after the response stream ends,
 *      not partway through.
 *
 * Live event rendering during the stream is deferred — the chat surface
 * invalidates the conversation's persisted message list on success and
 * the new turns appear from the refetch. A future release can swap this
 * for a proper SSE consumer if mid-pause progress UI becomes important.
 *
 * The read endpoints (``get`` + ``list``) are plain JSON.
 */
export class EpisodeRepository implements IEpisodeRepository {
  constructor(private readonly axiosClient: AxiosInstance) {}

  async create(
    conversationId: string,
    payload: CreateEpisodePayload,
  ): Promise<void> {
    await this.axiosClient.post(
      `/api/conversations/${encodeURIComponent(conversationId)}/episodes`,
      {
        flow_api_name: payload.flowApiName,
        seed_summary: payload.seedSummary ?? null,
        seed_user_input: payload.seedUserInput ?? null,
      },
      {
        responseType: 'text',
        validateStatus: (status) => status >= 200 && status < 300,
      },
    );
  }

  async resume(
    conversationId: string,
    episodeId: string,
    payload: ResumeEpisodePayload,
  ): Promise<void> {
    await this.axiosClient.post(
      `/api/conversations/${encodeURIComponent(conversationId)}/episodes/${encodeURIComponent(
        episodeId,
      )}/resume`,
      {
        form: payload.form,
        text: payload.text,
      },
      {
        responseType: 'text',
        validateStatus: (status) => status >= 200 && status < 300,
      },
    );
  }

  async get(conversationId: string, episodeId: string): Promise<EpisodeSnapshot> {
    const response = await this.axiosClient.get<RawEpisodeWire>(
      `/api/conversations/${encodeURIComponent(conversationId)}/episodes/${encodeURIComponent(
        episodeId,
      )}`,
    );
    return mapEpisode(response.data);
  }

  async list(
    conversationId: string,
    params: ListEpisodesParams = {},
  ): Promise<ListEpisodesResponse> {
    const response = await this.axiosClient.get<RawListWire>(
      `/api/conversations/${encodeURIComponent(conversationId)}/episodes`,
      { params: { limit: params.limit, offset: params.offset } },
    );
    return {
      episodes: response.data.episodes.map(mapEpisode),
      limit: response.data.limit,
      offset: response.data.offset,
    };
  }

  async cancel(conversationId: string, episodeId: string): Promise<void> {
    await this.axiosClient.delete(
      `/api/conversations/${encodeURIComponent(conversationId)}/episodes/${encodeURIComponent(
        episodeId,
      )}`,
    );
  }
}

/** Wire shape (snake_case) returned by the backend. */
interface RawEpisodeWire {
  id: string;
  conversation_id: string;
  flow_id: string | null;
  thread_id: string;
  status: 'active' | 'awaiting_user' | 'completed' | 'failed';
  seed_summary: string | null;
  seed_user_input: string | null;
  interrupt_value: Record<string, unknown> | null;
  created_at: string;
  modified_at: string;
  ended_at: string | null;
}

interface RawListWire {
  episodes: RawEpisodeWire[];
  limit: number;
  offset: number;
}

/** Snake_case → camelCase converter; localised so callers don't
 *  reach into the wire shape. */
function mapEpisode(raw: RawEpisodeWire): EpisodeSnapshot {
  return {
    id: raw.id,
    conversationId: raw.conversation_id,
    flowId: raw.flow_id,
    threadId: raw.thread_id,
    status: raw.status,
    seedSummary: raw.seed_summary,
    seedUserInput: raw.seed_user_input,
    interruptValue: raw.interrupt_value,
    createdAt: raw.created_at,
    modifiedAt: raw.modified_at,
    endedAt: raw.ended_at,
  };
}
