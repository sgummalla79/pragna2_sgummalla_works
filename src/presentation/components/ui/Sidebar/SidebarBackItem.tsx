import { Link } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Props {
  to: string;
  label: string;
  /** Icon-only mode for collapsed sidebars. */
  collapsed?: boolean;
}

/**
 * Navigation item that takes the user back to a parent route. Reads
 * from palette tokens; the chevron uses `currentColor`.
 */
export function SidebarBackItem({ to, label, collapsed = false }: Props) {
  return (
    <Link
      to={to}
      title={collapsed ? label : undefined}
      aria-label={collapsed ? label : undefined}
      className={cn(
        'flex items-center rounded-lg text-sm font-medium text-foreground no-underline',
        'transition-colors duration-150 hover:bg-accent',
        collapsed ? 'h-10 w-10 justify-center mx-auto' : 'gap-2.5 px-3.5 py-2.5 min-h-11',
      )}
    >
      <ChevronLeft size={16} strokeWidth={2.5} className="flex-shrink-0" aria-hidden="true" />
      {!collapsed && label}
    </Link>
  );
}
