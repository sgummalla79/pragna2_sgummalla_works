import { APP_NAME } from '@/constants/api';
import type { Conversation } from '@/domain/types/conversation.types';

interface ChatHeaderProps {
  /** The conversation backing this view, or nullish before its row
   * has materialised on the backend (the first turn of a brand-new
   * chat, where the URL leads the database). */
  conversation: Conversation | null | undefined;
}

/**
 * Slim header strip above the chat message list.
 *
 * Shows the conversation title (or "New conversation" while the row is
 * still pending) and the app name on the far right as a quiet brand
 * mark.
 *
 * R6a: the agent-picker dropdown is gone. Flows are no longer selected
 * upfront — the default chat agent proposes them mid-conversation via
 * the ``propose_flow`` tool, the user confirms in an inline
 * ``FlowProposalCard``, and the flow runs against
 * ``POST /api/conversations/{id}/run-flow``. The header therefore
 * carries no agent affordance at all in R6a. R6c will add an
 * ``EpisodeBadge`` here when multi-turn episodes ship.
 */
export function ChatHeader({ conversation }: ChatHeaderProps) {
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
      <span className="ml-auto text-[11px] text-muted-foreground">{APP_NAME}</span>
    </div>
  );
}
