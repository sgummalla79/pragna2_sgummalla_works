import { type ReactNode } from 'react';
import { NavLink } from 'react-router-dom';
import { cn } from '@/lib/utils';

interface Props {
  to: string;
  icon: ReactNode;
  label: string;
  /** When true, render as icon-only with a native tooltip carrying
   *  the label so the row stays discoverable in collapsed mode. */
  collapsed?: boolean;
}

/**
 * Standard sidebar navigation link. Reads from palette tokens — no
 * hardcoded colours. Active state: tinted-primary background, full-
 * strength foreground. Inactive: muted foreground with accent hover.
 */
export function SidebarNavItem({ to, icon, label, collapsed = false }: Props) {
  return (
    <NavLink
      to={to}
      title={collapsed ? label : undefined}
      aria-label={collapsed ? label : undefined}
      className={({ isActive }) =>
        cn(
          'flex items-center rounded-lg text-[13px] no-underline',
          'transition-colors duration-150',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)]',
          collapsed ? 'h-10 w-10 justify-center mx-auto' : 'gap-2.5 px-3 py-2.5 min-h-10',
          isActive
            ? 'font-semibold text-foreground bg-primary/10'
            : 'font-medium text-muted-foreground hover:text-foreground hover:bg-accent',
        )
      }
    >
      <span className="flex flex-shrink-0 items-center" aria-hidden="true">
        {icon}
      </span>
      {!collapsed && label}
    </NavLink>
  );
}
