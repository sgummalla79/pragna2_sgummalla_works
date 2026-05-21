import { Sidebar } from '@/presentation/components/ui/Sidebar/Sidebar';
import { ROUTES } from '@/constants/routes';
import type { SidebarItemConfig } from '@/presentation/components/ui/Sidebar/types';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

/** Settings navigation config — add/remove items here, styling never changes. */
const SETTINGS_NAV: SidebarItemConfig[] = [
  { type: 'back',    to: ROUTES.CHAT, label: 'Back to Chat' },
  { type: 'divider' },
  { type: 'section', label: 'AI Setup' },
  { type: 'nav', to: ROUTES.SETTINGS_PROVIDERS, icon: <ProvidersIcon />, label: 'Providers' },
  { type: 'section', label: 'Workflows' },
  { type: 'nav', to: ROUTES.SETTINGS_FLOWS,  icon: <FlowsIcon />,  label: 'Flows' },
  { type: 'nav', to: ROUTES.SETTINGS_SKILLS, icon: <SkillsIcon />, label: 'Skills' },
  { type: 'section', label: 'Account' },
  { type: 'nav', to: ROUTES.SETTINGS_PROFILE, icon: <ProfileIcon />, label: 'Profile' },
];

/** Settings sidebar — passes the config to the shared Sidebar shell. */
export function SettingsSidebar({ isOpen, onClose }: Props) {
  return (
    <Sidebar
      isOpen={isOpen}
      onClose={onClose}
      label="Settings navigation"
      items={SETTINGS_NAV}
    />
  );
}

// ── Icons ─────────────────────────────────────────────────────────────────────

function ProvidersIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
    </svg>
  );
}

function FlowsIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="18" cy="18" r="3" /><circle cx="6" cy="6" r="3" /><circle cx="6" cy="18" r="3" />
      <path d="M6 9v6M13 6h3a2 2 0 0 1 2 2v7" />
    </svg>
  );
}

function SkillsIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 2a10 10 0 1 0 10 10" />
      <path d="M12 8v4l3 3" />
      <path d="M22 2 16 8" /><path d="M17 2h5v5" />
    </svg>
  );
}

function ProfileIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="8" r="4" />
      <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
    </svg>
  );
}
