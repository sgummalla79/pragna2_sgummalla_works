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
} from '@/domain/types/conversation.types';

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

  list(params?: ConversationListParams): Promise<Conversation[]> {
    return this.conversationRepository.list(params);
  }

  create(payload: CreateConversationPayload): Promise<Conversation> {
    return this.conversationRepository.create(payload);
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
