import { type ReactNode } from 'react';
import { NavLink } from 'react-router-dom';
import { cn } from '@/lib/utils';

interface Props {
  to: string;
  icon: ReactNode;
  label: string;
}

/**
 * Standard sidebar navigation link.
 * Active state: copper tint background, full-brightness text.
 * Inactive + hover: subtle white tint.
 */
export function SidebarNavItem({ to, icon, label }: Props) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        cn(
          'flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-[13px] no-underline',
          'transition-colors duration-150',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)]',
          // Semantic tokens so light + dark palettes both contrast
          // correctly. Active: full-strength foreground + tinted primary
          // background. Inactive: muted foreground + accent hover.
          isActive
            ? 'font-semibold text-foreground bg-primary/10'
            : 'font-medium text-muted-foreground hover:text-foreground hover:bg-accent'
        )
      }
      style={{ minHeight: 40 }}
    >
      <span className="flex flex-shrink-0 items-center" aria-hidden="true">
        {icon}
      </span>
      {label}
    </NavLink>
  );
}
