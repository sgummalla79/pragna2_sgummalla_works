import type { Attachment } from './attachment.types';

/** Payload for ``POST /api/conversations`` (eager-create). */
export interface CreateConversationPayload {
  /** Client-supplied UUID used as both the row's primary key AND the
   *  LangGraph checkpoint thread_id. Keeps the FE's ``/chat/{id}`` URL
   *  stable across the POST → navigate transition (no need to learn
   *  the id after the round trip). */
  threadId: string;
  /** Model the first chat turn will use. Nullable for resilience; the
   *  landing form always supplies it in production paths. */
  userModelId?: string | null;
  /** Apply the user's first-turn Anthropic extended-thinking choice
   *  at create time. Defaults to false. */
  thinkingEnabled?: boolean;
}

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
  /**
   * Per-conversation Anthropic extended-thinking toggle. Backend stores
   * the value but the LLM-call-time wiring is a follow-up; setting this
   * to ``true`` round-trips through PATCH today, but does not yet alter
   * the LLM payload.
   */
  thinkingEnabled: boolean;
  /** Per-user "pin to sidebar top" flag. Visual ordering hint only. */
  pinned: boolean;
  /** ISO 8601 UTC timestamp of the last pin event, or null when not pinned. */
  pinnedAt: string | null;
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
  /** R5. Files attached to this user turn. Empty for non-user turns
   *  or for turns sent without attachments. */
  attachments: Attachment[];
  messageIndex: number;
  createdAt: string;
  modifiedAt: string;
  /**
   * BE migration 0022. For assistant turns, the normalised terminal
   * stop signal — `'stop'` (natural), `'length'` (model hit
   * max_tokens), `'tool_calls'`, or `'other'`. `null` for non-assistant
   * turns and for historical rows. Drives the inline `Continue`
   * affordance on assistant bubbles where `finishReason === 'length'`.
   */
  finishReason: 'stop' | 'length' | 'tool_calls' | 'other' | null;
}

/** Partial-update payload for ``PATCH /api/conversations/{id}``. */
export interface UpdateConversationPayload {
  /** New title; omitted leaves the title unchanged. */
  title?: string;
  /** New active model; omitted leaves the model unchanged. */
  userModelId?: string;
  /** New thinking-enabled flag; omitted leaves the flag unchanged. */
  thinkingEnabled?: boolean;
  /** Pin / unpin; omitted leaves the flag unchanged. */
  pinned?: boolean;
}
