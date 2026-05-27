import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { HttpAgent } from '@ag-ui/client';
import type { AgentSubscriber, Message } from '@ag-ui/client';
import { useQueryClient } from '@tanstack/react-query';
import { PRAGNA_BASE_URL } from '@/constants/api';
import { invalidateConversationListQueries } from '@/presentation/hooks/conversations/useConversations';
import { usePragnaSlashFlows } from '@/presentation/hooks/pragnaFlows/usePragnaSlashFlows';
import { useAuthStore } from '@/presentation/store/authStore';
import { logger } from '@/infrastructure/logging/logger';

// Match `/{name}` at the start of a message, optionally followed by
// `<space>{rest}`. Permissive on the name character set so legacy
// snake_case slash names (predating the kebab-case rule) continue to
// route alongside new kebab-case names (matches the BE's
// `SLASH_COMMAND_PATTERN`).
const SLASH_COMMAND_RE = /^\/([a-z_][a-z0-9_-]*)(?:\s|$)/;

// Sidebar refresh fires immediately on RUN_FINISHED so the user sees
// the new conversation appear right away. Auto-title is no longer
// polled — the BE pushes the title via a TITLE_UPDATED custom event
// before closing the SSE stream, handled in ``onCustomEvent`` below.

/** A tool call rendered inline under an assistant turn. */
export interface ChatToolCall {
  id: string;
  name: string;
  /** Cumulative argument JSON snippet as the LLM streams it. */
  argsBuffer: string;
  /** Final parsed args once the call completes; ``undefined`` while streaming. */
  args?: Record<string, unknown>;
  /** Tool result, if the server emitted a ToolCallResultEvent. */
  result?: string;
  /** True once we've seen the matching ToolCallEndEvent. */
  complete: boolean;
}

/** UI-shaped message — the canonical state the chat view renders. */
export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'tool' | 'system';
  content: string;
  /** Assistant-only: any tool calls the LLM emitted during the turn. */
  toolCalls?: ChatToolCall[];
}

export type ChatStatus = 'idle' | 'running' | 'error';

export interface ChatSessionApi {
  /** Current turn state. Reflects the underlying ``HttpAgent.messages`` 1:1. */
  messages: ChatMessage[];
  /** Current run status. ``error`` flips back to ``idle`` on the next send. */
  status: ChatStatus;
  /** Last error message when ``status === 'error'``; ``null`` otherwise. */
  error: string | null;
  /**
   * R7.1#3 follow-up — latest live progress label from the agent.
   * Backed by the LangChain ``on_progress`` custom event emitted from
   * every ``BaseAgentNode.__call__`` on the BE. ``null`` between runs
   * and when the latest event hasn't carried a label.
   *
   * Last-wins: in a parallel-agents flow, the most recent emit
   * overwrites previous labels (per the R7.1#3 follow-up design call —
   * matches Cursor / ChatGPT behaviour, simpler than stacking).
   *
   * Cleared on every transition out of ``running`` (RunFinalized /
   * RunError) so the thinking strip disappears the moment the run
   * settles.
   */
  progressLabel: string | null;
  /**
   * Append a user turn and run the agent. No-op while a run is in flight.
   * R5: ``attachmentIds`` is the list of staged attachment IDs that the
   * backend has already received; they ride along in
   * ``forwarded_props.attachment_ids`` so the pragna route can resolve
   * + inject the bytes before invoking the LLM.
   */
  send: (text: string, attachmentIds?: string[]) => void;
  /**
   * R4 #1. Same as :func:`send` but adds ``?user_model_id=<modelId>`` to
   * the pragna URL for this single run, so the default agent runs against
   * the chosen model instead of the conversation's persisted preference.
   * The conversation's own user_model_id is NOT updated — the next plain
   * :func:`send` falls back to the user's preference automatically.
   */
  sendWithModel: (text: string, userModelId: string) => void;
  /**
   * Landing → first-send variant. Like :func:`send`, but mutates the
   * pragna URL with ``?user_model_id=`` and ``?thinking_enabled=``
   * query params reconstructed from the landing's picker state. The
   * backend's pragna route reads these on auto-create and stamps the
   * conversation row's columns to match — without this, the first turn
   * would use server defaults regardless of what the user picked on
   * the landing.
   *
   * No-op for empty / running states. ``attachmentIds`` carried through
   * the same way :func:`send` carries them.
   */
  sendWithOverrides: (
    text: string,
    opts: {
      attachmentIds?: string[];
      userModelId?: string;
      thinkingEnabled?: boolean;
    },
  ) => void;
  /** Abort the current run. Safe to call when no run is active. */
  stop: () => void;
  /**
   * Background-Run Execution M5.2 — attach to a live background run
   * for the given conversation+episode via the BE M3 endpoint
   * (``POST /api/conversations/{cid}/episodes/{eid}/stream``).
   * The endpoint streams the full event log replay + any live events
   * the background task continues to publish; the existing
   * ``AgentSubscriber`` chain handles them identically to a normal
   * send (TEXT_MESSAGE_* deltas update the streaming bubble, etc).
   *
   * Used on FE remount when ``useOpenEpisode`` reports an active
   * episode for the current conversation — without this call, a
   * navigate-back during a mid-stream response would force the
   * user to reload the page to see the result.
   *
   * No-op if a run is already in flight (would double-POST).
   * Returns ``void`` synchronously; the run progresses through the
   * normal subscriber lifecycle, so consumers watch ``status`` for
   * completion.
   */
  attach: (conversationId: string, episodeId: string) => void;
  /**
   * Replace the agent's in-memory ``messages`` array wholesale and sync
   * to React state. Use after an out-of-band turn lands in persistence
   * — concretely, after a successful ``POST /episodes/{id}/resume``
   * call, whose SSE response is buffered as opaque text by
   * :class:`EpisodeRepository` and therefore bypasses the HttpAgent
   * entirely. Without this call, the chat surface keeps showing the
   * pre-resume state because ``agent.messages`` was never updated
   * with the post-form-submit assistant reply.
   *
   * Callers should pass the AG-UI-shaped messages they want to
   * become the new in-memory state (typically the
   * ``persistedMessages.map(persistedToAGUIMessage)`` output). Idempotent
   * — re-calling with the same content is harmless.
   */
  replaceMessages: (messages: Message[]) => void;
  /**
   * Per-streaming-message producer-model attribution. Keyed by the
   * AG-UI streaming ``message_id`` (LangChain ``lc_run--...`` shape),
   * value is the producing agent's ``user_models.id`` (string UUID).
   * Populated as ``TEXT_MESSAGE_START`` events arrive, by snapshotting
   * the latest ``model_attribution`` CustomEvent emitted by the BE
   * agent node.
   *
   * Why this exists: the BE persists each message with a fresh
   * ``uuid.uuid4()`` that does NOT equal the streaming id, so the
   * persisted-messages map (keyed by BE UUID) never matches an
   * in-memory message until ``replaceMessages`` swaps in the BE
   * ids — which happens AFTER the post-run refetch lands (~300ms
   * after RUN_FINISHED). Without this streaming-time map, the badge
   * renders the conversation's default model for that window, then
   * flips to the producer model. With it, the lookup hits
   * immediately on RUN_FINISHED — no visible flip.
   */
  streamingModelByMessageId: Map<string, string>;
}

export interface UseChatSessionOptions {
  /**
   * Pinning a stable ``thread_id`` lets the backend recognise this as a
   * resumed conversation. New chats pass a fresh UUID generated by the
   * view; resumed chats pass ``conversation.id``. Changes recreate the
   * underlying ``HttpAgent``.
   */
  threadId?: string;
  /**
   * Seed messages to hydrate the agent with on mount — used on resume
   * (the persisted history is fetched via :func:`useConversationMessages`
   * and passed in here). The first turn after mount appends to this
   * list rather than replacing it.
   *
   * The ``AgentConfig`` field is named ``initialMessages``; we keep the
   * same name for clarity.
   */
  initialMessages?: Message[];
}

/**
 * Stateful hook that wires a single :class:`HttpAgent` to React state.
 *
 * Lifetime:
 *   - One HttpAgent per ``(agentName, accessToken, threadId)`` triple,
 *     recreated on any of those changing. Reusing the same ``threadId``
 *     across requests is what makes "resume conversation" work.
 *   - The subscriber is installed once at agent creation and mirrors
 *     ``HttpAgent.messages`` into local state on every event.
 *
 * Concurrency: ``send`` is a no-op while a run is in flight. The user must
 * either wait or call ``stop`` first. ``stop`` aborts via the agent's
 * internal ``AbortController`` and re-enables ``send``.
 */
export function useChatSession(
  agentName: string,
  options: UseChatSessionOptions = {},
): ChatSessionApi {
  const { threadId, initialMessages } = options;
  const accessToken = useAuthStore((s) => s.accessToken);
  const qc = useQueryClient();

  // Background-Run Execution M5.2 follow-up — lazy-init from the
  // ``initialMessages`` prop so the FIRST render of ChatSurface already
  // has the seeded transcript visible. Previously this defaulted to
  // ``[]``, and the useEffect that runs ``syncMessages()`` updated the
  // state to the agent's seed AFTER the first commit — producing a
  // one-frame "blank scroll area" between commit-1 (empty list) and
  // commit-2 (real messages) on every conversation switch (since
  // ``key={conversationId}`` on ChatSurface forces a fresh mount).
  // The lazy initializer runs ONCE per mount: same `key`-driven
  // remount cadence as before, just with the right initial value.
  // Empty Map() for the tool-calls aggregator is correct here:
  // persisted seed messages don't have streaming tool calls (those
  // are accumulated only during live runs); ``toChatMessage`` reads
  // the map only when a message has ``toolCalls`` ids to resolve.
  const [messages, setMessages] = useState<ChatMessage[]>(() =>
    (initialMessages ?? []).map((m) => toChatMessage(m, new Map())),
  );
  const [status, setStatus] = useState<ChatStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  // R7.1#3 follow-up — latest on_progress label from the agent. Last-wins
  // across parallel agents per the design call. Cleared on RunFinalized /
  // RunError so the strip disappears the moment the run settles.
  const [progressLabel, setProgressLabel] = useState<string | null>(null);

  // toolCallId → ChatToolCall, accumulated across the run so partial-args
  // events can update the right call regardless of arrival interleaving.
  const toolCallsRef = useRef<Map<string, ChatToolCall>>(new Map());

  // Streaming-time per-message model attribution. Mirrors the BE
  // ``_TurnAccumulator`` rolling state — every agent node on the BE
  // emits a ``model_attribution`` CustomEvent carrying its
  // ``model_entity_id`` BEFORE the LLM call (and hence before the
  // matching ``TEXT_MESSAGE_START``). We track the latest value in
  // ``lastModelEntityIdRef`` and stamp it onto the streaming
  // message id when ``TEXT_MESSAGE_START`` fires. The map is the
  // FE counterpart of the BE's per-slot attribution stamp: it
  // lets the badge render the correct producer model the instant
  // streaming finishes, BEFORE the post-run ``GET /messages``
  // refetch lands (which would otherwise cause a ~300ms flip from
  // the conversation's default model to the actual producer once
  // the BE refetch arrives).
  const lastModelEntityIdRef = useRef<string | null>(null);
  const [streamingModelByMessageId, setStreamingModelByMessageId] =
    useState<Map<string, string>>(() => new Map());

  // R4 #1 regen-with-model: when `sendWithModel` runs, it mutates
  // `agent.url` to include `?user_model_id=<id>` so the pragna route
  // routes this single run through the override model. The original
  // URL is captured here and restored in onRunFinalized so the next
  // plain `send` reverts to the conversation's persisted preference.
  // `send` also mutates this URL when the user's message starts with
  // `/{slash_api_name}` matching one of their slash-exposed flows,
  // routing the run to `${PRAGNA_BASE_URL}/flows/{slash_api_name}`
  // instead. Same restore mechanism.
  const overrideUrlRef = useRef<string | null>(null);

  // User's slash-exposed flows, keyed by slash_api_name. Used at send
  // time to decide whether a `/{name}` prefix should route to the
  // deterministic /pragna/flows/{name} endpoint vs falling through to
  // /pragna/chat (where the LLM may or may not pick the flow as a
  // bound tool based on intent). Cached via React Query (staleTime:
  // 30s in usePragnaSlashFlows) so repeated sends don't refetch.
  const { data: allSlashFlows = [] } = usePragnaSlashFlows();
  const slashFlowNames = useMemo(() => {
    const names = new Set<string>();
    for (const f of allSlashFlows) {
      names.add(f.slash_api_name);
    }
    return names;
  }, [allSlashFlows]);

  const agent = useMemo<HttpAgent | null>(() => {
    if (!accessToken) return null;
    // The chat surface always invokes /pragna/chat by default. Slash
    // dispatch overrides the URL per-run inside ``send`` (see below);
    // the original URL is restored in onRunFinalized so subsequent
    // turns revert to the default-chat path.
    // The ``agentName`` parameter is kept for caller compatibility +
    // logging context, but no longer drives URL selection (the
    // /pragna/agents/{name} legacy route was removed in the
    // skills-collapse refactor).
    void agentName;
    return new HttpAgent({
      url: `${PRAGNA_BASE_URL}/chat`,
      headers: { Authorization: `Bearer ${accessToken}` },
      threadId,
      initialMessages,
    });
    // initialMessages is intentionally excluded from deps — it's a hydration
    // seed that should only matter when threadId changes. Including it would
    // re-create the agent (and reset state) every time a parent re-rendered
    // with a new array reference for the same history.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken, agentName, threadId]);

  // Sync agent.messages → React state. Called from every relevant subscriber
  // callback so the UI is always a snapshot of the canonical AbstractAgent
  // state. Calling setMessages with a fresh array reference forces a
  // re-render; React bails out internally if shallow contents match.
  const syncMessages = useCallback(() => {
    if (!agent) return;
    const mirrored = agent.messages.map((m: Message) => toChatMessage(m, toolCallsRef.current));
    setMessages(mirrored);
  }, [agent]);

  useEffect(() => {
    if (!agent) return undefined;
    toolCallsRef.current = new Map();
    setStatus('idle');
    setError(null);
    // Hydrate React state from the agent's seed history. For a brand-new
    // chat ``agent.messages`` is empty so this resolves to ``[]``; for a
    // resumed chat it contains the messages we passed in via
    // ``initialMessages``, which would otherwise stay invisible until the
    // user typed something (subscriber callbacks only fire during a live
    // run, never for the seed). Without this call, clicking a recent
    // conversation in the sidebar produced a blank chat surface.
    syncMessages();

    const subscriber: AgentSubscriber = {
      onRunInitialized: () => {
        setStatus('running');
        setError(null);
        // R7.1#3 — reset on every new run so the strip starts fresh,
        // not carrying the last label from the prior turn.
        setProgressLabel(null);
        // Streaming-time model attribution map. Reset between runs:
        // by the time onRunInitialized fires for the NEXT run, the
        // previous run's BE refetch has landed and ``replaceMessages``
        // has swapped in BE-canonical ids, so the streaming-id
        // entries are no longer consulted. Clearing bounds growth.
        lastModelEntityIdRef.current = null;
        setStreamingModelByMessageId(new Map());
      },
      onRunFailed: ({ error: e }) => {
        // Background-Run Execution M5.2 follow-up — AbortError is the
        // signature of a user-initiated unwind (navigation, Stop
        // button, agent swap on conversation switch). It is NOT "the
        // run failed" — there's nothing for the user to see, nothing
        // to surface in the banner, no log to ship to the structured
        // logger. Reset state silently so the next action runs
        // against a clean slate. The ``key={conversationId}`` remount
        // at the ChatSurface render site already makes the most
        // common path (cross-conversation navigation) call setState
        // on an unmounted component — but the guard here covers the
        // same-conversation cases (stop button, slash-URL override
        // restore mid-run, future paths) without forcing a remount.
        if (
          e instanceof Error
          && (e.name === 'AbortError' || /aborted/i.test(e.message))
        ) {
          setStatus('idle');
          setProgressLabel(null);
          return;
        }
        setStatus('error');
        setError(e.message || 'Run failed');
        // R7.1#3 — strip disappears on terminal state per the design
        // call (no "Stopping..." beat, matches ChatGPT/Claude.ai).
        setProgressLabel(null);
        logger.fromError('CHT_004:run_failed', e);
      },
      onRunFinalized: () => {
        setStatus((prev) => (prev === 'error' ? prev : 'idle'));
        setProgressLabel(null);
        // Restore the agent URL after a regen-with-model run so the
        // next plain `send` reverts to the conversation's persisted
        // user_model_id (the per-turn override is exactly that —
        // per-turn, never sticky).
        if (overrideUrlRef.current !== null && agent) {
          agent.url = overrideUrlRef.current;
          overrideUrlRef.current = null;
        }
        // Background-Run Execution M5.2 follow-up — scoped invalidate.
        // The previous ``invalidateQueries({ queryKey: ['conversations'] })``
        // was a prefix match: it invalidated the sidebar list AND every
        // ``['conversations', <id>, 'messages' | 'usage' | 'episodes' |
        // 'single']`` for EVERY conversation in the cache. One chat
        // completion produced 5+ duplicate refetches in dev.
        //
        // The helper invalidates ONLY:
        //   (1) the sidebar lists (auto-created conv appears, title arrives),
        //   (2) THIS conversation's single-lookup (chat header title).
        // Per-conv ``messages`` for THIS thread is handled by the explicit
        // invalidate below. Per-conv ``usage`` / ``episodes`` for
        // unrelated conversations are left alone.
        invalidateConversationListQueries(qc, {
          conversationId: threadId ?? undefined,
        });
        // R4 #0: refetch the persisted message log for THIS conversation
        // so each assistant turn picks up its `user_model_id` attribution.
        // Mid-stream messages render with the conversation's preferred
        // model as a fallback; this invalidation upgrades them to the
        // authoritative server-stamped value (which matters when the
        // user used a per-turn ?user_model_id override).
        if (threadId) {
          qc.invalidateQueries({
            queryKey: ['conversations', threadId, 'messages'],
          });
        }
      },
      onTextMessageStartEvent: ({ event }) => {
        syncMessages();
        // Snapshot the rolling per-run ``model_attribution`` value
        // onto this message's streaming id. The BE emits a
        // ``model_attribution`` custom event in the same agent-node
        // ``__call__`` that produces this text — ALWAYS BEFORE the
        // matching ``TEXT_MESSAGE_START``, so the ref is populated
        // by the time we land here. After this, the render-time
        // lookup at the streaming id resolves to the producer model.
        const modelId = lastModelEntityIdRef.current;
        if (modelId) {
          setStreamingModelByMessageId((prev) => {
            const next = new Map(prev);
            next.set(event.messageId, modelId);
            return next;
          });
        }
      },
      onTextMessageContentEvent: () => {
        syncMessages();
      },
      onTextMessageEndEvent: () => {
        syncMessages();
      },
      onToolCallStartEvent: ({ event }) => {
        toolCallsRef.current.set(event.toolCallId, {
          id: event.toolCallId,
          name: event.toolCallName,
          argsBuffer: '',
          complete: false,
        });
        syncMessages();
      },
      onToolCallArgsEvent: ({ event, toolCallBuffer, partialToolCallArgs }) => {
        const existing = toolCallsRef.current.get(event.toolCallId);
        if (existing) {
          toolCallsRef.current.set(event.toolCallId, {
            ...existing,
            argsBuffer: toolCallBuffer,
            args: partialToolCallArgs as Record<string, unknown>,
          });
          syncMessages();
        }
      },
      onToolCallEndEvent: ({ event, toolCallArgs }) => {
        const existing = toolCallsRef.current.get(event.toolCallId);
        if (existing) {
          toolCallsRef.current.set(event.toolCallId, {
            ...existing,
            args: toolCallArgs as Record<string, unknown>,
            complete: true,
          });
          syncMessages();
        }
      },
      onToolCallResultEvent: ({ event }) => {
        const existing = toolCallsRef.current.get(event.toolCallId);
        if (existing) {
          toolCallsRef.current.set(event.toolCallId, {
            ...existing,
            result: event.content ?? '',
          });
        }
        syncMessages();
      },
      // R7.1#3 follow-up — every BaseAgentNode.__call__ on the BE
      // dispatches a LangChain on_progress custom event with payload
      // {label, agent_name}. ag_ui_langgraph forwards it as an AG-UI
      // CustomEvent with the same name. Last-wins: the most recent
      // emit overwrites previous labels (parallel agents render as a
      // single "currently active" indicator, matching Cursor /
      // ChatGPT behaviour).
      //
      // Unknown custom events are ignored — keeps the door open for
      // future event names without forcing every consumer to be
      // exhaustive.
      onCustomEvent: ({ event }) => {
        // on_progress — agent emitted a live thinking-strip label
        if (event.name === 'on_progress') {
          const value = event.value as { label?: unknown } | null | undefined;
          const label =
            value && typeof value === 'object' && typeof value.label === 'string'
              ? value.label
              : null;
          if (label) setProgressLabel(label);
          return;
        }

        // title_updated — BE pushes this right before closing the SSE
        // stream when auto-title generated a title for a fresh
        // conversation. Replaces the prior fire-and-forget + 3s polling
        // race. Invalidation triggers a single refetch that picks up
        // the new title in the sidebar immediately.
        if (event.name === 'title_updated') {
          qc.invalidateQueries({ queryKey: ['conversations'] });
          return;
        }

        // model_attribution — BE emits this from every agent node
        // before its LLM call, carrying ``{model_entity_id}``. The
        // value is the ``user_models.id`` (string UUID) the node's
        // LLM is bound to. Track latest in a ref; the next
        // ``TEXT_MESSAGE_START`` snapshots it onto the streaming
        // message id. Powers the no-flip badge render: by the time
        // the run ends and the badge renders against the streaming
        // id, the map already holds the producer model id.
        if (event.name === 'model_attribution') {
          const value = event.value as
            | { model_entity_id?: unknown }
            | null
            | undefined;
          const modelId =
            value &&
            typeof value === 'object' &&
            typeof value.model_entity_id === 'string' &&
            value.model_entity_id
              ? value.model_entity_id
              : null;
          if (modelId) lastModelEntityIdRef.current = modelId;
          return;
        }

        // Unknown custom events are ignored — keeps the door open for
        // future event names without forcing every consumer to be
        // exhaustive.
      },
    };

    const { unsubscribe } = agent.subscribe(subscriber);
    return () => {
      unsubscribe();
      // Background-Run Execution M2/M5.1 — ``abortRun`` aborts the
      // CLIENT-side fetch; it does NOT cancel the BE run. After the
      // backend's background-task refactor, the SSE handler is an
      // observer and the LLM call lives in an asyncio task that
      // survives client disconnect. Calling ``abortRun`` here means
      // "stop watching" — the response continues, persists, and the
      // user sees it on next reload OR via M5.2's live stream-attach
      // when they navigate back mid-run.
      agent.abortRun();
    };
  }, [agent, syncMessages, qc]);

  const send = useCallback(
    (text: string, attachmentIds?: string[]) => {
      const trimmed = text.trim();
      if (!agent || !trimmed) return;
      if (status === 'running') return;

      // If the message starts with `/{name}` where ``name`` matches a
      // slash-exposed flow, route this single run to the deterministic
      // /pragna/flows/{name} endpoint. The persisted user message
      // keeps the slash text intact so the chat history shows what
      // was invoked. URL restoration happens in onRunFinalized (same
      // overrideUrlRef path that sendWithModel uses).
      //
      // Slash takes precedence over any model / thinking overrides
      // sendWithOverrides set just above: a slash dispatch runs the
      // flow agent against its own configured model, so the per-turn
      // ?user_model_id / ?thinking_enabled query params don't apply.
      // If overrideUrlRef.current is already populated (sendWithOverrides
      // captured the base URL before mutating agent.url with query
      // params), keep that capture so onRunFinalized restores the same
      // original URL in either path.
      const slashMatch = SLASH_COMMAND_RE.exec(trimmed);
      if (slashMatch && slashFlowNames.has(slashMatch[1])) {
        const slashName = slashMatch[1];
        if (overrideUrlRef.current === null) {
          overrideUrlRef.current = agent.url;
        }
        agent.url = `${PRAGNA_BASE_URL}/flows/${encodeURIComponent(slashName)}`;
      }

      agent.messages.push({
        id: randomId(),
        role: 'user',
        content: trimmed,
      });
      syncMessages();

      // R5: when attachments are staged, ride them along via AG-UI's
      // forwardedProps side channel. The backend's pragna route reads
      // ``forwarded_props.attachment_ids`` and resolves / capability-
      // gates / injects multi-part content before invoking the LLM.
      const runParams =
        attachmentIds && attachmentIds.length > 0
          ? { forwardedProps: { attachment_ids: attachmentIds } }
          : {};

      agent.runAgent(runParams).catch((e: unknown) => {
        // runAgent rejects when the subscriber chain throws; the
        // onRunFailed handler already updated state in that case. Log
        // here for any unhandled rejection path.
        if (e instanceof Error && e.name === 'AbortError') return;
        logger.fromError(
          'CHT_004:run_rejected',
          e instanceof Error ? e : new Error(String(e)),
        );
      });
    },
    [agent, status, syncMessages, slashFlowNames],
  );

  const sendWithModel = useCallback(
    (text: string, userModelId: string) => {
      const trimmed = text.trim();
      if (!agent || !trimmed) return;
      if (status === 'running') return;
      // Capture the current URL so onRunFinalized can restore it. Then
      // mutate the agent's URL to carry the override for this single run.
      // HttpAgent reads `this.url` at fetch-issue time inside runAgent;
      // setting it before calling send (which calls runAgent) is enough.
      overrideUrlRef.current = agent.url;
      const base = agent.url.split('?')[0];
      agent.url = `${base}?user_model_id=${encodeURIComponent(userModelId)}`;
      send(text);
    },
    [agent, status, send],
  );

  const sendWithOverrides = useCallback(
    (
      text: string,
      opts: {
        attachmentIds?: string[];
        userModelId?: string;
        thinkingEnabled?: boolean;
      },
    ) => {
      const trimmed = text.trim();
      if (!agent || !trimmed) return;
      if (status === 'running') return;

      // Build query params from non-undefined opts. Either-or makes
      // ``thinking_enabled`` survive being set to ``false`` — we want
      // an explicit "off" to round-trip to the backend instead of
      // being dropped.
      const params = new URLSearchParams();
      if (opts.userModelId) {
        params.set('user_model_id', opts.userModelId);
      }
      if (opts.thinkingEnabled !== undefined) {
        params.set('thinking_enabled', String(opts.thinkingEnabled));
      }

      if (params.toString().length > 0) {
        overrideUrlRef.current = agent.url;
        const base = agent.url.split('?')[0];
        agent.url = `${base}?${params.toString()}`;
      }

      send(text, opts.attachmentIds);
    },
    [agent, status, send],
  );

  const stop = useCallback(() => {
    if (agent && status === 'running') {
      agent.abortRun();
      setStatus('idle');
      // R7.1#3 — clear immediately on stop. RunFinalized also clears,
      // but it can lag a few hundred ms behind agent.abortRun; we want
      // the strip to disappear the instant the user clicks Stop.
      setProgressLabel(null);
    }
  }, [agent, status]);

  const attach = useCallback(
    (conversationId: string, episodeId: string) => {
      if (!agent) return;
      // Already running (e.g. the user submitted a new turn between
      // useOpenEpisode landing the active-episode result and this
      // callback firing) — don't double-POST. The active run is the
      // authoritative one; the live attach would just duplicate events
      // it's already going to deliver.
      if (status === 'running') return;

      // Capture the chat URL so the existing onRunFinalized restore
      // (overrideUrlRef.current → agent.url) puts the agent back on
      // /pragna/chat for the next send. Same pattern used by
      // sendWithModel / sendWithOverrides / slash dispatch.
      overrideUrlRef.current = agent.url;
      // Relative URL — vite proxies /api → backend in dev; same-origin
      // in prod. Matches the PRAGNA_BASE_URL pattern (relative for
      // CORS avoidance via the proxy).
      agent.url = `/api/conversations/${encodeURIComponent(conversationId)}/episodes/${encodeURIComponent(episodeId)}/stream`;

      // runAgent with no message push — the user message was eager-
      // persisted by the BE before the original SSE opened, so it's
      // already in the agent's seed (initialMessages). The attach
      // endpoint replays the event_log + live events; HttpAgent's
      // subscriber chain applies them to agent.messages exactly as
      // it would for a normal /pragna/chat call.
      agent.runAgent({}).catch((e: unknown) => {
        if (e instanceof Error && e.name === 'AbortError') return;
        logger.fromError(
          'CHT_004:attach_rejected',
          e instanceof Error ? e : new Error(String(e)),
        );
      });
    },
    [agent, status],
  );

  // Sync persisted messages into the agent's in-memory list. Needed
  // after /resume completes (its SSE stream is buffered by
  // EpisodeRepository, never flows through the agent). Idempotent.
  const replaceMessages = useCallback(
    (replacement: Message[]) => {
      if (!agent) return;
      agent.setMessages(replacement);
      syncMessages();
    },
    [agent, syncMessages],
  );

  return {
    messages,
    status,
    error,
    progressLabel,
    send,
    sendWithModel,
    sendWithOverrides,
    stop,
    attach,
    replaceMessages,
    streamingModelByMessageId,
  };
}

/**
 * Translate an ``HttpAgent.messages`` entry into the UI's :class:`ChatMessage`
 * shape, attaching any tool calls we've accumulated in the running map.
 */
function toChatMessage(
  m: Message,
  toolCalls: Map<string, ChatToolCall>,
): ChatMessage {
  if (m.role === 'assistant') {
    const calls = m.toolCalls
      ?.map((tc) => toolCalls.get(tc.id))
      .filter((tc): tc is ChatToolCall => Boolean(tc));
    return {
      id: m.id,
      role: 'assistant',
      content: m.content ?? '',
      toolCalls: calls && calls.length > 0 ? calls : undefined,
    };
  }
  if (m.role === 'tool') {
    return {
      id: m.id,
      role: 'tool',
      content: m.content ?? '',
    };
  }
  if (m.role === 'system' || m.role === 'developer') {
    return { id: m.id, role: 'system', content: m.content ?? '' };
  }
  return {
    id: m.id,
    role: 'user',
    content: typeof m.content === 'string' ? m.content : '',
  };
}

function randomId(): string {
  // ``crypto.randomUUID`` is on every modern browser and jsdom; the fallback
  // exists only to keep TypeScript happy in environments without it.
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}
