import { useCallback, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import PragnaLogo from '@/assets/logo.svg?react';
import { useLlmProvidersWithRegistrations } from '@/presentation/hooks/providers/useProviders';
import { APP_NAME } from '@/constants/api';
import { ROUTES } from '@/constants/routes';
import { ChatInput } from './components/ChatInput';
import { ModelPicker } from './components/ModelPicker';
import { SetupBanner } from './components/SetupBanner';
import { useGreeting } from './hooks/useGreeting';
import { writePendingInitialMessage } from './hooks/initialMessageHandoff';

// R6a: every new conversation starts on the default chat agent. Flows
// are no longer picked upfront — the default agent proposes them
// mid-conversation when intent matches and the user confirms via an
// inline FlowProposalCard.
const DEFAULT_AGENT_NAME = 'default';

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

  // R6a: every new conversation lands on the default agent — there is
  // no `?agent=` parameter to honour any more. The constant is still
  // threaded through the handoff so the backend's persistence path
  // (which expects an agent name on first turn) stays unchanged.
  const requestedAgent = DEFAULT_AGENT_NAME;

  const connectedProviders = providers.filter((p) => p.userProviders.length > 0);
  const hasProviders = connectedProviders.length > 0;
  const hasChatModel = connectedProviders.some((p) =>
    p.userProviders.some((up) =>
      up.models.some((m) => m.enabled && m.availableForChat),
    ),
  );
  const ready = hasProviders && hasChatModel;

  // The conversation id used for any uploads happening BEFORE first
  // send. Generated synchronously so the paperclip + drop target work
  // straight away — the backend allows uploads against not-yet-existing
  // conversation rows and links them on the first send-time persist.
  const pendingConvId = useMemo(() => crypto.randomUUID(), []);

  // Landing-time model + Extended Thinking selections. Local state
  // only; carried to the session view via ``writePendingInitialMessage``
  // and applied by the backend on auto-create through the pragna
  // route's ``?user_model_id=`` + ``?thinking_enabled=`` query params.
  // ``null`` userModelId means "let the picker pick the default" — the
  // picker itself defaults to the first chat-eligible model when
  // unset, so this stays valid through the handoff.
  const [landingUserModelId, setLandingUserModelId] = useState<string | null>(null);
  const [landingThinkingEnabled, setLandingThinkingEnabled] = useState(false);

  const handleSend = useCallback(
    (text: string, attachmentIds: string[]) => {
      // Reuse the upload-target convo id as the URL slug so the
      // attachments already point at the right conversation.
      writePendingInitialMessage(pendingConvId, {
        text,
        agent: requestedAgent,
        attachmentIds,
        userModelId: landingUserModelId ?? undefined,
        thinkingEnabled: landingThinkingEnabled,
      });
      navigate(`${ROUTES.CHAT}/${pendingConvId}`);
    },
    [
      navigate,
      pendingConvId,
      requestedAgent,
      landingUserModelId,
      landingThinkingEnabled,
    ],
  );

  return (
    <div className="flex h-full flex-col bg-background">
      <div className="flex-1 flex flex-col items-center justify-center px-4 py-12">
        {/* Greeting — logo + time-of-day phrase on one row, centered as
            a unit on the same axis as the composer below. The wrapping
            column's `items-center` keeps the block's X-centre aligned
            with the composer's X-centre. Hidden while bootstrapping the
            provider list so we don't flash an incomplete greeting before
            the gating banners show up. */}
        {!isLoading && (
          <div className="flex items-center gap-4 mb-6 select-none">
            <PragnaLogo className="h-10 w-10 flex-shrink-0" aria-hidden="true" />
            <h1 className="text-[32px] sm:text-[40px] font-serif font-semibold text-card-foreground m-0 leading-none">
              {greeting.text}
            </h1>
          </div>
        )}

        {/* Composer block — when a setup step is missing, the banner
            sits INSIDE the composer (passed as ``children``) so it
            visually attaches to the input the user is being told to
            unblock. Matches the ChatGPT pattern of "in-composer
            advisory" rather than a separate floating element. */}
        <div className="w-full max-w-2xl mx-auto">
          <ChatInput
            onSend={handleSend}
            disabled={!ready}
            conversationId={pendingConvId}
            rightActions={
              ready && requestedAgent === DEFAULT_AGENT_NAME ? (
                <ModelPicker
                  userModelId={landingUserModelId}
                  thinkingEnabled={landingThinkingEnabled}
                  onModelChange={setLandingUserModelId}
                  onThinkingChange={setLandingThinkingEnabled}
                />
              ) : null
            }
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
            {/* R6a removed the agent picker; the stale-agent banner that
                lived here is no longer reachable because every new chat
                lands on the default agent. */}
          </ChatInput>
        </div>
      </div>
    </div>
  );
}

