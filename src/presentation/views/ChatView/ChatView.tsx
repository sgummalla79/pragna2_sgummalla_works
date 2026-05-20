import { Link } from 'react-router-dom';
import { CopilotChat } from '@copilotkit/react-ui';
import '@copilotkit/react-ui/styles.css';
import { APP_NAME } from '@/constants/api';
import { ROUTES } from '@/constants/routes';
import { ERRORS } from '@/constants/errors';
import { useProviders } from '@/presentation/hooks/providers/useProviders';
import { useModels } from '@/presentation/hooks/models/useModels';
import { ErrorBoundary } from '@/presentation/components/ui/ErrorBoundary';

const CHAT_INSTRUCTIONS = `You are ${APP_NAME}, an intelligent AI assistant that helps users accomplish tasks using configurable multi-agent workflows. You have access to skills the user has configured. When users type /skill-name, invoke the appropriate skill. Be helpful, concise, and clear.`;

export default function ChatView() {
  const { data: providers, isLoading: providersLoading } = useProviders();
  const { data: models, isLoading: modelsLoading } = useModels();

  const isLoading = providersLoading || modelsLoading;
  const hasProviders = (providers?.length ?? 0) > 0;
  const hasModels = (models?.length ?? 0) > 0;
  const isReady = hasProviders && hasModels;

  if (isLoading) {
    return <ChatShell input={<DisabledInput placeholder="Loading…" />} />;
  }

  if (!isReady) {
    return (
      <ChatShell
        notice={<SetupNotice hasProviders={hasProviders} />}
        input={
          <DisabledInput
            placeholder={
              !hasProviders
                ? ERRORS.CHT_001.message
                : ERRORS.CHT_002.message
            }
          />
        }
      />
    );
  }

  return (
    <ErrorBoundary logTag="CHT_003" fallback={<ChatUnavailable />}>
      <div className="h-screen flex flex-col">
        <CopilotChat
          className="flex-1"
          instructions={CHAT_INSTRUCTIONS}
          labels={{
            title: APP_NAME,
            placeholder: `Ask ${APP_NAME} anything, or type /skill-name…`,
            stopGenerating: 'Stop',
            regenerateResponse: 'Regenerate',
          }}
        />
      </div>
    </ErrorBoundary>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function ChatShell({
  notice,
  input,
}: {
  notice?: React.ReactNode;
  input: React.ReactNode;
}) {
  return (
    <div className="h-screen flex flex-col bg-background">
      <div className="flex-1 flex items-center justify-center p-6">
        {notice ?? null}
      </div>
      <div className="border-t border-border p-4">{input}</div>
    </div>
  );
}

function DisabledInput({ placeholder }: { placeholder: string }) {
  return (
    <div className="max-w-3xl mx-auto w-full">
      <input
        type="text"
        disabled
        placeholder={placeholder}
        className="w-full rounded-lg border border-border bg-muted px-4 py-3 text-sm text-muted-foreground placeholder:text-muted-foreground cursor-not-allowed"
        aria-disabled="true"
      />
    </div>
  );
}

function ChatUnavailable() {
  return (
    <ChatShell
      notice={
        <div className="max-w-sm text-center space-y-3">
          <div className="text-4xl" aria-hidden="true">⚠️</div>
          <p className="font-semibold text-foreground">Chat unavailable</p>
          <p className="text-sm text-muted-foreground">
            {ERRORS.CHT_003.message}
          </p>
          <p className="text-xs text-muted-foreground/60">
            {ERRORS.CHT_003.code}
          </p>
        </div>
      }
      input={<DisabledInput placeholder={ERRORS.CHT_003.message} />}
    />
  );
}

function SetupNotice({ hasProviders }: { hasProviders: boolean }) {
  return (
    <div className="max-w-sm text-center space-y-4">
      <div className="text-4xl" aria-hidden="true">🔌</div>
      <div>
        <p className="font-semibold text-foreground">
          {!hasProviders ? 'No LLM provider connected' : 'No model configured'}
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          {!hasProviders ? ERRORS.CHT_001.message : ERRORS.CHT_002.message}
        </p>
      </div>
      <Link
        to={!hasProviders ? ROUTES.PROVIDERS : ROUTES.MODELS}
        className="inline-block rounded-md bg-[var(--color-brand)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--color-brand-hover)] transition-colors"
      >
        {!hasProviders ? 'Go to Providers →' : 'Go to Models →'}
      </Link>
    </div>
  );
}
