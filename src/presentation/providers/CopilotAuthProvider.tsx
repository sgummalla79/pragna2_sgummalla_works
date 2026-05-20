import { type ReactNode } from 'react';
import { CopilotKit } from '@copilotkit/react-core';
import { COPILOTKIT_RUNTIME_URL } from '@/constants/api';
import { useAuthStore } from '@/presentation/store/authStore';
import { ErrorBoundary } from '@/presentation/components/ui/ErrorBoundary';

interface CopilotAuthProviderProps {
  children: ReactNode;
}

// Fallback renders children without CopilotKit context.
// ChatView's own ErrorBoundary then catches the CopilotChat failure
// and shows the CHT_003 unavailable screen instead of a white page.
function CopilotKitFallback({ children }: { children: ReactNode }) {
  return <>{children}</>;
}

export function CopilotAuthProvider({ children }: CopilotAuthProviderProps) {
  const accessToken = useAuthStore((s) => s.accessToken);
  const bootstrapped = useAuthStore((s) => s.bootstrapped);

  if (!bootstrapped || !accessToken) {
    return <>{children}</>;
  }

  return (
    <ErrorBoundary
      logTag="CHT_003"
      fallback={<CopilotKitFallback>{children}</CopilotKitFallback>}
    >
      <CopilotKit
        key={accessToken}
        runtimeUrl={COPILOTKIT_RUNTIME_URL}
        headers={{ Authorization: `Bearer ${accessToken}` }}
      >
        {children}
      </CopilotKit>
    </ErrorBoundary>
  );
}
