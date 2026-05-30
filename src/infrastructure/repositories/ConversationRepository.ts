import axios, { type AxiosInstance } from 'axios';
import type {
  ConversationListParams,
  IConversationRepository,
} from '@/application/ports/IConversationRepository';
import type {
  Conversation,
  ConversationUsage,
  CreateConversationPayload,
  PersistedMessage,
  UpdateConversationPayload,
  UsageRecord,
} from '@/domain/types/conversation.types';
import { mapAttachment } from './AttachmentRepository';

interface ApiAttachmentResponse {
  id: string;
  conversation_id: string | null;
  message_id: string | null;
  filename: string;
  content_type: string;
  size_bytes: number;
  uploaded_at: string;
  expired: boolean;
}

interface ApiConversationResponse {
  id: string;
  flow_id: string | null;
  thread_id: string;
  user_model_id: string | null;
  title: string | null;
  thinking_enabled: boolean;
  pinned: boolean;
  pinned_at: string | null;
  created_at: string;
}

interface ApiUsageRecordResponse {
  id: string;
  user_model_id: string;
  node_id: string;
  input_tokens: number;
  output_tokens: number;
  cost_usd: string;
  created_at: string;
}

interface ApiConversationUsageResponse {
  conversation_id: string;
  records: ApiUsageRecordResponse[];
  total_input_tokens: number;
  total_output_tokens: number;
  total_cost_usd: string;
}

interface ApiMessageResponse {
  id: string;
  role: 'user' | 'assistant' | 'tool' | 'system';
  content: string;
  tool_calls:
    | Array<{
        id: string;
        name: string;
        args?: Record<string, unknown>;
        result?: string;
      }>
    | null;
  user_model_id: string | null;
  attachments: ApiAttachmentResponse[];
  message_index: number;
  created_at: string;
  modified_at: string;
  /** BE migration 0022. ``null`` for non-assistant turns and for
   *  historical rows. The FE renders a Continue affordance when this
   *  reads ``'length'`` on an assistant turn. */
  finish_reason: 'stop' | 'length' | 'tool_calls' | 'other' | null;
  /** BE migration 0026. Assistant-only extended-thinking trace; ``null``
   *  for non-assistant turns, turns without thinking, and historical
   *  rows. Optional so older deployments omitting the field still map. */
  reasoning_content?: string | null;
}

function mapConversation(raw: ApiConversationResponse): Conversation {
  return {
    id: raw.id,
    flowId: raw.flow_id,
    threadId: raw.thread_id,
    userModelId: raw.user_model_id,
    title: raw.title,
    thinkingEnabled: raw.thinking_enabled ?? false,
    pinned: raw.pinned ?? false,
    pinnedAt: raw.pinned_at ?? null,
    createdAt: raw.created_at,
  };
}

function mapUsageRecord(raw: ApiUsageRecordResponse): UsageRecord {
  return {
    id: raw.id,
    userModelId: raw.user_model_id,
    nodeId: raw.node_id,
    inputTokens: raw.input_tokens,
    outputTokens: raw.output_tokens,
    costUsd: raw.cost_usd,
    createdAt: raw.created_at,
  };
}

function mapMessage(raw: ApiMessageResponse): PersistedMessage {
  return {
    id: raw.id,
    role: raw.role,
    content: raw.content,
    toolCalls: raw.tool_calls,
    userModelId: raw.user_model_id,
    attachments: (raw.attachments || []).map(mapAttachment),
    messageIndex: raw.message_index,
    createdAt: raw.created_at,
    modifiedAt: raw.modified_at,
    // BE migration 0022 — present on fresh rows, ``null`` for legacy
    // / non-assistant. The defensive ``?? null`` keeps the type
    // exhaustive when older deployments return responses without the
    // field at all.
    finishReason: raw.finish_reason ?? null,
    // BE migration 0026 — the captured thinking trace. ``?? null``
    // keeps the type exhaustive when older deployments omit the field.
    reasoning: raw.reasoning_content ?? null,
  };
}

export class ConversationRepository implements IConversationRepository {
  constructor(private readonly http: AxiosInstance) {}

  async list(params?: ConversationListParams): Promise<Conversation[]> {
    const { data } = await this.http.get<ApiConversationResponse[]>('/api/conversations', {
      params: {
        limit: params?.limit,
        offset: params?.offset,
        pinned: params?.pinned,
      },
    });
    return data.map(mapConversation);
  }

  async get(conversationId: string): Promise<Conversation | null> {
    // BE returns 404 for both "no such conversation" AND "owned by
    // another user" — by design, to avoid leaking existence. Map 404
    // → ``null`` so the caller (typically ``useConversation``) can
    // render the "New chat" placeholder without throwing.
    try {
      const { data } = await this.http.get<ApiConversationResponse>(
        `/api/conversations/${conversationId}`,
      );
      return mapConversation(data);
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 404) {
        return null;
      }
      throw error;
    }
  }

  async create(payload: CreateConversationPayload): Promise<Conversation> {
    // Wire-format uses snake_case; convert at the boundary. BE returns
    // 201 on fresh-create and 200 on idempotent retry — both map to
    // the same response shape, so we don't branch on status here.
    const body: Record<string, unknown> = { thread_id: payload.threadId };
    if (payload.userModelId !== undefined) {
      body.user_model_id = payload.userModelId;
    }
    if (payload.thinkingEnabled !== undefined) {
      body.thinking_enabled = payload.thinkingEnabled;
    }
    const { data } = await this.http.post<ApiConversationResponse>(
      '/api/conversations',
      body,
    );
    return mapConversation(data);
  }

  async getUsage(conversationId: string): Promise<ConversationUsage> {
    const { data } = await this.http.get<ApiConversationUsageResponse>(
      `/api/conversations/${conversationId}/usage`,
    );
    return {
      conversationId: data.conversation_id,
      records: data.records.map(mapUsageRecord),
      totalInputTokens: data.total_input_tokens,
      totalOutputTokens: data.total_output_tokens,
      totalCostUsd: data.total_cost_usd,
    };
  }

  async getMessages(conversationId: string): Promise<PersistedMessage[]> {
    // Race-guard, NOT a lazy-create workaround. Eager creation
    // (``POST /api/conversations`` from ChatLandingView.handleSend)
    // means the row always exists by the time the chat surface mounts.
    // The remaining 404 cases are real races: (1) active-delete
    // refetches that fire between DELETE 204 and navigate-away, and
    // (2) multi-tab delete (tab B's queries 404 after tab A deletes).
    // For both cases, "no conversation → no messages" is the correct
    // zero-state. A 404 from a wrong-owner id also renders empty, which
    // is acceptable — the user just sees nothing, no leak.
    try {
      const { data } = await this.http.get<ApiMessageResponse[]>(
        `/api/conversations/${conversationId}/messages`,
      );
      return data.map(mapMessage);
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 404) {
        return [];
      }
      throw error;
    }
  }

  async update(
    conversationId: string,
    payload: UpdateConversationPayload,
  ): Promise<Conversation> {
    // Wire-format uses snake_case; convert at the boundary.
    const body: Record<string, unknown> = {};
    if (payload.title !== undefined) body.title = payload.title;
    if (payload.userModelId !== undefined) body.user_model_id = payload.userModelId;
    if (payload.thinkingEnabled !== undefined) body.thinking_enabled = payload.thinkingEnabled;
    if (payload.pinned !== undefined) body.pinned = payload.pinned;
    const { data } = await this.http.patch<ApiConversationResponse>(
      `/api/conversations/${conversationId}`,
      body,
    );
    return mapConversation(data);
  }

  async delete(conversationId: string): Promise<void> {
    await this.http.delete(`/api/conversations/${conversationId}`);
  }

  async truncateFrom(conversationId: string, messageId: string): Promise<void> {
    await this.http.post(
      `/api/conversations/${conversationId}/messages/truncate-from`,
      { message_id: messageId },
    );
  }

  async branch(conversationId: string, messageId: string): Promise<Conversation> {
    const { data } = await this.http.post<ApiConversationResponse>(
      `/api/conversations/${conversationId}/branch`,
      { message_id: messageId },
    );
    return mapConversation(data);
  }
}
