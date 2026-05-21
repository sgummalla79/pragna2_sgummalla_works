import type { ChatMessage as ChatMessageType } from '@/presentation/views/chat/hooks/useChatSession';
import { ToolCallBadge } from './ToolCallBadge';

interface ChatMessageProps {
  message: ChatMessageType;
}

/**
 * Render a single chat turn. User and assistant turns get distinct
 * bubble treatments; tool/system turns are suppressed because the
 * AG-UI runtime already surfaces the relevant detail via assistant
 * ``ToolCall*`` events (see :class:`ToolCallBadge`).
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
        className={`max-w-[80%] rounded-2xl px-4 py-3 text-[14px] leading-relaxed ${
          isUser
            ? 'bg-[var(--color-brand)] text-white'
            : 'bg-[#1a1a1a] text-[#ececea]'
        }`}
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
