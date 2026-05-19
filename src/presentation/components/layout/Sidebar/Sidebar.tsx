import { NavLink } from 'react-router-dom';
import {
  MessageSquare,
  Zap,
  GitBranch,
  Settings,
  History,
  Cpu,
  LogOut,
} from 'lucide-react';
import PragnaLogo from '@/assets/logo.svg?react';
import { APP_NAME } from '@/constants/api';
import { ROUTES } from '@/constants/routes';
import { FEATURE_FLOW_BUILDER } from '@/constants/api';
import { useAuth } from '@/presentation/hooks/auth/useAuth';
import { cn } from '@/lib/utils';

interface NavItem {
  to: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  label: string;
}

const navItems: NavItem[] = [
  { to: ROUTES.CHAT, icon: MessageSquare, label: 'Chat' },
  { to: ROUTES.PROVIDERS, icon: Cpu, label: 'Providers' },
  { to: ROUTES.MODELS, icon: Settings, label: 'Models' },
  ...(FEATURE_FLOW_BUILDER ? [{ to: ROUTES.FLOWS, icon: GitBranch, label: 'Flows' }] : []),
  { to: ROUTES.SKILLS, icon: Zap, label: 'Skills' },
  { to: ROUTES.CONVERSATIONS, icon: History, label: 'History' },
];

interface SidebarProps {
  onClose?: () => void;
}

export function Sidebar({ onClose }: SidebarProps) {
  const { logout } = useAuth();

  return (
    <nav className="flex flex-col h-full bg-background border-r" aria-label="Main navigation">
      <div className="flex items-center gap-2.5 px-4 py-4 border-b">
        <PragnaLogo className="h-7 w-7 flex-shrink-0" aria-hidden="true" />
        <span className="font-bold text-base text-[var(--color-brand)]">{APP_NAME}</span>
      </div>

      <ul className="flex-1 py-2 overflow-y-auto list-none" role="list">
        {navItems.map(({ to, icon: Icon, label }) => (
          <li key={to}>
            <NavLink
              to={to}
              onClick={onClose}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 px-4 py-3 text-sm font-medium transition-colors rounded-none hover:bg-accent',
                  isActive
                    ? 'text-[var(--color-brand)] border-l-2 border-[var(--color-brand)] bg-[var(--color-brand-light)]'
                    : 'text-muted-foreground border-l-2 border-transparent'
                )
              }
              aria-label={label}
            >
              <Icon size={18} aria-hidden="true" />
              <span>{label}</span>
            </NavLink>
          </li>
        ))}
      </ul>

      <div className="border-t p-2">
        <button
          onClick={logout}
          className="flex w-full items-center gap-3 px-4 py-3 text-sm text-muted-foreground hover:text-destructive hover:bg-accent rounded-md transition-colors min-h-[44px]"
        >
          <LogOut size={18} aria-hidden="true" />
          <span>Sign out</span>
        </button>
      </div>
    </nav>
  );
}
