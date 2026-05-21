import { Link } from 'react-router-dom';

interface Props {
  to: string;
  label: string;
}

/**
 * Navigation item that takes the user back to a parent route.
 * Styled with a copper chevron to distinguish it from regular nav items.
 */
export function SidebarBackItem({ to, label }: Props) {
  return (
    <Link
      to={to}
      className="flex items-center gap-2.5 rounded-lg px-3.5 py-2.5 text-sm font-medium text-white no-underline transition-colors duration-150 hover:bg-[rgba(255,255,255,0.05)]"
      style={{ minHeight: 44 }}
    >
      <ChevronLeftIcon />
      {label}
    </Link>
  );
}

function ChevronLeftIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="flex-shrink-0"
    >
      <path d="M15 18l-6-6 6-6" />
    </svg>
  );
}
