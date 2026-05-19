import { Menu, X } from 'lucide-react';
import PragnaLogo from '@/assets/logo.svg?react';
import { APP_NAME } from '@/constants/api';
import { useUiStore } from '@/presentation/store/uiStore';
import { Button } from '@/presentation/components/ui/Button';

export function NavBar() {
  const { sidebarCollapsed, toggleSidebar } = useUiStore();

  return (
    <header className="fixed top-0 left-0 right-0 z-50 h-14 border-b bg-background flex items-center px-4 gap-3 md:hidden">
      <Button
        variant="ghost"
        size="icon"
        onClick={toggleSidebar}
        aria-label={sidebarCollapsed ? 'Open navigation' : 'Close navigation'}
      >
        {sidebarCollapsed ? <Menu size={20} /> : <X size={20} />}
      </Button>
      <PragnaLogo className="h-6 w-6" aria-hidden="true" />
      <span className="font-bold text-[var(--color-brand)]">{APP_NAME}</span>
    </header>
  );
}
