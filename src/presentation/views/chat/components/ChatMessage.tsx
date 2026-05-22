import type { ChatMessage as ChatMessageType } from '@/presentation/views/chat/hooks/useChatSession';
import { ModelBadge } from './ModelBadge';
import { ToolCallBadge } from './ToolCallBadge';

interface ChatMessageProps {
  message: ChatMessageType;
  /**
   * R4 #0. The `user_model_id` attributed to this assistant turn — the
   * parent looks it up from persisted-messages cache + conversation
   * fallback (for mid-stream turns). Ignored for non-assistant roles.
   */
  userModelId?: string | null;
}

/**
 * Render a single chat turn. ChatGPT / Claude.ai treatment:
 *   - User turns sit in a subtle grey bubble, right-aligned.
 *   - Assistant turns are bare text in the column flow — no bubble, no
 *     background — so long responses read like a document rather than a
 *     wall of pill-shaped containers. R4 #0 adds a small "by <model>"
 *     attribution chip under each assistant turn.
 *   - Tool / system turns are suppressed (the relevant detail surfaces
 *     via assistant ``ToolCall*`` events; see :class:`ToolCallBadge`).
 */
export function ChatMessage({ message, userModelId }: ChatMessageProps) {
  if (message.role === 'tool' || message.role === 'system') {
    return null;
  }

  const isUser = message.role === 'user';
  return (
    <div
      className={`flex w-full ${isUser ? 'justify-end' : 'justify-start'}`}
      data-role={message.role}
    >
      <div
        className={
          // 16px body copy (matches claude.ai / chatgpt convention) so
          // long responses read comfortably. text-card-foreground for
          // the brighter ~98% lightness token — see the chat-text
          // brightness rationale on the previous commit.
          isUser
            ? 'max-w-[80%] rounded-2xl bg-muted px-4 py-3 text-[18px] leading-relaxed text-card-foreground'
            : 'w-full text-[18px] leading-relaxed text-card-foreground'
        }
      >
        {message.content && (
          <div className="whitespace-pre-wrap break-words">
            {message.content}
          </div>
        )}
        {message.role === 'assistant' && message.toolCalls && (
          <div className={message.content ? 'mt-1' : ''}>
            {message.toolCalls.map((call) => (
              <ToolCallBadge key={call.id} call={call} />
            ))}
          </div>
        )}
        {message.role === 'assistant' && (
          <div className="mt-1.5">
            <ModelBadge userModelId={userModelId} />
          </div>
        )}
      </div>
    </div>
  );
}
