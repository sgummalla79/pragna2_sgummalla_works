import { CHAT_PLACEHOLDER_TITLE } from '@/constants/api';
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
 * R6 + R7: the agent-picker dropdown was removed in R6a; flows are now
 * proposed mid-conversation by the default chat agent and confirmed
 * via :class:`FlowProposalCard`, which creates an episode (R6b) that
 * runs via ``POST /api/conversations/{id}/episodes``. R7 Tier 1 #2
 * briefly hosted an ``EpisodeBadge`` × cancel here, but R7.1#3 v2 and
 * the R7.1#3 follow-up replaced that affordance with the
 * :class:`ThinkingStrip` inline above the streaming assistant bubble
 * + the :class:`ChatInput` Stop button — the header is back to being
 * a pure title + brand mark.
 */
export function ChatHeader({ conversation }: ChatHeaderProps) {
  // Background-Run M4: collapse the two "title not yet set" cases
  // ('Untitled chat' for an existing untitled row vs. 'New conversation'
  // before the row materialises) into one ChatGPT-style placeholder.
  // The eager-create + fire-and-forget auto-title path makes the gap
  // ~1s in the typical case; one consistent label avoids the brief
  // "New conversation" → "Untitled chat" flicker that used to happen
  // when the row first appeared.
  const title = conversation?.title ?? CHAT_PLACEHOLDER_TITLE;

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
    </div>
  );
}
