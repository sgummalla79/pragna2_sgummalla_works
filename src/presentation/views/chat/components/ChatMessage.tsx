import type { ChatMessage as ChatMessageType } from '@/presentation/views/chat/hooks/useChatSession';
import { ToolCallBadge } from './ToolCallBadge';

interface ChatMessageProps {
  message: ChatMessageType;
}

/**
 * Render a single chat turn. ChatGPT / Claude.ai treatment:
 *   - User turns sit in a subtle grey bubble, right-aligned.
 *   - Assistant turns are bare text in the column flow — no bubble, no
 *     background — so long responses read like a document rather than a
 *     wall of pill-shaped containers.
 *   - Tool / system turns are suppressed (the relevant detail surfaces
 *     via assistant ``ToolCall*`` events; see :class:`ToolCallBadge`).
 */
export function ChatMessage({ message }: ChatMessageProps) {
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
          isUser
            ? 'max-w-[80%] rounded-2xl bg-muted px-4 py-3 text-[14px] leading-relaxed text-foreground'
            : 'w-full text-[14px] leading-relaxed text-foreground'
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
      </div>
    </div>
  );
}
