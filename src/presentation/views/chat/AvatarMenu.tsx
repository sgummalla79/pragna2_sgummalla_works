import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { useNavigate } from 'react-router-dom';
import { History as HistoryIcon, Moon, Settings as SettingsIcon, Sun, LogOut } from 'lucide-react';
import { ROUTES } from '@/constants/routes';
import { useAuth } from '@/presentation/hooks/auth/useAuth';
import { useUiStore } from '@/presentation/store/uiStore';
import { cn } from '@/lib/utils';

/**
 * Shared className for every interactive menu item so they highlight
 * uniformly on hover / keyboard focus. Sign out used to override this
 * with destructive-red styling; that was inconsistent — kept all three
 * (Settings, theme toggle, Sign out) on the same neutral hover so the
 * menu reads as one coherent action list.
 */
const MENU_ITEM_CLASS = cn(
  'flex cursor-pointer items-center gap-2 rounded-md px-3 py-2 text-sm',
  'text-foreground outline-none',
  'data-[highlighted]:bg-accent',
);

/**
 * Returns the single-character avatar glyph for a user, prioritising
 * ``name`` over ``email``. Defensive fallback for the unauthenticated
 * case that shouldn't happen on /chat but keeps the component renderable
 * in isolation.
 */
function avatarInitial(name: string | null | undefined, email: string | undefined): string {
  const source = (name && name.trim()) || email || '?';
  return source.trim()[0]?.toUpperCase() ?? '?';
}

interface AvatarMenuProps {
  /**
   * When true the trigger renders as just the avatar circle (icon-only
   * mode for the collapsed ChatSidebar). When false the trigger is the
   * avatar plus the user's display name on a single row.
   */
  collapsed: boolean;
}

/**
 * Account / settings dropdown anchored to the ChatSidebar footer.
 *
 * Layout matches claude.ai's chat: an avatar pill at the bottom-left
 * of the rail opens a menu containing user identity, navigation to
 * settings, a theme toggle, and sign-out. Built on Radix DropdownMenu
 * so keyboard nav / focus-trap / escape-to-dismiss come for free.
 */
export function AvatarMenu({ collapsed }: AvatarMenuProps) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const theme = useUiStore((s) => s.theme);
  const toggleTheme = useUiStore((s) => s.toggleTheme);

  const displayName = user?.name || user?.email || 'Account';
  const initial = avatarInitial(user?.name, user?.email);
  // Show the destination state on the toggle (i.e. clicking "Light mode"
  // switches to light) — same convention claude.ai / Linear / Notion use.
  const switchToLight = theme === 'dark';

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button
          type="button"
          aria-label="Account menu"
          title={collapsed ? displayName : undefined}
          className={cn(
            'flex w-full items-center gap-4 rounded-md px-2 py-2 font-medium',
            'text-foreground transition-colors',
            'hover:bg-accent',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-brand-ring)]',
            collapsed && 'justify-center px-0 gap-0',
          )}
        >
          <span
            aria-hidden="true"
            className={cn(
              'flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full',
              'bg-brand-light text-brand font-semibold',
            )}
          >
            {initial}
          </span>
          {!collapsed && (
            <span className="truncate text-left text-base flex-1 min-w-0">
              {displayName}
            </span>
          )}
        </button>
      </DropdownMenu.Trigger>

      <DropdownMenu.Portal>
        <DropdownMenu.Content
          // Open above the trigger (footer sits at the bottom of the rail)
          // and slightly inset from the rail's right edge.
          side="top"
          align="start"
          sideOffset={8}
          className={cn(
            'z-[700] min-w-[240px] rounded-lg border border-border',
            'bg-popover p-1 shadow-[0_20px_60px_rgba(0,0,0,0.45)]',
            'focus:outline-none',
          )}
        >
          {/* User identity (non-interactive) */}
          <DropdownMenu.Label
            className="select-text truncate px-3 py-2 text-sm text-foreground"
            title={user?.email}
          >
            {user?.email ?? 'Signed in'}
          </DropdownMenu.Label>

          <DropdownMenu.Separator className="my-1 h-px bg-accent" />

          <DropdownMenu.Item
            onSelect={() => navigate(ROUTES.CHAT_HISTORY)}
            className={MENU_ITEM_CLASS}
          >
            <HistoryIcon size={16} aria-hidden="true" />
            History
          </DropdownMenu.Item>

          <DropdownMenu.Item
            onSelect={() => navigate(ROUTES.SETTINGS)}
            className={MENU_ITEM_CLASS}
          >
            <SettingsIcon size={16} aria-hidden="true" />
            Settings
          </DropdownMenu.Item>

          <DropdownMenu.Item
            onSelect={(e) => {
              // Keep the menu open while the user appreciates the theme flip —
              // matches how most apps treat in-menu toggles.
              e.preventDefault();
              toggleTheme();
            }}
            className={MENU_ITEM_CLASS}
          >
            {switchToLight ? (
              <Sun size={16} aria-hidden="true" />
            ) : (
              <Moon size={16} aria-hidden="true" />
            )}
            {switchToLight ? 'Light mode' : 'Dark mode'}
          </DropdownMenu.Item>

          <DropdownMenu.Separator className="my-1 h-px bg-accent" />

          <DropdownMenu.Item
            onSelect={() => logout()}
            className={MENU_ITEM_CLASS}
          >
            <LogOut size={16} aria-hidden="true" />
            Sign out
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
