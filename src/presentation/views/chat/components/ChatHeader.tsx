import { APP_NAME } from '@/constants/api';
import type { Conversation } from '@/domain/types/conversation.types';
import { EpisodeBadge } from './EpisodeBadge';

interface ChatHeaderProps {
  /** The conversation backing this view, or nullish before its row
   * has materialised on the backend (the first turn of a brand-new
   * chat, where the URL leads the database). */
  conversation: Conversation | null | undefined;
  /** R7 Tier 1 #2: when set, the EpisodeBadge renders next to the
   *  title and surfaces the open-episode state (running / awaiting
   *  user) with a × cancel affordance. Absent on brand-new chats
   *  whose row hasn't materialised yet. */
  conversationId?: string;
}

/**
 * Slim header strip above the chat message list.
 *
 * Shows the conversation title (or "New conversation" while the row is
 * still pending) and the app name on the far right as a quiet brand
 * mark.
 *
 * R6 + R7: the agent-picker dropdown was removed in R6a; flows are now
 * proposed mid-conversation by the default chat agent and confirmed
 * via :class:`FlowProposalCard`, which creates an episode (R6b) that
 * runs via ``POST /api/conversations/{id}/episodes``. When an episode
 * is open, R7 Tier 1 #2's :class:`EpisodeBadge` surfaces inline here
 * with a destructive-confirmed × cancel.
 */
export function ChatHeader({ conversation, conversationId }: ChatHeaderProps) {
  const title =
    conversation?.title
    ?? (conversation ? 'Untitled chat' : 'New conversation');

  // Elevation in BOTH themes from a single shadow stack:
  //
  //   1. ``inset 0 -1px 0 var(--color-border)`` — a 1px bright line
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
    <div className="relative z-10 flex h-12 items-center gap-3 bg-background px-4 border-b border-border shadow-md">
      <span className="text-[14px] font-semibold text-foreground truncate">
        {title}
      </span>
      {conversationId && <EpisodeBadge conversationId={conversationId} />}
      <span className="ml-auto text-[11px] text-muted-foreground">{APP_NAME}</span>
    </div>
  );
}
