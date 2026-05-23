import type { AxiosInstance } from 'axios';
import type {
  IFlowRunRepository,
  RunFlowOncePayload,
} from '@/application/ports/IFlowRunRepository';

/**
 * HTTP implementation of :class:`IFlowRunRepository`.
 *
 * The backend endpoint returns ``text/event-stream`` (AG-UI SSE
 * events). For R6a we don't render the events live — the chat just
 * waits for stream completion and refetches the persisted message
 * list. We still need to read the response body to completion so
 * that:
 *
 *   1. The server's ``finally`` block runs (where
 *      ``_persist_turn_messages`` writes to the DB).
 *   2. Axios's promise resolves only after the stream ends, not
 *      partway through.
 *
 * Axios buffers the entire SSE response into a single string before
 * resolving. For R6a's flow sizes (a few KB of events per turn) this
 * is fine. R6b will rewrite this to a streaming consumer once we want
 * partial progress in the UI.
 */
export class FlowRunRepository implements IFlowRunRepository {
  constructor(private readonly axiosClient: AxiosInstance) {}

  async runOnce(
    conversationId: string,
    payload: RunFlowOncePayload,
  ): Promise<void> {
    await this.axiosClient.post(
      `/api/conversations/${encodeURIComponent(conversationId)}/run-flow`,
      {
        flow_api_name: payload.flowApiName,
        seed_text: payload.seedText,
      },
      {
        // Hint axios + intermediate caches that we're consuming a
        // stream. With this header the server still streams via SSE
        // (the route uses ``EventEncoder`` which falls back to
        // ``text/event-stream`` for any Accept value other than
        // ``application/x-ndjson``); axios buffers the full response
        // into memory which is acceptable at R6a flow sizes.
        responseType: 'text',
        // Treat 4xx/5xx as exceptions so the mutation hook can surface
        // them cleanly to the user. The backend returns 404 for
        // missing/disabled flows and missing conversations.
        validateStatus: (status) => status >= 200 && status < 300,
      },
    );
  }
}
