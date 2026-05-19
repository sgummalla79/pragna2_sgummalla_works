import type { IConversationRepository } from '@/application/ports/IConversationRepository';
import type { Conversation, ConversationUsage } from '@/domain/types/conversation.types';
import type { PaginatedParams } from '@/domain/types/common.types';

export class ConversationService {
  constructor(private readonly conversationRepository: IConversationRepository) {}

  list(params?: PaginatedParams): Promise<Conversation[]> {
    return this.conversationRepository.list(params);
  }

  getUsage(conversationId: string): Promise<ConversationUsage> {
    return this.conversationRepository.getUsage(conversationId);
  }
}
