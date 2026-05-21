import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ServiceProvider } from '@/presentation/providers/ServiceProvider';
import { CopilotAuthProvider } from '@/presentation/providers/CopilotAuthProvider';
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
            {/* No global layout chrome — each route owns its layout
                (ChatView has its own ChatSidebar, SettingsLayout has
                its own SettingsSidebar, auth views render full-page).
                The <main> wrapper just guarantees a min viewport height
                so short pages don't collapse. */}
            <main className="min-h-screen">
              <AppRoutes />
            </main>
          </CopilotAuthProvider>
        </ServiceProvider>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
