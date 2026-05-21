import { APP_NAME } from '@/constants/api';
import type { Conversation } from '@/domain/types/conversation.types';

interface ChatHeaderProps {
  /** The currently-resumed conversation, or ``undefined`` for ``/chat/new``. */
  conversation?: Conversation;
  /** Which agent the chat is running against. ``'default'`` for free chat. */
  agentName: string;
}

/**
 * Slim header strip above the chat message list.
 *
 * Shows the conversation title (or "New conversation" for ``/chat/new``)
 * and the agent name, separated by a thin middle dot. The app name sits
 * on the far right as a quiet brand mark.
 *
 * Future home for the agent picker (R2) and the model picker (R1 backend
 * already supports per-conversation model change via PATCH). For R1's
 * frontend slice the header is read-only — model/agent change is a
 * later release.
 */
export function ChatHeader({ conversation, agentName }: ChatHeaderProps) {
  const title =
    conversation?.title
    ?? (conversation ? 'Untitled chat' : 'New conversation');

  return (
    <div className="flex items-center gap-3 border-b border-[#2a2a2a] bg-[#0d0d0d] px-4 py-3">
      <span className="text-[14px] font-semibold text-[#ececea] truncate">
        {title}
      </span>
      <span className="text-[12px] text-[#737373]" aria-hidden>·</span>
      <span className="text-[12px] text-[#737373]">{agentName}</span>
      <span className="ml-auto text-[11px] text-[#737373]">{APP_NAME}</span>
    </div>
  );
}
