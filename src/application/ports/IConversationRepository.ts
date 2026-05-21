import type {
  Conversation,
  ConversationUsage,
  PersistedMessage,
  UpdateConversationPayload,
} from '@/domain/types/conversation.types';
import type { PaginatedParams } from '@/domain/types/common.types';

export interface IConversationRepository {
  /** List the authenticated user's conversations (newest first). */
  list(params?: PaginatedParams): Promise<Conversation[]>;
  /** Aggregated per-conversation usage + totals. */
  getUsage(conversationId: string): Promise<ConversationUsage>;
  /** Persisted message log for a conversation, ordered by ``messageIndex``. */
  getMessages(conversationId: string): Promise<PersistedMessage[]>;
  /** Partial-update: title and/or active model. */
  update(
    conversationId: string,
    payload: UpdateConversationPayload,
  ): Promise<Conversation>;
  /** Hard-delete; FK cascade removes messages + usage records. */
  delete(conversationId: string): Promise<void>;
}
