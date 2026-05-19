import { type ReactNode } from 'react';
import { CopilotKit } from '@copilotkit/react-core';
import { COPILOTKIT_RUNTIME_URL } from '@/constants/api';
import { useAuthStore } from '@/presentation/store/authStore';

interface CopilotAuthProviderProps {
  children: ReactNode;
}

export function CopilotAuthProvider({ children }: CopilotAuthProviderProps) {
  const accessToken = useAuthStore((s) => s.accessToken);

  return (
    <CopilotKit
      runtimeUrl={COPILOTKIT_RUNTIME_URL}
      headers={accessToken ? { Authorization: `Bearer ${accessToken}` } : {}}
    >
      {children}
    </CopilotKit>
  );
}
