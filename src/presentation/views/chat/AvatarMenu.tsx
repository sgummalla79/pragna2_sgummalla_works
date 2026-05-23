import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { useNavigate } from 'react-router-dom';
import { Settings as SettingsIcon, LogOut } from 'lucide-react';
import { ROUTES } from '@/constants/routes';
import { useAuth } from '@/presentation/hooks/auth/useAuth';
import { cn } from '@/lib/utils';

/**
 * Shared className for every interactive menu item so they highlight
 * uniformly on hover / keyboard focus.
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
 * settings, and sign-out. Built on Radix DropdownMenu so keyboard nav
 * / focus-trap / escape-to-dismiss come for free.
 */
export function AvatarMenu({ collapsed }: AvatarMenuProps) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const displayName = user?.name || user?.email || 'Account';
  const initial = avatarInitial(user?.name, user?.email);

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
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)]',
            collapsed && 'justify-center px-0 gap-0',
          )}
        >
          <span
            aria-hidden="true"
            className={cn(
              'flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full',
              'bg-primary/10 text-primary font-semibold',
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
            'bg-popover p-1 shadow-2xl',
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
            onSelect={() => navigate(ROUTES.SETTINGS)}
            className={MENU_ITEM_CLASS}
          >
            <SettingsIcon size={16} aria-hidden="true" />
            Settings
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
