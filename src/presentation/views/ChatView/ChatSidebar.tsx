import {
  MessageSquarePlus,
  MessagesSquare,
  PanelLeftClose,
} from 'lucide-react';
import PragnaLogo from '@/assets/logo.svg?react';
import { APP_NAME } from '@/constants/api';
import { useUiStore } from '@/presentation/store/uiStore';
import { cn } from '@/lib/utils';
import { AvatarMenu } from './AvatarMenu';

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
 * Click handlers for the top items are intentionally stubs — the
 * calling site decides what each action does (start a fresh chat
 * session, open a conversations drawer, etc.). Pass `onNewChat` /
 * `onChats` from ChatView when the behaviour is wired. Sign out wires
 * straight to `useAuth().logout` since it has no per-page variation.
 */
interface ChatSidebarProps {
  onNewChat?: () => void;
  onChats?: () => void;
}

export function ChatSidebar({ onNewChat, onChats }: ChatSidebarProps) {
  const collapsed = useUiStore((s) => s.chatPaneCollapsed);
  const toggle = useUiStore((s) => s.toggleChatPane);

  const items: NavItem[] = [
    {
      icon: MessageSquarePlus,
      label: 'New Chat',
      // TODO: wire to "start a fresh CopilotChat session" once the
      //       runtime exposes a reset hook. For now: parent-supplied
      //       handler or no-op.
      onClick: onNewChat ?? (() => {}),
    },
    {
      icon: MessagesSquare,
      label: 'Chats',
      // TODO: wire to a conversations list — could open an inline
      //       drawer inside this pane, or navigate to ROUTES.CONVERSATIONS.
      onClick: onChats ?? (() => {}),
    },
  ];

  return (
    <aside
      aria-label="Chat navigation"
      className={cn(
        'flex flex-col flex-shrink-0 border-r border-[rgba(255,255,255,0.06)]',
        'bg-background transition-[width] duration-150 ease-out',
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
      <div className="flex h-12 items-center border-b border-[rgba(255,255,255,0.06)] px-2 gap-2">
        {collapsed ? (
          <button
            type="button"
            onClick={toggle}
            aria-label="Expand chat pane"
            aria-expanded={false}
            title={APP_NAME}
            className={cn(
              'mx-auto flex h-8 w-8 items-center justify-center rounded-md',
              'hover:bg-[rgba(255,255,255,0.06)] transition-colors',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-brand-ring)]'
            )}
          >
            <PragnaLogo className="h-6 w-6" aria-hidden="true" />
          </button>
        ) : (
          <>
            <div className="flex flex-1 min-w-0 items-center gap-2 px-2">
              <PragnaLogo className="h-6 w-6 flex-shrink-0" aria-hidden="true" />
              <span className="truncate font-bold text-base text-[var(--color-brand)]">
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
                'text-[#737373] hover:text-[#ececea] hover:bg-[rgba(255,255,255,0.06)]',
                'transition-colors focus-visible:outline-none focus-visible:ring-2',
                'focus-visible:ring-[var(--color-brand-ring)]'
              )}
            >
              <PanelLeftClose size={18} />
            </button>
          </>
        )}
      </div>

      <ul className="flex-1 flex flex-col py-2 list-none" role="list">
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
                'text-muted-foreground transition-colors hover:bg-accent hover:text-[#ececea]',
                'focus-visible:outline-none focus-visible:bg-accent',
                collapsed && 'justify-center px-0'
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

      {/* Account / settings pinned at the bottom. The avatar trigger
          opens a Radix dropdown containing user identity, settings
          navigation, theme toggle, and sign-out — modelled after
          claude.ai's chat. See [AvatarMenu.tsx](./AvatarMenu.tsx). */}
      <div className="border-t border-[rgba(255,255,255,0.06)] p-2">
        <AvatarMenu collapsed={collapsed} />
      </div>
    </aside>
  );
}
