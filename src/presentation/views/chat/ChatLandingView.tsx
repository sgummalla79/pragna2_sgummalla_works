import { useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import PragnaLogo from '@/assets/logo.svg?react';
import { useLlmProvidersWithRegistrations } from '@/presentation/hooks/providers/useProviders';
import { APP_NAME } from '@/constants/api';
import { ROUTES } from '@/constants/routes';
import { ChatInput } from './components/ChatInput';
import { useGreeting } from './hooks/useGreeting';
import { INITIAL_MESSAGE_STORAGE_KEY } from './hooks/initialMessageHandoff';

/**
 * Landing surface for ``/chat``.
 *
 * Shown when the user has no active conversation open. Personalised
 * greeting (time-of-day + first name) on top, a centred composer below,
 * and inline banners explaining provider / model gaps.
 *
 * **Lifecycle of "send from landing":**
 *
 *   1. User types and hits send.
 *   2. A fresh UUID is generated client-side.
 *   3. The message text is stashed in ``sessionStorage`` under that UUID.
 *   4. We navigate to ``/chat/{uuid}``. :class:`ChatSessionView` mounts.
 *   5. The session view consumes the stashed message, calls
 *      ``useChatSession.send`` once, and removes the storage key so a
 *      browser refresh does NOT replay the message.
 *   6. The backend's persistence flow uses the UUID as both ``thread_id``
 *      and ``conversation.id``, so the URL the user is already on
 *      becomes the canonical resume URL with zero post-send round-trip.
 *
 * The landing renders inline gating instead of a full takeover. Matches
 * the "always show the composer, hint at what's missing" pattern from
 * ChatGPT and Claude.ai.
 */
export default function ChatLandingView() {
  const navigate = useNavigate();
  const greeting = useGreeting();
  const { data: providers = [], isLoading } = useLlmProvidersWithRegistrations();

  const connectedProviders = providers.filter((p) => p.userProviders.length > 0);
  const hasProviders = connectedProviders.length > 0;
  const hasChatModel = connectedProviders.some((p) =>
    p.userProviders.some((up) =>
      up.models.some((m) => m.enabled && m.availableForChat),
    ),
  );
  const ready = hasProviders && hasChatModel;

  const handleSend = useCallback(
    (text: string) => {
      const newId = crypto.randomUUID();
      try {
        sessionStorage.setItem(INITIAL_MESSAGE_STORAGE_KEY(newId), text);
      } catch {
        // sessionStorage can throw in privacy modes / SSR / out-of-quota;
        // we fall back to navigating anyway. The user will need to retype,
        // but the chat surface is reachable.
      }
      navigate(`${ROUTES.CHAT}/${newId}`);
    },
    [navigate],
  );

  return (
    <div className="flex h-full flex-col bg-background">
      <div className="flex-1 flex flex-col items-center justify-center px-4 py-12">
        {/* Greeting row — logo + time-of-day phrase + first name.
            Hidden while bootstrapping the provider list so we don't flash
            an incomplete greeting before the gating banners show up. */}
        {!isLoading && (
          <div className="flex items-center gap-4 mb-12 select-none">
            <PragnaLogo className="h-10 w-10 flex-shrink-0" aria-hidden="true" />
            <h1 className="text-[32px] sm:text-[40px] font-serif font-semibold text-foreground m-0 leading-none">
              {greeting.text}
            </h1>
          </div>
        )}

        {/* Composer block — when a setup step is missing, the banner
            sits INSIDE the composer (passed as ``children``) so it
            visually attaches to the input the user is being told to
            unblock. Matches the ChatGPT pattern of "in-composer
            advisory" rather than a separate floating element. */}
        <div className="w-full max-w-2xl">
          <ChatInput
            onSend={handleSend}
            disabled={!ready}
            placeholder={
              ready
                ? `Ask ${APP_NAME} anything…`
                : 'Connect a model to start chatting…'
            }
          >
            {!isLoading && !hasProviders && (
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
            {!isLoading && hasProviders && !hasChatModel && (
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
        </div>
      </div>
    </div>
  );
}

/**
 * Inline error-tinted banner used above the composer when a setup
 * step is missing. Visual matches the "Chat unavailable" surface so
 * the user reads it as "blocking but recoverable."
 */
function SetupBanner({ children }: { children: React.ReactNode }) {
  return (
    <div
      role="alert"
      className="rounded-lg border border-[var(--color-error-border)] bg-[var(--color-error-bg)] px-4 py-2.5 text-[13px] text-[var(--color-error-text)]"
    >
      {children}
    </div>
  );
}
