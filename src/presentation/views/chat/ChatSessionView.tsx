import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import type { Message } from '@ag-ui/client';
import { ErrorBoundary } from '@/presentation/components/ui/ErrorBoundary';
import { useLlmProvidersWithRegistrations } from '@/presentation/hooks/providers/useProviders';
import { useConversation } from '@/presentation/hooks/conversations/useConversation';
import { useConversationMessages } from '@/presentation/hooks/conversations/useConversationMessages';
import {
  useBranchConversation,
  useTruncateFromMessage,
} from '@/presentation/hooks/conversations/useConversationMutations';
import { useFlows } from '@/presentation/hooks/flows/useFlows';
import { useModels } from '@/presentation/hooks/models/useModels';
import { useChatPreferences } from '@/presentation/hooks/preferences/useChatPreferences';
import { APP_NAME } from '@/constants/api';
import { ERRORS } from '@/constants/errors';
import { ROUTES } from '@/constants/routes';
import type {
  Conversation,
  PersistedMessage,
} from '@/domain/types/conversation.types';
import { useChatSession } from './hooks/useChatSession';
import {
  consumePendingInitialMessage,
  peekPendingInitialMessage,
  writePendingInitialMessage,
} from './hooks/initialMessageHandoff';
import { ChatMessage, type ChatMessageHandlers } from './components/ChatMessage';
import { ChatInput } from './components/ChatInput';
import { ChatHeader } from './components/ChatHeader';
import { ThinkingStrip } from './components/ThinkingStrip';
import { ModelPicker } from './components/ModelPicker';
import { SetupBanner } from './components/SetupBanner';
import {
  HITLFormCard,
  isHITLFormSubmittable,
} from './components/HITLFormCard';
import {
  type AskUserSchema,
  coerceForSubmit,
  initialFormValues,
} from './components/form/validators';
import {
  useEpisodes,
} from '@/presentation/hooks/episodes/useEpisodes';
import {
  useSetConversationModel,
  useSetThinkingEnabled,
} from '@/presentation/hooks/conversations/useConversationMutations';

const DEFAULT_AGENT_NAME = 'default';

/**
 * Active chat surface.
 *
 * Mounted at ``/chat/:id`` only — fresh threads begin life on
 * :class:`ChatLandingView` (``/chat``), which generates a UUID and
 * navigates here on the user's first send. Renders the hand-rolled AG-UI
 * chat UI when the user has at least one provider and one chat-available
 * model; otherwise shows a contextual setup prompt. Wraps the live chat
 * in :class:`ErrorBoundary` so a runtime failure (network drop, malformed
 * event stream, agent crash) surfaces as the ``CHT_003`` "Chat
 * unavailable" empty state rather than a white page.
 *
 * The layout shell (:class:`ChatView`) owns the sidebar; this view owns
 * the right panel only.
 */
export default function ChatSessionView() {
  const { id: conversationId } = useParams<{ id: string }>();
  // Snapshot the pending-handoff state ONCE per ``conversationId``. This
  // is load-bearing: the send-firing effect later in :class:`ChatSurface`
  // consumes sessionStorage, which would flip
  // ``peekPendingInitialMessage`` from returning the agent to returning
  // ``null`` mid-render. If agent resolution recomputed off that, the
  // fallback to ``"default"`` would kick in, ``useChatSession`` would
  // rebuild the HttpAgent for the new name, the old effect's cleanup
  // would call ``abortRun()`` on the in-flight run, and the user would
  // see ``AbortError: signal is aborted without reason`` ~100ms after
  // sending. Capturing the snapshot here keeps the handoff agent stable
  // for the lifetime of this conversationId.
  //
  // React Router reuses this component instance across ``:id`` param
  // changes, so the dep MUST be ``conversationId`` (not empty deps) —
  // otherwise the snapshot would stay frozen for a never-revisited id.
  const handoffSnapshot = useMemo(
    () => peekPendingInitialMessage(conversationId),
    [conversationId],
  );
  const isBrandNew = handoffSnapshot !== null;
  const handoffAgent = handoffSnapshot?.agent ?? null;

  const { data: providers = [], isLoading: providersLoading } =
    useLlmProvidersWithRegistrations();
  const { data: conversation, isLoading: conversationLoading } =
    useConversation(conversationId);
  // Always-on (when conversationId is defined). The earlier
  // ``{ enabled: !isBrandNew }`` guard pre-dated eager-create — back
  // when the conversation row was created lazily inside ``/pragna``,
  // a fresh chat's first GET /messages would 404. With eager-create
  // (commit bbaf69f) the row exists before this view mounts, so the
  // guard now only causes harm: persistedMessages stays empty for
  // the lifetime of the session, which breaks the post-resume sync
  // in the useEffect below (no signal that new messages persisted).
  const { data: persistedMessages, isLoading: messagesLoading } =
    useConversationMessages(conversationId);
  // Flows feed the resumed-conversation agent resolution: the persisted
  // ``conversation.flowId`` (a UUID) is mapped to the flow's name for
  // logging context. The default chat path always hits /pragna/chat;
  // slash dispatch happens per-turn inside ``useChatSession`` (see
  // SLASH_COMMAND_RE there) and routes to /pragna/flows/{name}.
  const { data: flows = [], isLoading: flowsLoading } = useFlows();

  // Resolve which agent this conversation runs against. Three-step
  // fallback:
  //   1. Brand-new chat mid-handoff: ``handoffAgent`` carries the name
  //      picked on the landing, snapshotted at mount above so it's
  //      stable even after sessionStorage is consumed.
  //   2. Resumed chat with a flow-backed conversation row: look the
  //      flow up by id and use its name.
  //   3. Free chat ("default") for everything else, including
  //      conversations whose flow was deleted out from under them.
  const agentName = useMemo(() => {
    if (handoffAgent) return handoffAgent;
    if (conversation?.flowId) {
      const flow = flows.find((f) => f.id === conversation.flowId);
      if (flow) return flow.apiName;
    }
    return DEFAULT_AGENT_NAME;
  }, [handoffAgent, conversation, flows]);

  if (providersLoading) return <LoadingState />;

  const connectedProviders = providers.filter((p) => p.userProviders.length > 0);
  const hasProviders = connectedProviders.length > 0;
  const hasChatModel = connectedProviders.some((p) =>
    p.userProviders.some((up) =>
      up.models.some((m) => m.enabled && m.availableForChat),
    ),
  );

  // History stays visible even when the user has no provider /
  // chat-model configured — the gating banner is rendered inline in
  // the composer (see ``ChatSurface``), and ``ChatInput`` is disabled
  // until the gate clears. Matches the landing page's pattern.

  // On resumed chats, wait for messages AND flows AND the conversation
  // row itself before mounting ChatSurface. Without the conversation
  // gate, ``agentName`` would briefly resolve to ``"default"`` before
  // ``conversation.flowId`` arrives, the agent would rebuild as soon
  // as it does, and the in-flight first turn (if any) would abort.
  // Brand-new chats skip every fetch — the handoff snapshot already
  // carries the agent name, and there's no row to wait for yet.
  if (
    conversationId
    && !isBrandNew
    && (messagesLoading || flowsLoading || conversationLoading)
  ) {
    return <LoadingState />;
  }

  return (
    <ErrorBoundary logTag="CHT_003" fallback={<ChatUnavailable />}>
      <ChatSurface
        conversationId={conversationId}
        conversation={conversation}
        persistedMessages={persistedMessages ?? []}
        agentName={agentName}
        hasProviders={hasProviders}
        hasChatModel={hasChatModel}
      />
    </ErrorBoundary>
  );
}

/**
 * Translate a persisted backend message into the AG-UI in-memory shape
 * the agent will hydrate from.
 *
 * Tool-call fidelity is intentionally NOT preserved across resume in R1
 * — the assistant text is enough context for the LLM to continue the
 * thread. Full tool-call rehydration is tracked for R4 (per-message
 * model attribution sits in the same neighbourhood of work).
 */
function persistedToAGUIMessage(m: PersistedMessage): Message {
  if (m.role === 'assistant') {
    return { id: m.id, role: 'assistant', content: m.content } as Message;
  }
  if (m.role === 'system') {
    return { id: m.id, role: 'system', content: m.content } as Message;
  }
  if (m.role === 'tool') {
    // Tool turns get an empty toolCallId — they're seeded as historical
    // context only. New turns won't reference them.
    return {
      id: m.id,
      role: 'tool',
      content: m.content,
      toolCallId: '',
    } as Message;
  }
  return { id: m.id, role: 'user', content: m.content } as Message;
}

interface ChatSurfaceProps {
  conversationId: string | undefined;
  conversation: Conversation | null | undefined;
  persistedMessages: PersistedMessage[];
  /** Resolved agent name. See ``ChatSessionView`` for the resolution
   *  fallback chain (handoff → flow lookup → default). */
  agentName: string;
  /** False when the user has no LLM provider connected. History stays
   *  visible; the composer renders the gating banner inline + disables
   *  send. Pattern mirrors the landing page. */
  hasProviders: boolean;
  /** False when no provider has at least one ``available_for_chat``
   *  model. Same treatment as ``!hasProviders``. */
  hasChatModel: boolean;
}

/**
 * Live chat surface — header + message list + composer + status footer.
 *
 * Split out from the parent so it only mounts (and instantiates the
 * underlying :class:`HttpAgent`) once the provider/model gating and the
 * resume-load have completed. Aborts any in-flight run on unmount via
 * the hook's cleanup.
 */
function ChatSurface({
  conversationId,
  conversation,
  persistedMessages,
  agentName,
  hasProviders,
  hasChatModel,
}: ChatSurfaceProps) {
  const ready = hasProviders && hasChatModel;
  // The agent's threadId is the conversation id from the URL — the
  // landing view already generated it before navigating here. The
  // ``?? crypto.randomUUID()`` fallback is defensive only (the route
  // guarantees an id), kept stable across re-renders via ``useMemo`` so
  // the agent isn't recreated unnecessarily.
  const threadId = useMemo(
    () => conversationId ?? crypto.randomUUID(),
    [conversationId],
  );

  const initialMessages = useMemo(
    () => persistedMessages.map(persistedToAGUIMessage),
    [persistedMessages],
  );

  // R4 #0. Per-message attribution map (message_id → user_model_id)
  // built from the persisted server state. Mid-stream turns won't have
  // entries here; we fall back to `conversation.userModelId` when
  // rendering so live turns still show a "by <model>" badge. Once the
  // turn finishes streaming and the messages query re-fetches (see the
  // invalidation hook in useChatSession.onRunFinalized), the map gains
  // the authoritative attribution and the badge updates.
  const userModelIdByMessage = useMemo(() => {
    const map = new Map<string, string | null>();
    for (const m of persistedMessages) {
      map.set(m.id, m.userModelId);
    }
    return map;
  }, [persistedMessages]);

  // R5: per-message attachments map, same pattern as the model-id
  // lookup above. Empty for non-user turns / turns sent without
  // attachments. The chat-message renderer takes the list and shows
  // a chip row beneath the user-turn bubble.
  const attachmentsByMessage = useMemo(() => {
    const map = new Map<string, typeof persistedMessages[0]['attachments']>();
    for (const m of persistedMessages) {
      if (m.attachments && m.attachments.length > 0) {
        map.set(m.id, m.attachments);
      }
    }
    return map;
  }, [persistedMessages]);

  // BE migration 0022. Per-message finish_reason map sourced from the
  // persisted server state. Drives the inline ``Continue`` button on
  // assistant bubbles where the LLM ran out of output budget — the
  // user clicks once, we send a tiny "continue" prompt, and the model
  // picks up where it stopped. Only the LAST assistant message in the
  // conversation is eligible; continuing in the middle of history
  // would interleave turns in confusing ways.
  const finishReasonByMessage = useMemo(() => {
    const map = new Map<
      string,
      'stop' | 'length' | 'tool_calls' | 'other' | null
    >();
    for (const m of persistedMessages) {
      map.set(m.id, m.finishReason);
    }
    return map;
  }, [persistedMessages]);

  // Resolve once: id of the chronologically last assistant message. The
  // Continue button is shown ONLY against this message (even if older
  // assistant turns also length-stopped historically) — continuing on
  // a non-tail message would re-order the conversation.
  const lastAssistantId = useMemo(() => {
    for (let i = persistedMessages.length - 1; i >= 0; i--) {
      if (persistedMessages[i].role === 'assistant') {
        return persistedMessages[i].id;
      }
    }
    return null;
  }, [persistedMessages]);

  const { messages, status, error, progressLabel, send, sendWithModel, sendWithOverrides, stop, replaceMessages, streamingModelByMessageId } = useChatSession(
    agentName,
    { threadId, initialMessages },
  );

  // After /resume completes, the buffered SSE stream is discarded by
  // EpisodeRepository — it never flows through the HttpAgent — so
  // ``agent.messages`` stays at the pre-pause state (e.g. 2 entries:
  // user prompt + assistant tool-call) even though persistence now
  // has the form submission + the assistant's final reply.
  // ``useResumeEpisode.onSuccess`` invalidates the messages query, so
  // ``persistedMessages`` refreshes; this effect detects the size
  // mismatch and pushes the fresh server state into the agent so the
  // chat surface renders the new turns.
  //
  // Also reconciles a more subtle id-mismatch case that surfaces
  // on EVERY non-default-chat run:
  //
  // * The AG-UI stream emits ``TEXT_MESSAGE_START`` with the
  //   LangChain AIMessage id (e.g. ``lc_run--019e64c2-...``). The
  //   in-memory ``messages`` array uses those ids.
  // * The backend persists each row with a fresh ``uuid.uuid4()``
  //   (see ``SqlMessageRepository.append_many``). The API returns
  //   those UUIDs as ``id``, which feeds ``persistedMessages``.
  // * Per-message lookups (``userModelIdByMessage.get(m.id)``,
  //   ``finishReasonByMessage.get(m.id)``) key on the persisted id.
  // * When in-memory ids are LangChain ids and lookup keys are BE
  //   UUIDs, every lookup misses and the JSX falls back to
  //   ``conversation?.userModelId`` (default-chat model). For slash
  //   flow turns, that mis-attributes the bubble — Gemini-produced
  //   content shows the Haiku badge. Title looked fine because it
  //   reads ``conversation.title`` directly, no per-message lookup.
  //
  // The fix is to swap in the persistedMessages-derived list once
  // the run settles. That replaces the LangChain ids with BE UUIDs;
  // subsequent renders match.
  //
  // Guards:
  //   - ``status !== 'running'``: never overwrite an in-flight live
  //     stream (the agent's state is authoritative during /pragna).
  //   - ``persistedMessages.length > messages.length``: original
  //     resume backfill path. Persistence has MORE turns; swap so
  //     the new turns appear.
  //   - Otherwise (sizes match), swap iff the LAST message's id
  //     differs — that's the id-reconciliation case. Cheap check
  //     since same-size + same-tail-id means we've already swapped
  //     or there's nothing to do.
  useEffect(() => {
    if (status === 'running') return;
    if (messages.length === 0) return;
    if (persistedMessages.length > messages.length) {
      replaceMessages(initialMessages);
      return;
    }
    if (persistedMessages.length === messages.length) {
      const lastInMemory = messages[messages.length - 1];
      const lastPersisted = persistedMessages[persistedMessages.length - 1];
      if (lastInMemory.id !== lastPersisted.id) {
        replaceMessages(initialMessages);
      }
    }
  }, [persistedMessages, messages, status, initialMessages, replaceMessages]);

  // R6b — open-episode lookup + form state for the HITL pause flow.
  // ``useEpisodes`` fetches the most-recent episode for this conversation
  // and treats it as "open" iff its status is active/awaiting_user.
  // While the run is in flight (status === 'running') we still poll the
  // open-episode query because the backend may flip it to
  // ``awaiting_user`` mid-stream once the LLM tool-calls ``ask_user``.
  //
  // Form values + touched bitmap + composer text are LIFTED HERE (rather
  // than living inside HITLFormCard) so the composer can double as the
  // form's free-text field when ``schema.allow_text_input`` is true —
  // the submit dispatch needs both halves in one place.
  const episodes = useEpisodes(conversationId);
  const hitlSchema = useMemo<AskUserSchema | null>(() => {
    const open = episodes.openEpisode;
    if (!open || open.status !== 'awaiting_user') return null;
    const raw = (open.interruptValue as { schema?: AskUserSchema } | null)
      ?.schema;
    return raw ?? null;
  }, [episodes.openEpisode]);

  // UI-presence view of the schema: null the moment the user submits so
  // the form vanishes AND the composer reclaims its slot in the same
  // render. Without this, the openEpisode cache still holds
  // ``awaiting_user`` for the ~10-15s window between the resume mutation
  // firing and its onSuccess landing — long enough that the band below
  // the messages would render as an empty strip (form hidden by the
  // ``!resume.isPending`` gate, composer hidden because raw hitlSchema
  // still implies form-mode). Behaviour decisions (``canSubmitHitl``,
  // ``submitHitl``) keep using raw ``hitlSchema`` — they need the
  // schema definition itself, not its UI-visible state.
  const activeFormSchema =
    hitlSchema && !episodes.resume.isPending ? hitlSchema : null;
  const [hitlValues, setHitlValues] = useState<Record<string, unknown>>({});
  const [hitlTouched, setHitlTouched] = useState<Record<string, boolean>>({});
  const [hitlComposerText, setHitlComposerText] = useState('');

  // Reset form state whenever the open episode changes (e.g. a fresh
  // ask_user pause supersedes the previous one, or the episode
  // completed and a new one has yet to open). Keying on episode.id
  // means switching to a different conversation also resets cleanly.
  const hitlEpisodeId = episodes.openEpisode?.id;
  useEffect(() => {
    if (!hitlSchema) {
      setHitlValues({});
      setHitlTouched({});
      setHitlComposerText('');
      return;
    }
    setHitlValues(initialFormValues(hitlSchema));
    setHitlTouched({});
    setHitlComposerText('');
  }, [hitlEpisodeId, hitlSchema]);

  // Surface the resume mutation error to the form card.
  const resumeError =
    episodes.resume.isError && episodes.resume.error instanceof Error
      ? episodes.resume.error.message
      : null;

  const canSubmitHitl = hitlSchema
    ? isHITLFormSubmittable(hitlSchema, hitlValues) && !episodes.resume.isPending
    : false;

  // The submit handler used by BOTH the form card's submit button AND
  // the composer's send button (in form-mode). Reads form values +
  // composer text from the lifted state and dispatches the resume
  // mutation. On success the open-episode query refetches and either
  // unmounts this form (episode terminated) OR re-renders with the
  // next pause's schema (LLM tool-called ask_user again).
  const submitHitl = useCallback(() => {
    if (!hitlSchema) return;
    const isAllowingText = Boolean(hitlSchema.allow_text_input);
    episodes.resume.mutate(
      {
        form: coerceForSubmit(hitlSchema, hitlValues),
        text: isAllowingText ? hitlComposerText : '',
      },
      {
        onSuccess: () => {
          setHitlComposerText('');
        },
      },
    );
  }, [hitlSchema, hitlValues, hitlComposerText, episodes.resume]);

  // R4 #1 regen-with-model: only the default chat agent supports per-turn
  // model override (flow nodes have their own model bindings). For other
  // agents we omit availableModels so the dropdown chevron hides. The
  // user can also turn the feature off entirely via Settings → Profile
  // (`prefs.regenWithModelEnabled`).
  const { data: allModels } = useModels();
  const { prefs } = useChatPreferences();
  const availableModels = useMemo(() => {
    if (!prefs.regenWithModelEnabled) return [];
    if (agentName !== DEFAULT_AGENT_NAME) return [];
    if (!allModels) return [];
    return allModels
      .filter((m) => m.enabled && !m.archived && m.availableForChat)
      .map((m) => ({ id: m.id, displayName: m.displayName }));
  }, [prefs.regenWithModelEnabled, agentName, allModels]);

  // R5 Phase 6: capability flags for the active model. The composer
  // uses these to disable image uploads when the model lacks vision,
  // and PDF uploads when the model lacks PDF support. Defaults to
  // permissive (true/true) when we don't yet know — the backend is
  // the authoritative gate.
  const modelCapabilities = useMemo(() => {
    if (!allModels || !conversation?.userModelId) {
      return { vision: true, pdf: true };
    }
    const active = allModels.find((m) => m.id === conversation.userModelId);
    if (!active) return { vision: true, pdf: true };
    return { vision: active.supportsVision, pdf: active.supportsPdf };
  }, [allModels, conversation?.userModelId]);

  // ── R4 #1 message-actions wiring ────────────────────────────────────
  // Regenerate, Copy, Edit, Branch are composable on top of the existing
  // truncate / branch repo calls + the chat session's send(). The handlers
  // live here (not in `useChatSession`) because they need access to the
  // full message list AND the conversation id, both of which are
  // surface-level concerns.
  const navigate = useNavigate();
  const truncateMutation = useTruncateFromMessage();
  const branchMutation = useBranchConversation();

  /** Find the user message that prompted the given assistant message. */
  const findPriorUserContent = useCallback(
    (assistantMessageId: string): string | null => {
      const idx = messages.findIndex((m) => m.id === assistantMessageId);
      if (idx <= 0) return null;
      // Walk backwards to the first user turn — there can be tool /
      // system messages between the user prompt and the assistant
      // response, so simple `idx - 1` isn't always correct.
      for (let i = idx - 1; i >= 0; i--) {
        if (messages[i].role === 'user') return messages[i].content;
      }
      return null;
    },
    [messages],
  );

  const handlers = useMemo<ChatMessageHandlers | undefined>(() => {
    // No conversation id means we're on a brand-new chat that hasn't
    // materialised a server-side row yet — truncate + branch routes
    // would 404. Skip the handlers; the hover affordances just don't
    // render. As soon as the first turn finishes and the row exists,
    // the handlers light up.
    if (!conversationId) return undefined;
    return {
      onRegenerate: (assistantMessageId: string) => {
        const priorContent = findPriorUserContent(assistantMessageId);
        if (!priorContent) return;
        truncateMutation.mutate(
          { conversationId, messageId: assistantMessageId },
          {
            onSuccess: () => {
              // Re-run the same user message through the existing chat
              // stream. The backend writes a fresh assistant turn
              // attributed to the conversation's currently-bound model.
              send(priorContent);
            },
          },
        );
      },
      onRegenerateWithModel: (assistantMessageId: string, modelId: string) => {
        const priorContent = findPriorUserContent(assistantMessageId);
        if (!priorContent) return;
        truncateMutation.mutate(
          { conversationId, messageId: assistantMessageId },
          {
            onSuccess: () => {
              // sendWithModel temporarily appends ?user_model_id=<modelId>
              // to the pragna URL so this ONE turn runs against the
              // chosen model. The conversation's persisted preference
              // stays untouched — the next plain Regenerate falls back
              // to it automatically.
              sendWithModel(priorContent, modelId);
            },
          },
        );
      },
      onCopy: async (content: string) => {
        await navigator.clipboard.writeText(content);
      },
      onEdit: (userMessageId: string, newContent: string) => {
        truncateMutation.mutate(
          { conversationId, messageId: userMessageId },
          {
            onSuccess: () => {
              send(newContent);
            },
          },
        );
      },
      onBranch: (userMessageId: string) => {
        branchMutation.mutate(
          { conversationId, messageId: userMessageId },
          {
            onSuccess: (fork) => {
              // After navigation the new ChatSessionView mounts, fetches
              // the cloned messages (including the branch-point user
              // turn), and auto-fires a regen via the handoff slot so
              // the user sees a fresh assistant reply immediately.
              // Re-using the existing landing→session handoff keeps the
              // wiring single-sourced.
              const branchPoint = messages.find(
                (m) => m.id === userMessageId,
              );
              if (branchPoint?.role === 'user') {
                writePendingInitialMessage(fork.id, {
                  text: branchPoint.content,
                  agent: agentName,
                });
              }
              navigate(`${ROUTES.CHAT}/${fork.id}`);
            },
          },
        );
      },
      onContinue: () => {
        // BE migration 0022. Length-stopped assistant — fire a tiny
        // continuation prompt. The LLM picks up where it stopped
        // because the prior (truncated) assistant message is still in
        // its context window. Matches the ChatGPT/Claude.ai pattern
        // exactly: a NEW assistant turn that continues the thought,
        // not an in-place edit of the previous bubble.
        send('continue');
      },
    };
  }, [
    conversationId,
    findPriorUserContent,
    truncateMutation,
    branchMutation,
    send,
    sendWithModel,
    navigate,
    agentName,
    messages,
  ]);

  // Landing handoff: if the user just sent a message from ChatLandingView,
  // the text is sitting in sessionStorage under this conversation's id.
  // Read + delete it on first mount, then fire the send once the hook is
  // ready. Removal is the bit that makes refresh safe — a refresh of
  // /chat/{id} re-mounts but finds nothing, so it just shows history.
  //
  // The consume + send is scheduled via ``setTimeout(0)`` so it runs on
  // the next macrotask. That defers it past React 18 StrictMode's dev
  // double-mount cycle (mount → cleanup → remount, all synchronous): the
  // first mount's cleanup cancels the timer before it fires, so the
  // ``useChatSession`` cleanup never aborts a freshly-started run. In
  // production (no double-mount) the cycle is one tick longer than a
  // synchronous send, which is invisible to the user.
  useEffect(() => {
    if (!conversationId) return;
    if (status === 'running') return;

    const timer = window.setTimeout(() => {
      const pending = consumePendingInitialMessage(conversationId);
      if (!pending) return;
      // When the landing's handoff carries a model pick or extended-
      // thinking choice, route the first send through
      // ``sendWithOverrides`` so both ride the URL as query params and
      // the backend can stamp them onto the auto-created conversation.
      // Otherwise the plain ``send`` path is sufficient (backend uses
      // user's default model on auto-create).
      const hasOverrides =
        pending.userModelId !== undefined ||
        pending.thinkingEnabled !== undefined;
      if (hasOverrides) {
        sendWithOverrides(pending.text, {
          attachmentIds: pending.attachmentIds,
          userModelId: pending.userModelId,
          thinkingEnabled: pending.thinkingEnabled,
        });
      } else {
        // R5: pass attachmentIds (if any) through to the first send so
        // the backend can resolve + inject them on the same turn.
        send(pending.text, pending.attachmentIds);
      }
    }, 0);

    return () => window.clearTimeout(timer);
  }, [conversationId, send, sendWithOverrides, status]);

  const scrollRef = useRef<HTMLDivElement>(null);
  const didInitialScroll = useRef(false);

  // First mount on a resumed conversation: jump to the bottom once,
  // without animation, so the user lands at the latest turn. Avoids
  // visible scroll-from-top flicker on resume.
  useEffect(() => {
    if (didInitialScroll.current) return;
    if (messages.length === 0) return;
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
    didInitialScroll.current = true;
  }, [messages]);

  // Live tail: keep the latest message in view as it streams in or
  // when a new turn arrives.
  useEffect(() => {
    if (!didInitialScroll.current) return;
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, status]);

  return (
    <div className="flex h-full flex-col bg-background">
      <ChatHeader conversation={conversation} />

      <div
        ref={scrollRef}
        // ``pb-10`` (40px) gives the last assistant turn meaningful
        // breathing room above the composer when the user is scrolled
        // to the bottom of a long conversation. Combined with the
        // chat input wrapper's own ``pt-2`` and ChatInput's internal
        // ``py-3`` the visible gap reads as ~60px — enough to clearly
        // separate the two surfaces without wasting screen real estate.
        //
        // ``[scrollbar-gutter:stable]`` reserves scrollbar space at all
        // times so the message column doesn't shift horizontally when
        // the scrollbar appears/disappears between conversations. On
        // platforms with always-visible scrollbars (Windows/Linux) this
        // also keeps the column aligned with the non-scrolling chat
        // input wrapper below.
        className="flex-1 overflow-y-auto px-4 pt-6 pb-10 [scrollbar-gutter:stable]"
        aria-live="polite"
        aria-busy={status === 'running'}
      >
        {messages.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="mx-auto flex max-w-3xl flex-col gap-4">
            {messages.map((m) => (
              <ChatMessage
                key={m.id}
                message={m}
                userModelId={
                  // Fallback chain, ordered most-authoritative first:
                  //   1. BE-persisted per-message attribution (keyed by
                  //      ``persistedMessages[i].id`` — BE UUIDs). Hits
                  //      after the post-run refetch lands AND
                  //      ``replaceMessages(initialMessages)`` has
                  //      swapped streaming ids for BE UUIDs.
                  //   2. Streaming-time attribution (keyed by AG-UI
                  //      ``message_id`` — LangChain ``lc_run--...``).
                  //      Hits in the window between RUN_FINISHED and
                  //      the refetch landing — the gap that previously
                  //      showed a visible flip to the conversation
                  //      default before the producer model resolved.
                  //   3. Conversation default — last-resort fallback
                  //      for mid-stream renders where neither map has
                  //      seen the message yet.
                  userModelIdByMessage.get(m.id) ??
                  streamingModelByMessageId.get(m.id) ??
                  conversation?.userModelId ??
                  null
                }
                attachments={attachmentsByMessage.get(m.id) ?? []}
                handlers={handlers}
                availableModels={availableModels}
                branchEnabled={prefs.branchEnabled}
                conversationId={conversationId}
                finishReason={finishReasonByMessage.get(m.id) ?? null}
                isLastAssistant={
                  m.role === 'assistant' && m.id === lastAssistantId
                }
              />
            ))}
            {/* R7.1#3 follow-up — thinking strip rendered after the
                last message bubble, so it sits visually just below
                the most recent user turn (where the streaming
                assistant response will appear). Hidden when not
                running, or when the open episode is awaiting_user
                (the HITLFormCard below the composer is the focal
                point in that state — no second "waiting" indicator). */}
            {/* Persistent Pragna indicator — always present at the
                bottom of the message column so the chat surface always
                shows the app logo (claude.ai-style "ready for your
                question" affordance). Morphs to "thinking" (animated
                logo + label text) when a run is in progress.
                Hidden only when:
                  - ``openEpisode.status === 'awaiting_user'`` AND the
                    resume mutation is NOT in flight (the form is the
                    focal indicator in that state).
                During a resume run (form just submitted, BE flips
                episode to ``active`` but the FE cache still says
                ``awaiting_user`` until it refetches) the form is
                hidden via ``episodes.resume.isPending`` below, and
                the strip should take over so the user sees the
                "agent is working" state. Without this, the user
                stares at a frozen form for 10+ seconds while the
                LLM runs and the SSE stream is buffered opaquely by
                EpisodeRepository — feels like the app is hung. */}
            {(episodes.openEpisode?.status !== 'awaiting_user' ||
              episodes.resume.isPending) && (
              <>
                <ThinkingStrip
                  label={
                    status === 'running'
                      ? progressLabel
                      : episodes.resume.isPending
                      ? // /resume's SSE events don't flow through
                        // ``useChatSession`` (the EpisodeRepository
                        // buffers the stream as opaque text — see
                        // ``reference-sse-through-agent-refactor``
                        // memory). progressLabel stays null. Use a
                        // generic fallback so the strip animates +
                        // text reads while the resume is in flight.
                        // The proper fix is the SSE-through-agent
                        // refactor; until then, this stops the
                        // "frozen form" UX.
                        'Working...'
                      : null
                  }
                />
                {/* Breathing-room spacer below the strip while running,
                    so the live-tail scroll-to-bottom effect lands the
                    indicator well above the composer instead of jamming
                    it against the input edge. Idle keeps the existing
                    ``pb-10`` rhythm with no extra spacer. */}
                {(status === 'running' || episodes.resume.isPending) && (
                  <div className="h-40 shrink-0" aria-hidden="true" />
                )}
              </>
            )}
          </div>
        )}
      </div>

      {error && (
        <div className="border-t border-[var(--color-error-border)] bg-[var(--color-error-bg)] px-4 py-2 text-[12px] text-[var(--color-error-text)]">
          {error}
        </div>
      )}

      {/* Mirror the message scroll-area structure exactly so the
          composer's left/right edges land on the same pixel column as
          the messages above. The scroll area is
              <div className="px-4 py-6">
                <div className="mx-auto max-w-3xl">{messages}</div>
              </div>
          so we use the same outer ``px-4`` + inner ``mx-auto max-w-3xl``
          pair here. ChatInput itself contributes only vertical padding;
          horizontal containment lives at this layer. */}
      <div className="px-4 pt-2">
        {/* Composer column is intentionally a touch wider than the
            message column above (820px vs ``max-w-3xl`` = 768px). This
            mirrors the ChatGPT pattern of having the input feel like a
            broader surface than individual message bubbles, and on
            platforms where the scroll area's vertical scrollbar takes
            real estate it visually balances out the off-centre shift
            of the messages. */}
        <div className="w-full max-w-2xl mx-auto">
          {/* R6b — HITL pause renders inline above the composer.
              When the schema's ``allow_text_input`` is true the
              composer stays visible AND its text doubles as the
              form's ``text`` field; when false, the composer is
              hidden entirely so the user can only submit via the
              form. */}
          {/* Hide the form the INSTANT the user submits (resume
              mutation in flight). ``activeFormSchema`` collapses to
              null while ``resume.isPending`` is true so the form
              vanishes and the composer (gated on the same value
              below) reappears in the same render. The BE has already
              flipped the episode to ``active`` at the start of
              /resume, but the FE cache still reads ``awaiting_user``
              until the mutation's onSuccess fires + the /episodes
              refetch lands — that's after the WHOLE SSE stream
              completes (~10-15s for a Gemini 2.5 Pro research run).
              Without this gate, the form sat frozen for the full
              LLM duration. ChatGPT/Claude.ai dismiss the form
              immediately on submit; this matches that UX. While
              the resume is in flight, the ThinkingStrip above takes
              over as the focal indicator and the composer surfaces
              a Stop button. */}
          {activeFormSchema && (
            <HITLFormCard
              schema={activeFormSchema}
              values={hitlValues}
              onValuesChange={setHitlValues}
              textValue={hitlComposerText}
              touched={hitlTouched}
              onTouchedChange={setHitlTouched}
              onSubmit={submitHitl}
              submitting={episodes.resume.isPending}
              errorMessage={resumeError}
              // R7 Tier 1 #2: the `file` field type uploads via the
              // existing attachments endpoint — needs the current
              // conversation id. Absent on brand-new chats whose
              // row hasn't materialised yet; the file renderer
              // shows a hint in that case.
              uploadContext={conversationId ? { conversationId } : undefined}
              // R7.1#3 — Cancel button on the form. The cancel
              // mutation flips the episode to ``cancelled``, writes
              // the "You cancelled …" transcript message, and
              // signals the streaming task on the BE. The badge ×
              // is gone (per R7.1#3 cancel UX v2), so this is the
              // sole cancel affordance during ``awaiting_user``.
              onCancel={() => episodes.cancel.mutate()}
              cancelling={episodes.cancel.isPending}
            />
          )}
          {/* The composer hides only when an HITL pause is active AND
              the schema disallows free text. In every other case it
              stays visible — either as a normal chat composer or as
              the form's free-text field (form-mode). Keyed off
              ``activeFormSchema`` so that during a resume
              ``isPending`` window the composer reclaims its slot
              immediately and surfaces the Stop button instead of
              leaving an empty band for the full LLM-run duration. */}
          {(!activeFormSchema || activeFormSchema.allow_text_input) && (
          <ChatInput
            onSend={send}
            // R7.1#3 cancel UX v2 + resume-Stop extension. Three cases:
            //   1) Resume mutation in flight (form just submitted,
            //      LLM running). The BE has flipped the episode to
            //      ``active`` at the start of /resume, but the FE's
            //      openEpisode cache still reads ``awaiting_user``
            //      until the post-mutation refetch lands. So the
            //      cached-status guard below would silently miss
            //      this case; we branch on ``resume.isPending``
            //      directly and fire cancel unconditionally.
            //      ``useChatSession.stop()`` is a no-op here (the
            //      resume doesn't go through HttpAgent), so skip it.
            //   2) Flow episode active outside of a resume (the
            //      lazy-create default-agent path). Cache and BE
            //      agree on ``active``; fire cancel + stop.
            //   3) Default chat generating (no episode) — just close
            //      the SSE locally. Matches ChatGPT / Claude.ai: the
            //      partial assistant response stays in the transcript;
            //      no system message.
            onStop={
              ready
                ? () => {
                    if (episodes.resume.isPending) {
                      episodes.cancel.mutate();
                      return;
                    }
                    if (
                      episodes.openEpisode &&
                      episodes.openEpisode.status === 'active'
                    ) {
                      episodes.cancel.mutate();
                    }
                    stop();
                  }
                : undefined
            }
            // Disable when streaming a response OR a resume run is in
            // flight OR the user hasn't finished setup. Keeps the
            // composer visible (with the gating banner inline) so
            // prior history stays readable, and lets ChatInput's
            // ``showStop = disabled && onStop && !formMode`` logic
            // surface the Stop button uniformly across default-chat
            // and resume runs. Textarea remains draftable when Stop
            // is showing — matches existing default-chat UX where
            // the user can compose the next message while the
            // current run is still streaming.
            disabled={status === 'running' || episodes.resume.isPending || !ready}
            // R6b — in form-mode the composer is controlled, and the
            // send button submits the HITL form via ``submitHitl``.
            // Gated on ``activeFormSchema`` (not raw ``hitlSchema``)
            // so the composer drops out of form-mode the instant the
            // user submits — otherwise the textarea would render
            // controlled-with-stale-text + show the form submit
            // button during the resume window, which is wrong.
            value={activeFormSchema ? hitlComposerText : undefined}
            onValueChange={activeFormSchema ? setHitlComposerText : undefined}
            formMode={
              activeFormSchema
                ? {
                    onSubmit: (text) => {
                      setHitlComposerText(text);
                      submitHitl();
                    },
                    canSubmit: canSubmitHitl,
                    submitting: episodes.resume.isPending,
                  }
                : undefined
            }
            conversationId={conversationId}
            modelCapabilities={modelCapabilities}
            rightActions={
              ready && agentName === DEFAULT_AGENT_NAME && conversation && conversationId ? (
                <InlineModelPicker
                  conversationId={conversationId}
                  userModelId={conversation.userModelId}
                  thinkingEnabled={conversation.thinkingEnabled}
                />
              ) : null
            }
            placeholder={
              !hasProviders
                ? 'Connect a provider to continue this chat…'
                : !hasChatModel
                  ? 'Enable a chat-available model to continue…'
                  : status === 'running'
                    ? 'Waiting for response…'
                    : `Ask ${APP_NAME} anything…`
            }
          >
            {!hasProviders && (
              <SetupBanner>
                No LLM providers connected. Go to{' '}
                <Link
                  to={ROUTES.SETTINGS_PROVIDERS}
                  className="font-semibold underline underline-offset-2 hover:opacity-80"
                >
                  Settings → Providers
                </Link>{' '}
                to connect your API keys.
              </SetupBanner>
            )}
            {hasProviders && !hasChatModel && (
              <SetupBanner>
                No chat-available models enabled. Go to{' '}
                <Link
                  to={ROUTES.SETTINGS_PROVIDERS}
                  className="font-semibold underline underline-offset-2 hover:opacity-80"
                >
                  Settings → Providers
                </Link>{' '}
                and turn on at least one model for chat.
              </SetupBanner>
            )}
          </ChatInput>
          )}
        </div>
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-2 text-center">
      <p className="text-[15px] font-semibold text-foreground">{APP_NAME}</p>
      <p className="text-[13px] text-muted-foreground">Start a conversation below.</p>
    </div>
  );
}

interface InlineModelPickerProps {
  conversationId: string;
  userModelId: string | null;
  thinkingEnabled: boolean;
}

/**
 * Thin wrapper around :class:`ModelPicker` that PATCHes the conversation
 * row on selection. Kept local to this view so :class:`ModelPicker`
 * itself stays generic (re-usable in other contexts that don't yet
 * exist — e.g. a future landing-page picker once the pragna route
 * grows a ``thinking_enabled`` query param).
 */
function InlineModelPicker({
  conversationId,
  userModelId,
  thinkingEnabled,
}: InlineModelPickerProps) {
  const setModel = useSetConversationModel();
  const setThinking = useSetThinkingEnabled();
  return (
    <ModelPicker
      userModelId={userModelId}
      thinkingEnabled={thinkingEnabled}
      onModelChange={(id) =>
        setModel.mutate({ id: conversationId, userModelId: id })
      }
      onThinkingChange={(enabled) =>
        setThinking.mutate({ id: conversationId, thinkingEnabled: enabled })
      }
    />
  );
}

function LoadingState() {
  return (
    <div className="flex h-full items-center justify-center">
      <p className="text-[13px] text-muted-foreground">Loading…</p>
    </div>
  );
}

function ChatUnavailable() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 px-8 text-center">
      <p className="text-[15px] font-semibold text-foreground">Chat unavailable</p>
      <p className="text-[13px] text-muted-foreground max-w-xs">{ERRORS.CHT_003.message}</p>
    </div>
  );
}
