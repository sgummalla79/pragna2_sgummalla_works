import type { Conversation, ConversationUsage } from '@/domain/types/conversation.types';
import type { PaginatedParams } from '@/domain/types/common.types';

export interface IConversationRepository {
  list(params?: PaginatedParams): Promise<Conversation[]>;
  getUsage(conversationId: string): Promise<ConversationUsage>;
}
