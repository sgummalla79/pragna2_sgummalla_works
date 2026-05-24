import { useState } from 'react';
import { Zap } from 'lucide-react';
import { useFlows } from '@/presentation/hooks/flows/useFlows';
import { useCreateEpisode } from '@/presentation/hooks/episodes/useEpisodes';
import { Button } from '@/presentation/components/ui/Button';
import { Textarea } from '@/presentation/components/ui/Textarea';
import type { ChatToolCall } from '@/presentation/views/chat/hooks/useChatSession';

interface FlowProposalCardProps {
  /** The propose-flow tool call from the LLM. ``call.name`` matches a
   *  flow's ``api_name``; ``call.args`` carries ``{summary,
   *  additional_context?}`` once the args stream completes. */
  call: ChatToolCall;
  /** The active conversation id. The /run-flow endpoint is scoped to
   *  the conversation, so this is required to fire the run. */
  conversationId: string;
}

/**
 * Inline confirmation card the LLM renders when it proposes one of the
 * user's flows (R6a).
 *
 * Layout: flow display name + summary from the LLM + flow description
 * (looked up from the user's flow list) + optional text input for
 * additional context + Skip and Confirm buttons. On Confirm the
 * :func:`useCreateEpisode` mutation calls the backend's
 * ``POST /api/conversations/{id}/episodes`` endpoint (R6b), which
 * starts a flow episode, streams the first turn, and persists messages
 * tagged with ``episode_id``. The chat's message-list query is then
 * invalidated so the flow's response appears as new assistant
 * messages; if the flow paused at ``ask_user`` the open-episode query
 * surfaces the schema and the chat surface renders the HITLFormCard.
 *
 * Behaviour while ``call.args`` is still streaming in: the card waits
 * with a "preparing…" footer so Confirm is gated on the LLM
 * finishing the tool-call args block. Without this gate a fast user
 * could fire Confirm against a half-complete ``summary``.
 */
export function FlowProposalCard({ call, conversationId }: FlowProposalCardProps) {
  const { data: flows = [] } = useFlows();
  // R6b: Confirm now creates an EPISODE (POST /api/conversations/{id}/episodes)
  // instead of running /run-flow. The streaming flow runs inside the
  // episode lifecycle, persists messages with episode_id, and pauses
  // for HITL when the LLM tool-calls ask_user. The episode-aware
  // chat surface (see ChatSurface in ChatSessionView) listens for the
  // resulting awaiting_user episode and renders the HITLFormCard.
  const createEpisode = useCreateEpisode(conversationId);
  const [additionalContext, setAdditionalContext] = useState('');
  const [decisionLocked, setDecisionLocked] = useState<'confirmed' | 'skipped' | null>(null);

  // Match the flow record by api_name — that's what the LLM emitted
  // as the tool name. If no match (the flow was deleted between the
  // proposal and the user landing on this UI), we still render
  // SOMETHING — the LLM thought this name was useful, so show it
  // verbatim and explain.
  const flow = flows.find((f) => f.apiName === call.name);
  const displayName = flow?.displayName ?? call.name;
  const description =
    flow?.description ?? 'Flow no longer available — try sending a regular message instead.';

  // ``summary`` is the only required propose-flow arg. ``additional_context``
  // is optional. Both come from the LLM's tool call.
  const args = call.args as { summary?: string; additional_context?: string } | undefined;
  const summary = args?.summary?.trim() ?? '';

  // R6b: surface the create-episode error to the user. The mutation
  // hook wraps the axios error; we only need its message.
  const errorMessage =
    createEpisode.isError && createEpisode.error instanceof Error
      ? createEpisode.error.message
      : null;

  async function handleConfirm() {
    setDecisionLocked('confirmed');
    try {
      await createEpisode.mutateAsync({
        flowApiName: call.name,
        seedSummary: summary || null,
        seedUserInput: additionalContext.trim() || null,
      });
    } catch {
      // The error is rendered below from `createEpisode.isError`;
      // keep the card visible so the user can retry.
      setDecisionLocked(null);
    }
  }

  function handleSkip() {
    setDecisionLocked('skipped');
  }

  const argsReady = call.complete && args !== undefined;
  const disableActions =
    !argsReady || createEpisode.isPending || decisionLocked !== null;

  return (
    <div className="my-2 rounded-lg border-2 border-primary/30 bg-accent/40 p-4 text-[13px]">
      <div className="flex items-center gap-2">
        <Zap size={16} className="text-primary" aria-hidden="true" />
        <span className="font-semibold text-foreground">
          Run flow: {displayName}?
        </span>
      </div>

      {summary && (
        <p className="mt-2 text-foreground">{summary}</p>
      )}

      <p className="mt-2 text-[12px] text-muted-foreground">{description}</p>

      {!argsReady && (
        <p className="mt-2 text-[12px] italic text-muted-foreground">
          Preparing proposal…
        </p>
      )}

      <div className="mt-3">
        <label
          htmlFor={`flow-extra-${call.id}`}
          className="block text-[12px] font-medium text-muted-foreground"
        >
          Add anything else the flow should know? (optional)
        </label>
        <Textarea
          id={`flow-extra-${call.id}`}
          value={additionalContext}
          onChange={(e) => setAdditionalContext(e.target.value)}
          rows={2}
          className="mt-1 text-[13px]"
          placeholder="e.g. focus on cost over latency"
          disabled={disableActions}
        />
      </div>

      {errorMessage && (
        <p role="alert" className="mt-2 text-[12px] text-destructive">
          {errorMessage}
        </p>
      )}

      <div className="mt-3 flex gap-2 justify-end">
        <Button
          variant="ghost"
          size="sm"
          onClick={handleSkip}
          disabled={disableActions}
        >
          Skip
        </Button>
        <Button
          size="sm"
          onClick={handleConfirm}
          disabled={disableActions}
        >
          {createEpisode.isPending
            ? 'Running…'
            : decisionLocked === 'confirmed'
              ? 'Done'
              : 'Confirm'}
        </Button>
      </div>

      {decisionLocked === 'skipped' && (
        <p className="mt-2 text-[12px] italic text-muted-foreground">
          Skipped. Continue chatting or send a new message.
        </p>
      )}
    </div>
  );
}
