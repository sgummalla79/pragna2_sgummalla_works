import { useState } from 'react';
import { Zap } from 'lucide-react';
import { useFlows } from '@/presentation/hooks/flows/useFlows';
import { useRunFlow } from '@/presentation/hooks/flows/useRunFlow';
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
 * :func:`useRunFlow` mutation calls the backend's
 * ``POST /api/conversations/{id}/run-flow`` endpoint, which runs the
 * flow synchronously and persists its output. The chat's
 * message-list query is then invalidated so the flow's response
 * appears as new assistant messages.
 *
 * Behaviour while ``call.args`` is still streaming in: the card waits
 * with a "preparing…" footer so Confirm is gated on the LLM
 * finishing the tool-call args block. Without this gate a fast user
 * could fire Confirm against a half-complete ``summary``.
 */
export function FlowProposalCard({ call, conversationId }: FlowProposalCardProps) {
  const { data: flows = [] } = useFlows();
  const run = useRunFlow(conversationId);
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

  const seedText = [summary, additionalContext.trim()].filter(Boolean).join('\n\n');

  // Surface the run error to the user. The mutation hook wraps the
  // axios error; we only need its message.
  const errorMessage =
    run.isError && run.error instanceof Error ? run.error.message : null;

  async function handleConfirm() {
    setDecisionLocked('confirmed');
    try {
      await run.mutateAsync({
        flowApiName: call.name,
        seedText,
      });
    } catch {
      // The error is rendered below from `run.isError`; keep the card
      // visible so the user can retry.
      setDecisionLocked(null);
    }
  }

  function handleSkip() {
    setDecisionLocked('skipped');
  }

  const argsReady = call.complete && args !== undefined;
  const disableActions = !argsReady || run.isPending || decisionLocked !== null;

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
          {run.isPending ? 'Running…' : decisionLocked === 'confirmed' ? 'Done' : 'Confirm'}
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
