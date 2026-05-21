import { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { ErrorBoundary } from '@/presentation/components/ui/ErrorBoundary';
import { useLlmProvidersWithRegistrations } from '@/presentation/hooks/providers/useProviders';
import { APP_NAME } from '@/constants/api';
import { ERRORS } from '@/constants/errors';
import { ROUTES } from '@/constants/routes';
import { useChatSession } from './hooks/useChatSession';
import { ChatMessage } from './components/ChatMessage';
import { ChatInput } from './components/ChatInput';

const DEFAULT_AGENT_NAME = 'default';

/**
 * The active chat surface.
 *
 * Renders the hand-rolled AG-UI native chat UI when the user has at least
 * one provider and one chat-available model; otherwise shows a contextual
 * setup prompt. Wraps the live chat in :class:`ErrorBoundary` so a runtime
 * failure (network drop, malformed event stream, agent crash) surfaces as
 * the ``CHT_003`` "Chat unavailable" empty state rather than a white page.
 *
 * Mounted at ``/chat/new``. The layout shell (:class:`ChatView`) owns the
 * sidebar; this view owns the right panel only.
 */
export default function ChatSessionView() {
  const { data: providers = [], isLoading } = useLlmProvidersWithRegistrations();

  if (isLoading) return <LoadingState />;

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

  return (
    <ErrorBoundary logTag="CHT_003" fallback={<ChatUnavailable />}>
      <ChatSurface />
    </ErrorBoundary>
  );
}

/**
 * Live chat surface — message list + composer + status footer.
 *
 * Split out from the parent so it only mounts (and instantiates the
 * underlying :class:`HttpAgent`) once the provider/model gating has
 * passed. Aborts any in-flight run on unmount via the hook's cleanup.
 */
function ChatSurface() {
  const { messages, status, error, send } = useChatSession(DEFAULT_AGENT_NAME);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Keep the latest message in view as it streams in. ``scrollHeight`` is
  // recomputed every render, so referencing it in the effect's body
  // catches incremental content updates as well as new turns.
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, status]);

  return (
    <div className="flex h-full flex-col bg-[#0a0a0a]">
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto px-4 py-6"
        aria-live="polite"
        aria-busy={status === 'running'}
      >
        {messages.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="mx-auto flex max-w-3xl flex-col gap-4">
            {messages.map((m) => (
              <ChatMessage key={m.id} message={m} />
            ))}
          </div>
        )}
      </div>

      {error && (
        <div className="border-t border-[#3a1818] bg-[#1d0a0a] px-4 py-2 text-[12px] text-[#fca5a5]">
          {error}
        </div>
      )}

      <ChatInput
        onSend={send}
        disabled={status === 'running'}
        placeholder={
          status === 'running'
            ? 'Waiting for response…'
            : `Ask ${APP_NAME} anything…`
        }
      />
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-2 text-center">
      <p className="text-[15px] font-semibold text-[#ececea]">{APP_NAME}</p>
      <p className="text-[13px] text-[#737373]">Start a conversation below.</p>
    </div>
  );
}

function LoadingState() {
  return (
    <div className="flex h-full items-center justify-center">
      <p className="text-[13px] text-[#737373]">Loading…</p>
    </div>
  );
}

function SetupPrompt({ message }: { message: string }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 px-8 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[rgba(201,112,64,0.12)]">
        <svg
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="var(--color-brand)"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
        </svg>
      </div>
      <p className="text-[15px] font-semibold text-[#ececea]">Almost ready</p>
      <p className="text-[13px] text-[#737373] max-w-xs">{message}</p>
      <Link
        to={ROUTES.SETTINGS_PROVIDERS}
        className="rounded-lg bg-[var(--color-brand)] px-4 py-2 text-[13px] font-semibold text-white no-underline hover:bg-[var(--color-brand-hover)] transition-colors"
      >
        Go to Providers →
      </Link>
    </div>
  );
}

function ChatUnavailable() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 px-8 text-center">
      <p className="text-[15px] font-semibold text-[#ececea]">Chat unavailable</p>
      <p className="text-[13px] text-[#737373] max-w-xs">{ERRORS.CHT_003.message}</p>
    </div>
  );
}
