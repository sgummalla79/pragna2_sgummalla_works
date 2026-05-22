import type { IConversationRepository } from '@/application/ports/IConversationRepository';
import type {
  Conversation,
  ConversationUsage,
  PersistedMessage,
  UpdateConversationPayload,
} from '@/domain/types/conversation.types';
import type { PaginatedParams } from '@/domain/types/common.types';

/**
 * Application-layer facade over :class:`IConversationRepository`.
 *
 * One-line delegations today; the service exists so views acquire the
 * dependency through ``useServices()`` and future cross-cutting concerns
 * (auto-title, optimistic cache writes, etc.) land here without
 * changing call sites.
 */
export class ConversationService {
  constructor(private readonly conversationRepository: IConversationRepository) {}

  list(params?: PaginatedParams): Promise<Conversation[]> {
    return this.conversationRepository.list(params);
  }

  getUsage(conversationId: string): Promise<ConversationUsage> {
    return this.conversationRepository.getUsage(conversationId);
  }

  getMessages(conversationId: string): Promise<PersistedMessage[]> {
    return this.conversationRepository.getMessages(conversationId);
  }

  update(
    conversationId: string,
    payload: UpdateConversationPayload,
  ): Promise<Conversation> {
    return this.conversationRepository.update(conversationId, payload);
  }

  delete(conversationId: string): Promise<void> {
    return this.conversationRepository.delete(conversationId);
  }

  truncateFrom(conversationId: string, messageId: string): Promise<void> {
    return this.conversationRepository.truncateFrom(conversationId, messageId);
  }

  branch(conversationId: string, messageId: string): Promise<Conversation> {
    return this.conversationRepository.branch(conversationId, messageId);
  }
}
