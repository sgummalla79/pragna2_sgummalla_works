import {
  MessageSquarePlus,
  PanelLeftClose,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import PragnaLogo from '@/assets/logo.svg?react';
import { APP_NAME } from '@/constants/api';
import { ROUTES } from '@/constants/routes';
import { useUiStore } from '@/presentation/store/uiStore';
import { cn } from '@/lib/utils';
import { AvatarMenu } from './AvatarMenu';
import { ConversationList } from './components/ConversationList';

interface NavItem {
  icon: React.ComponentType<{ size?: number; className?: string }>;
  label: string;
  onClick: () => void;
}

/**
 * Chat-page secondary pane.
 *
 * Renders a collapsible left rail next to the chat surface with brand
 * + "New Chat" + "Chats" at the top, and "Sign out" pinned to the
 * footer (carried over from the deleted global Sidebar). Toggle state
 * lives in `useUiStore.chatPaneCollapsed` so the user's preference
 * survives navigation.
 *
 * Layout when expanded:
 *   - Brand row at top
 *   - "New Chat" action button (always visible)
 *   - :class:`ConversationList` (real persisted conversations from the
 *     backend, with rename + delete affordances)
 *   - :class:`AvatarMenu` pinned at the bottom
 *
 * Layout when collapsed:
 *   - Logo (click to expand)
 *   - "New Chat" as icon-only button
 *   - Conversation list is hidden (labels would be unreadable at this
 *     width); user can expand to see it
 *   - AvatarMenu at the bottom
 *
 * Parents can override the "New Chat" handler via :prop:`onNewChat`
 * (default behaviour: navigate to ``/chat``, the landing surface where
 * a fresh thread starts).
 */
interface ChatSidebarProps {
  onNewChat?: () => void;
}

export function Sidebar({ onNewChat }: ChatSidebarProps) {
  const collapsed = useUiStore((s) => s.chatPaneCollapsed);
  const toggle = useUiStore((s) => s.toggleChatPane);
  const navigate = useNavigate();

  const items: NavItem[] = [
    {
      icon: MessageSquarePlus,
      label: 'New Chat',
      onClick: onNewChat ?? (() => navigate(ROUTES.CHAT)),
    },
  ];

  return (
    <aside
      aria-label="Chat navigation"
      className={cn(
        // Sidebar surface uses sidebar-* tokens. Border deliberately
        // stays on `border-border` — see docs/THEME_OVERRIDES.md (#1).
        'flex flex-col flex-shrink-0 border-r border-border',
        'bg-sidebar text-sidebar-foreground transition-[width] duration-150 ease-out',
        collapsed ? 'w-14' : 'w-60'
      )}
    >
      {/* Brand + collapse control.
          - Expanded: [Logo] App name on the left, dedicated collapse
            button on the right.
          - Collapsed: a single button containing just the logo — clicking
            it expands the pane. Keeping the logo visible at all times
            preserves brand presence even in icon-only mode, and saves a
            row of vertical space versus a separate toggle.
          The whole header has a hover affordance in collapsed mode so
          the click target is obvious. */}
      <div className="flex h-12 items-center border-b border-border px-2 gap-2">
        {collapsed ? (
          <button
            type="button"
            onClick={toggle}
            aria-label="Expand chat pane"
            aria-expanded={false}
            title={APP_NAME}
            className={cn(
              'mx-auto flex h-8 w-8 items-center justify-center rounded-md',
              'text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-sidebar-ring)]'
            )}
          >
            <PragnaLogo className="h-6 w-6" aria-hidden="true" />
          </button>
        ) : (
          <>
            <div className="flex flex-1 min-w-0 items-center gap-3 px-2">
              <PragnaLogo className="h-6 w-6 flex-shrink-0" aria-hidden="true" />
              <span className="truncate font-bold text-xl text-card-foreground">
                {APP_NAME}
              </span>
            </div>
            <button
              type="button"
              onClick={toggle}
              aria-label="Collapse chat pane"
              aria-expanded
              className={cn(
                'flex h-8 w-8 items-center justify-center rounded-md',
                'text-sidebar-foreground/70 hover:text-sidebar-accent-foreground hover:bg-sidebar-accent',
                'transition-colors focus-visible:outline-none focus-visible:ring-2',
                'focus-visible:ring-[var(--color-sidebar-ring)]'
              )}
            >
              <PanelLeftClose size={18} />
            </button>
          </>
        )}
      </div>

      <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
        <ul className="flex flex-col list-none m-0 p-0" role="list">
          {items.map(({ icon: Icon, label, onClick }) => (
            <li key={label}>
              <button
                type="button"
                onClick={onClick}
                // When collapsed, the label is hidden visually but a native
                // tooltip surfaces it on hover so the icon-only mode stays
                // discoverable.
                title={collapsed ? label : undefined}
                aria-label={label}
                className={cn(
                  'group flex w-full items-center gap-3 px-4 py-3 text-sm font-medium',
                  'text-sidebar-foreground/75 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
                  'focus-visible:outline-none focus-visible:bg-sidebar-accent',
                  collapsed && 'justify-center px-0',
                )}
              >
                <Icon size={18} aria-hidden="true" className="flex-shrink-0" />
                {/* Hide the label completely when collapsed — using `hidden`
                    rather than width-zero keeps the focus ring sized to the
                    icon, not a phantom 200px text box. */}
                {!collapsed && <span>{label}</span>}
              </button>
            </li>
          ))}
        </ul>

        {/* Recent conversations — only shown when expanded. Scrolls
            independently of the rest of the sidebar if it grows beyond
            the viewport. */}
        {!collapsed && (
          <nav
            aria-label="Recent conversations"
            className="flex-1 min-h-0 overflow-y-auto px-2 py-1"
          >
            <ConversationList />
          </nav>
        )}
      </div>

      {/* Account / settings pinned at the bottom. The avatar trigger
          opens a Radix dropdown containing user identity, settings
          navigation, theme toggle, and sign-out — modelled after
          claude.ai's chat. See [AvatarMenu.tsx](./AvatarMenu.tsx). */}
      <div className="border-t border-border p-2">
        <AvatarMenu collapsed={collapsed} />
      </div>
    </aside>
  );
}
