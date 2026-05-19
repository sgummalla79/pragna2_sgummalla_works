import { type ReactNode } from 'react';
import { NavBar } from '../NavBar/NavBar';
import { Sidebar } from '../Sidebar/Sidebar';
import { useUiStore } from '@/presentation/store/uiStore';
import { useAuthStore } from '@/presentation/store/authStore';
import { cn } from '@/lib/utils';

interface AppShellProps {
  children: ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const { sidebarCollapsed, setSidebarCollapsed } = useUiStore();

  if (!isAuthenticated) {
    return <main className="min-h-screen">{children}</main>;
  }

  return (
    <div className="flex min-h-screen">
      {/* Mobile nav bar */}
      <NavBar />

      {/* Mobile overlay */}
      {!sidebarCollapsed && (
        <div
          className="fixed inset-0 z-40 bg-black/40 md:hidden"
          onClick={() => setSidebarCollapsed(true)}
          aria-hidden="true"
        />
      )}

      {/* Mobile drawer */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 w-60 transition-transform duration-200 md:hidden',
          sidebarCollapsed ? '-translate-x-full' : 'translate-x-0'
        )}
        aria-label="Navigation drawer"
      >
        <Sidebar onClose={() => setSidebarCollapsed(true)} />
      </aside>

      {/* Desktop sidebar */}
      <aside className="hidden md:flex md:flex-col md:w-60 md:fixed md:inset-y-0 md:z-30">
        <Sidebar />
      </aside>

      {/* Main content */}
      <main className="flex-1 min-w-0 pt-14 md:pt-0 md:ml-60">
        <div className="h-full">{children}</div>
      </main>
    </div>
  );
}
