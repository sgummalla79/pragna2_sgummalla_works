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
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-brand-ring)]',
          isActive
            ? 'font-semibold text-white bg-[rgba(201,112,64,0.12)]'
            : 'font-medium text-white/70 hover:text-white hover:bg-[rgba(255,255,255,0.05)]'
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
