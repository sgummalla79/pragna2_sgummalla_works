import { useEffect, useMemo, useRef } from 'react';
import { Link, useParams } from 'react-router-dom';
import type { Message } from '@ag-ui/client';
import { ErrorBoundary } from '@/presentation/components/ui/ErrorBoundary';
import { useLlmProvidersWithRegistrations } from '@/presentation/hooks/providers/useProviders';
import { useConversation } from '@/presentation/hooks/conversations/useConversation';
import { useConversationMessages } from '@/presentation/hooks/conversations/useConversationMessages';
import { useFlows } from '@/presentation/hooks/flows/useFlows';
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
} from './hooks/initialMessageHandoff';
import { ChatMessage } from './components/ChatMessage';
import { ChatInput } from './components/ChatInput';
import { ChatHeader } from './components/ChatHeader';

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

  if (!hasProviders) {
    return <SetupPrompt message={ERRORS.CHT_001.message} />;
  }
  if (!hasChatModel) {
    return <SetupPrompt message={ERRORS.CHT_002.message} />;
  }

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
}: ChatSurfaceProps) {
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

  const { messages, status, error, send, stop } = useChatSession(
    agentName,
    { threadId, initialMessages },
  );

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
      if (pending) send(pending.text);
    }, 0);

    return () => window.clearTimeout(timer);
  }, [conversationId, send, status]);

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
      <ChatHeader conversation={conversation} agentName={agentName} />

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
        <div className="mx-auto max-w-[820px]">
          <ChatInput
            onSend={send}
            onStop={stop}
            disabled={status === 'running'}
            placeholder={
              status === 'running'
                ? 'Waiting for response…'
                : `Ask ${APP_NAME} anything…`
            }
          />
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

function LoadingState() {
  return (
    <div className="flex h-full items-center justify-center">
      <p className="text-[13px] text-muted-foreground">Loading…</p>
    </div>
  );
}

function SetupPrompt({ message }: { message: string }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 px-8 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10">
        <svg
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="var(--color-primary)"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
        </svg>
      </div>
      <p className="text-[15px] font-semibold text-foreground">Almost ready</p>
      <p className="text-[13px] text-muted-foreground max-w-xs">{message}</p>
      <Link
        to={ROUTES.SETTINGS_PROVIDERS}
        className="rounded-lg bg-primary px-4 py-2 text-[13px] font-semibold text-primary-foreground no-underline hover:bg-primary/90 transition-colors"
      >
        Go to Providers →
      </Link>
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
