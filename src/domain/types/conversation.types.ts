export interface Conversation {
  id: string;
  flowId: string | null;
  threadId: string;
  /**
   * The model the next chat turn will use. May be `null` for legacy rows;
   * new conversations always carry it. Mutable via PATCH; past usage records
   * remain attributed to whatever model produced them.
   */
  userModelId: string | null;
  title: string | null;
  createdAt: string;
}

export interface UsageRecord {
  id: string;
  userModelId: string;
  nodeId: string;
  inputTokens: number;
  outputTokens: number;
  costUsd: string;
  createdAt: string;
}

export interface ConversationUsage {
  conversationId: string;
  records: UsageRecord[];
  totalInputTokens: number;
  totalOutputTokens: number;
  totalCostUsd: string;
}

/**
 * A persisted message turn under a conversation.
 *
 * Mirrors the backend's ``GET /api/conversations/{id}/messages`` response.
 * The chat surface (`useChatSession`) translates these into the in-memory
 * `ChatMessage` shape it renders.
 */
export interface PersistedMessage {
  id: string;
  role: 'user' | 'assistant' | 'tool' | 'system';
  content: string;
  /** Assistant-only tool invocations; `null` for other roles. */
  toolCalls:
    | Array<{
        id: string;
        name: string;
        args?: Record<string, unknown>;
        result?: string;
      }>
    | null;
  /**
   * R4 #0. For assistant turns, the `user_model` that produced this
   * content. `null` for user / tool / system turns AND for historical
   * assistant turns predating backend migration 0010. The chat UI
   * uses this to render "by <model>" against each assistant message.
   */
  userModelId: string | null;
  messageIndex: number;
  createdAt: string;
  modifiedAt: string;
}

/** Partial-update payload for ``PATCH /api/conversations/{id}``. */
export interface UpdateConversationPayload {
  /** New title; omitted leaves the title unchanged. */
  title?: string;
  /** New active model; omitted leaves the model unchanged. */
  userModelId?: string;
}
