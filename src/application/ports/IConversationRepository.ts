import type {
  Conversation,
  ConversationUsage,
  CreateConversationPayload,
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
  /**
   * Read a single conversation by id. Used by the chat-header title
   * lookup. Returns ``null`` for "not found" / "not owned" (both 404
   * server-side; the indirection here lets the caller render the
   * "New chat" placeholder without an error toast).
   *
   * 2026-05-27 — replaces the previous "filter from the sidebar list
   * cache" pattern, which raced with the auto-title invalidation flow
   * (cache-derived single-conv read kept serving stale `null` titles).
   */
  get(conversationId: string): Promise<Conversation | null>;
  /**
   * Eager-create a conversation row before the first message is sent.
   * Called from ``ChatLandingView.handleSend`` BEFORE navigation so
   * the chat surface mounts with a row that's guaranteed to exist.
   * Replaces the prior lazy-create-on-first-send pattern that caused
   * conversation-scoped queries to 404 during the handoff.
   *
   * Idempotent: a retry with the same ``threadId`` returns the
   * existing row (BE returns 200 vs 201; both map to the same shape
   * here).
   */
  create(payload: CreateConversationPayload): Promise<Conversation>;
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
