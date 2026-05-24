import { CircleDashed, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ConfirmButton } from '@/presentation/components/ui/ConfirmButton';
import { useFlows } from '@/presentation/hooks/flows/useFlows';
import {
  useCancelEpisode,
  useOpenEpisode,
} from '@/presentation/hooks/episodes/useEpisodes';

/**
 * Inline badge surfaced in the chat header whenever an open episode
 * owns the current conversation (R7 Tier 1 #2).
 *
 * Two visual states matching the episode status:
 * - ``active``: "Running {flowName}…" with a spinning loader. The
 *   user knows something is in flight even when the assistant text
 *   hasn't started streaming yet.
 * - ``awaiting_user``: "Paused: {flowName}" with a dashed-circle
 *   icon (visual cue that the system is waiting on the user, not
 *   the other way around). The HITLFormCard already renders above
 *   the composer in this state, so the badge is the secondary
 *   indicator.
 *
 * Default-agent ``ask_user`` pauses get a generic "Paused" label
 * because there's no flow to name.
 *
 * The × cancel action is gated behind ``ConfirmButton`` per the
 * destructive-actions-confirm rule — a single click can lose
 * arbitrary work, so the dialog is non-negotiable.
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
  const cancel = useCancelEpisode(conversationId, openEpisode?.id);

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
      <ConfirmButton
        size="sm"
        variant="ghost"
        className="!h-5 !px-1.5 !py-0 !text-[11px] !text-current hover:!bg-foreground/10"
        confirmTitle="Cancel this episode?"
        confirmDescription={
          isAwaiting
            ? "The form will close and any in-flight progress will be discarded. You can start the flow again from a fresh proposal."
            : "Any in-flight progress will be discarded. The conversation will resume on the default chat agent."
        }
        confirmLabel="Cancel episode"
        cancelLabel="Keep running"
        onConfirm={() => cancel.mutateAsync()}
      >
        ×
      </ConfirmButton>
    </div>
  );
}
