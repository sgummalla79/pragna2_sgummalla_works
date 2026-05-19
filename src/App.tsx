import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ServiceProvider } from '@/presentation/providers/ServiceProvider';
import { CopilotAuthProvider } from '@/presentation/providers/CopilotAuthProvider';
import { AppShell } from '@/presentation/components/layout/AppShell/AppShell';
import { AppRoutes } from '@/presentation/router';
import { useBootstrap } from '@/presentation/hooks/auth/useBootstrap';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30_000,
    },
  },
});

function BootstrapGate() {
  useBootstrap();
  return null;
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <ServiceProvider>
          <CopilotAuthProvider>
            <BootstrapGate />
            <AppShell>
              <AppRoutes />
            </AppShell>
          </CopilotAuthProvider>
        </ServiceProvider>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
