import axios, { type AxiosInstance } from 'axios';
import type { IConversationRepository } from '@/application/ports/IConversationRepository';
import type {
  Conversation,
  ConversationUsage,
  PersistedMessage,
  UpdateConversationPayload,
  UsageRecord,
} from '@/domain/types/conversation.types';
import type { PaginatedParams } from '@/domain/types/common.types';
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
}

function mapConversation(raw: ApiConversationResponse): Conversation {
  return {
    id: raw.id,
    flowId: raw.flow_id,
    threadId: raw.thread_id,
    userModelId: raw.user_model_id,
    title: raw.title,
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
  };
}

export class ConversationRepository implements IConversationRepository {
  constructor(private readonly http: AxiosInstance) {}

  async list(params?: PaginatedParams): Promise<Conversation[]> {
    const { data } = await this.http.get<ApiConversationResponse[]>('/api/conversations', {
      params: {
        limit: params?.limit,
        offset: params?.offset,
      },
    });
    return data.map(mapConversation);
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
    // The chat surface routes to ``/chat/{uuid}`` BEFORE the backend has
    // committed the conversation row (the landing-page handoff sets the
    // URL synchronously when the user hits send; the row is materialised
    // by the in-flight ``/pragna`` run). A 404 here therefore means
    // "the row hasn't landed yet" — equivalent to "no messages yet" for
    // the chat UI. Returning ``[]`` keeps React Query from surfacing the
    // expected 404 as a query error. A 404 from a wrong-owner id also
    // renders as an empty chat, which is acceptable (the user can't see
    // someone else's history; they just see nothing).
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
