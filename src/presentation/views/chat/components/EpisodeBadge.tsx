import { CircleDashed, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useFlows } from '@/presentation/hooks/flows/useFlows';
import { useOpenEpisode } from '@/presentation/hooks/episodes/useEpisodes';

/**
 * Inline status pill surfaced in the chat header whenever an open
 * episode owns the current conversation.
 *
 * R7.1#3 — the badge is now a pure indicator. The cancel affordance
 * lives on the ChatInput Stop button (for `active`) and on the
 * HITLFormCard's Cancel button (for `awaiting_user`). This component
 * is deliberately minimal because it will be replaced wholesale by the
 * "thinking strip" pattern (animated logo + live one-line agent status
 * like ChatGPT / Claude.ai). See ``docs/future-discussions.md`` for
 * scoping.
 *
 * Two visual states matching the episode status:
 * - ``active``: "Running {flowName}…" with a spinning loader. The
 *   user knows something is in flight even when the assistant text
 *   hasn't started streaming yet.
 * - ``awaiting_user``: "Paused: {flowName}" with a dashed-circle
 *   icon. The HITLFormCard already renders above the composer in this
 *   state, so the badge is the secondary indicator.
 *
 * Default-agent ``ask_user`` pauses get a generic "Paused" label
 * because there's no flow to name.
 */
interface Props {
  /** Required. Brand-new chats whose row hasn't materialised yet
   *  render no badge — the open-episode query is disabled in that
   *  case. */
  conversationId: string;
}

export function EpisodeBadge({ conversationId }: Props) {
  const { data: openEpisode } = useOpenEpisode(conversationId);
  const { data: flows = [] } = useFlows();

  if (!openEpisode) return null;

  // Flow name fallback. Default-agent episodes (flow_id NULL) don't
  // have a flow row to look up; we still want a sensible label.
  const flow = openEpisode.flowId
    ? flows.find((f) => f.id === openEpisode.flowId)
    : null;
  const label = flow?.displayName ?? (openEpisode.flowId ? 'flow' : 'agent');

  const isAwaiting = openEpisode.status === 'awaiting_user';
  const headline = isAwaiting ? `Paused: ${label}` : `Running ${label}…`;

  return (
    <div
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px]',
        isAwaiting
          ? 'bg-primary/10 text-primary'
          : 'bg-muted text-muted-foreground',
      )}
      // Title is intentionally short — full status + episode id sits on
      // the title hover, useful for support / debugging without
      // cluttering the chrome.
      title={`Episode ${openEpisode.id} — ${openEpisode.status}`}
    >
      {isAwaiting ? (
        <CircleDashed size={11} aria-hidden="true" />
      ) : (
        <Loader2 size={11} className="animate-spin" aria-hidden="true" />
      )}
      <span className="truncate max-w-[180px]">{headline}</span>
    </div>
  );
}
