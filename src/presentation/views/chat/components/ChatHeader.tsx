import { APP_NAME } from '@/constants/api';
import type { Conversation } from '@/domain/types/conversation.types';
import { AgentPicker } from './AgentPicker';

interface ChatHeaderProps {
  /** The conversation backing this view, or nullish before its row
   * has materialised on the backend (the first turn of a brand-new
   * chat, where the URL leads the database). */
  conversation: Conversation | null | undefined;
  /** Which agent the chat is running against. ``'default'`` for free chat. */
  agentName: string;
}

/**
 * Slim header strip above the chat message list.
 *
 * Shows the conversation title (or "New conversation" while the row is
 * still pending), and the :class:`AgentPicker` so the user can start a
 * new chat against a different agent. The app name sits on the far
 * right as a quiet brand mark.
 *
 * The picker is a dropdown when there's more than one agent available;
 * when only the default agent exists it renders as inert text instead.
 * Either way it consumes the same horizontal space, so the header
 * layout doesn't shift between users with and without flows.
 */
export function ChatHeader({ conversation, agentName }: ChatHeaderProps) {
  const title =
    conversation?.title
    ?? (conversation ? 'Untitled chat' : 'New conversation');

  // Elevation in BOTH themes from a single shadow stack:
  //
  //   1. ``inset 0 -1px 0 rgba(255,255,255,0.08)`` — a 1px bright line
  //      pinned to the header's BOTTOM edge. In dark mode this is the
  //      load-bearing trick: a pure-black drop-shadow on a near-black
  //      page is physically invisible (no contrast), but a thin white
  //      highlight reads as "light catching the front edge of a panel
  //      sitting above the surface" — the same cue Material Design's
  //      elevation overlays use. White-on-white is naturally invisible
  //      in light mode, so it doesn't interfere there.
  //   2. ``0 2px 4px rgba(0,0,0,0.15)`` — close, soft drop. Does most
  //      of the lifting in light mode where shadows show clearly on
  //      white; subtle support in dark mode.
  //   3. ``0 12px 32px -8px rgba(0,0,0,0.25)`` — extended penumbra so
  //      the gradient feels physical rather than abrupt.
  //
  // ``relative z-10`` keeps the shadow stack above the scroll column.
  return (
    <div className="relative z-10 flex h-12 items-center gap-3 bg-background px-4 shadow-[inset_0_-1px_0_rgba(255,255,255,0.08),0_2px_4px_rgba(0,0,0,0.15),0_12px_32px_-8px_rgba(0,0,0,0.25)]">
      <span className="text-[14px] font-semibold text-foreground truncate">
        {title}
      </span>
      <span className="text-[12px] text-muted-foreground" aria-hidden>·</span>
      <AgentPicker value={agentName} />
      <span className="ml-auto text-[11px] text-muted-foreground">{APP_NAME}</span>
    </div>
  );
}
