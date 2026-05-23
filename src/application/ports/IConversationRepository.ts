import type {
  Conversation,
  ConversationUsage,
  PersistedMessage,
  UpdateConversationPayload,
} from '@/domain/types/conversation.types';
import type { PaginatedParams } from '@/domain/types/common.types';

/** Filter shape accepted by ``IConversationRepository.list``. */
export interface ConversationListParams extends PaginatedParams {
  /** ``true`` → only pinned rows (ordered by ``pinned_at`` desc),
   *  ``false`` → only unpinned, ``undefined`` → all by ``created_at`` desc. */
  pinned?: boolean;
}

export interface IConversationRepository {
  /** List the authenticated user's conversations (newest first). */
  list(params?: ConversationListParams): Promise<Conversation[]>;
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
  /**
   * R4 #1. Delete the chosen message and every message after it.
   * Powers Regenerate (truncate the assistant turn → re-run the prior
   * user message) and Edit (truncate the user turn → re-submit with
   * edited text).
   */
  truncateFrom(conversationId: string, messageId: string): Promise<void>;
  /**
   * R4 #1. Fork the conversation at the chosen message; the new
   * conversation contains every turn up to and including the chosen
   * message. Returns the new conversation so the caller can navigate
   * to `/chat/{returned.id}`.
   */
  branch(conversationId: string, messageId: string): Promise<Conversation>;
}
