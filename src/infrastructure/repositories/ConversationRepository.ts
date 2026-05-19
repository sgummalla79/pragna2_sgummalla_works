import type { AxiosInstance } from 'axios';
import type { IConversationRepository } from '@/application/ports/IConversationRepository';
import type { Conversation, ConversationUsage, UsageRecord } from '@/domain/types/conversation.types';
import type { PaginatedParams } from '@/domain/types/common.types';

interface ApiConversationResponse {
  id: string;
  flow_id: string | null;
  thread_id: string;
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

function mapConversation(raw: ApiConversationResponse): Conversation {
  return {
    id: raw.id,
    flowId: raw.flow_id,
    threadId: raw.thread_id,
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
      `/api/conversations/${conversationId}/usage`
    );
    return {
      conversationId: data.conversation_id,
      records: data.records.map(mapUsageRecord),
      totalInputTokens: data.total_input_tokens,
      totalOutputTokens: data.total_output_tokens,
      totalCostUsd: data.total_cost_usd,
    };
  }
}
