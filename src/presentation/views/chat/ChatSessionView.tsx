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
  const { data: persistedMessages, isLoading: messagesLoading } =
    useConversationMessages(conversationId, { enabled: !isBrandNew });
  // Flows feed the resumed-conversation agent resolution: the persisted
  // ``conversation.flowId`` (a UUID) is mapped to the flow's name, and
  // the name is what ``useChatSession`` needs when constructing the
  // HttpAgent URL (``/pragna/agents/{name}``).
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

  const { messages, status, error, send, sendWithModel, sendWithOverrides, stop } = useChatSession(
    agentName,
    { threadId, initialMessages },
  );

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
                  userModelIdByMessage.get(m.id) ??
                  conversation?.userModelId ??
                  null
                }
                attachments={attachmentsByMessage.get(m.id) ?? []}
                handlers={handlers}
                availableModels={availableModels}
                branchEnabled={prefs.branchEnabled}
                conversationId={conversationId}
              />
            ))}
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
          {hitlSchema && (
            <HITLFormCard
              schema={hitlSchema}
              values={hitlValues}
              onValuesChange={setHitlValues}
              textValue={hitlComposerText}
              touched={hitlTouched}
              onTouchedChange={setHitlTouched}
              onSubmit={submitHitl}
              submitting={episodes.resume.isPending}
              errorMessage={resumeError}
            />
          )}
          {/* The composer hides only when an HITL pause is active AND
              the schema disallows free text. In every other case it
              stays visible — either as a normal chat composer or as
              the form's free-text field (form-mode). */}
          {(!hitlSchema || hitlSchema.allow_text_input) && (
          <ChatInput
            onSend={send}
            onStop={ready ? stop : undefined}
            // Disable when streaming a response OR when the user hasn't
            // finished setup. Keeps the composer visible (with the
            // gating banner inline) so prior history stays readable.
            disabled={status === 'running' || !ready}
            // R6b — in form-mode the composer is controlled, and the
            // send button submits the HITL form via ``submitHitl``.
            value={hitlSchema ? hitlComposerText : undefined}
            onValueChange={hitlSchema ? setHitlComposerText : undefined}
            formMode={
              hitlSchema
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
