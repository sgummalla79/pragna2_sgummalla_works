import { Settings as SettingsIcon } from 'lucide-react';

import { Sidebar } from '@/presentation/components/ui/Sidebar/Sidebar';
import { ROUTES } from '@/constants/routes';
import { useUiStore } from '@/presentation/store/uiStore';
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
  { type: 'nav', to: ROUTES.SETTINGS_MCP_SERVERS, icon: <McpServersIcon />, label: 'MCP Servers' },
  { type: 'section', label: 'Workflows' },
  { type: 'nav', to: ROUTES.SETTINGS_AGENTS, icon: <AgentsIcon />, label: 'Agents' },
  { type: 'nav', to: ROUTES.SETTINGS_FLOWS,  icon: <FlowsIcon />,  label: 'Flows' },
  { type: 'nav', to: ROUTES.SETTINGS_SKILLS, icon: <SkillsIcon />, label: 'Skills' },
  { type: 'section', label: 'Account' },
  { type: 'nav', to: ROUTES.SETTINGS_APPEARANCE, icon: <AppearanceIcon />, label: 'Appearance' },
  { type: 'nav', to: ROUTES.SETTINGS_PROFILE, icon: <ProfileIcon />, label: 'Profile' },
];

/** Settings sidebar — passes the config to the shared Sidebar shell.
 *  Collapse state is persisted in uiStore so the user's choice
 *  survives navigation between settings sub-views. */
export function SettingsSidebar({ isOpen, onClose }: Props) {
  const collapsed = useUiStore((s) => s.settingsPaneCollapsed);
  const toggle = useUiStore((s) => s.toggleSettingsPane);

  return (
    <Sidebar
      isOpen={isOpen}
      onClose={onClose}
      label="Settings navigation"
      headerTitle="Settings"
      items={SETTINGS_NAV}
      collapsed={collapsed}
      onCollapseToggle={toggle}
      // Gear identifies the section. Expanded: sits before "Settings"
      // as a section mark, with a separate chevron handling the
      // collapse action on the right. Collapsed: the gear itself
      // becomes the expand click target (same pattern as the chat
      // sidebar's Pragna logo).
      headerIcon={<SettingsIcon size={18} aria-hidden="true" />}
    />
  );
}

// ── Icons ─────────────────────────────────────────────────────────────────────

function ProvidersIcon() {
  // Rack-panel stack (svgrepo "tools-and-utensils-provider"). Uses
  // ``fill`` rather than ``stroke`` like the other icons in this file
  // because the source artwork is filled-shape; both styles read fine
  // at this size in either palette mode.
  return (
    <svg width="15" height="15" viewBox="0 0 512 512" fill="currentColor" aria-hidden="true">
      <path d="M454.93,150.318c16.294,0,29.551-13.257,29.551-29.551V29.564C484.481,13.262,471.224,0,454.93,0H57.07C40.776,0,27.519,13.262,27.519,29.564v91.203c0,16.294,13.257,29.551,29.551,29.551h186.307v30.523H57.07c-16.294,0-29.551,13.262-29.551,29.564v91.191c0,16.302,13.257,29.564,29.551,29.564h186.307v30.523H57.07c-16.294,0-29.551,13.257-29.551,29.551v91.203C27.519,498.738,40.776,512,57.07,512h397.86c16.294,0,29.551-13.262,29.551-29.564v-91.203c0-16.294-13.257-29.551-29.551-29.551H268.623v-30.523H454.93c16.294,0,29.551-13.262,29.551-29.564v-91.191c0-16.302-13.257-29.564-29.551-29.564H268.623v-30.523H454.93z M454.93,386.929c2.373,0,4.305,1.93,4.305,4.305v91.203c0,2.381-1.931,4.317-4.305,4.317H57.07c-2.373,0-4.305-1.936-4.305-4.317v-91.203c0-2.374,1.931-4.305,4.305-4.305H454.93z M454.93,206.088c2.373,0,4.305,1.936,4.305,4.317v91.191c0,2.381-1.931,4.317-4.305,4.317H57.07c-2.373,0-4.305-1.936-4.305-4.317v-91.191c0-2.381,1.931-4.317,4.305-4.317H454.93z M57.07,125.071c-2.373,0-4.305-1.93-4.305-4.305V29.564c0-2.381,1.931-4.317,4.305-4.317h397.86c2.373,0,4.305,1.936,4.305,4.317v91.203c0,2.374-1.931,4.305-4.305,4.305H57.07z" />
      <path d="M404.904,39.814c-19.489,0-35.345,15.856-35.345,35.345s15.855,35.345,35.345,35.345c19.489,0,35.345-15.856,35.345-35.345S424.393,39.814,404.904,39.814z M404.904,85.258c-5.568,0-10.099-4.53-10.099-10.099s4.53-10.099,10.099-10.099c5.568,0,10.099,4.531,10.099,10.099S410.472,85.258,404.904,85.258z" />
      <path d="M338.417,62.536h-17.673c-6.971,0-12.623,5.653-12.623,12.623c0,6.971,5.651,12.623,12.623,12.623h17.673c6.971,0,12.623-5.653,12.623-12.623S345.388,62.536,338.417,62.536z" />
      <path d="M279.934,62.536h-17.673c-6.971,0-12.623,5.653-12.623,12.623c0,6.971,5.653,12.623,12.623,12.623h17.673c6.971,0,12.623-5.653,12.623-12.623S286.904,62.536,279.934,62.536z" />
      <path d="M221.438,62.536H84.374c-6.971,0-12.623,5.653-12.623,12.623c0,6.971,5.653,12.623,12.623,12.623h137.064c6.971,0,12.623-5.653,12.623-12.623S228.408,62.536,221.438,62.536z" />
      <path d="M404.904,220.655c-19.489,0-35.345,15.856-35.345,35.345s15.855,35.345,35.345,35.345c19.489,0,35.345-15.856,35.345-35.345S424.393,220.655,404.904,220.655z M404.904,266.099c-5.568,0-10.099-4.531-10.099-10.099s4.53-10.099,10.099-10.099c5.568,0,10.099,4.531,10.099,10.099S410.472,266.099,404.904,266.099z" />
      <path d="M338.417,243.377h-17.673c-6.971,0-12.623,5.653-12.623,12.623s5.651,12.623,12.623,12.623h17.673c6.971,0,12.623-5.653,12.623-12.623S345.388,243.377,338.417,243.377z" />
      <path d="M279.934,243.377h-17.673c-6.972,0-12.623,5.651-12.623,12.623c0,6.971,5.653,12.623,12.623,12.623h17.673c6.971,0,12.623-5.653,12.623-12.623S286.904,243.377,279.934,243.377z" />
      <path d="M221.438,243.377H84.374c-6.971,0-12.623,5.653-12.623,12.623s5.653,12.623,12.623,12.623h137.064c6.971,0,12.623-5.653,12.623-12.623S228.408,243.377,221.438,243.377z" />
      <path d="M404.904,401.496c-19.489,0-35.345,15.856-35.345,35.345c0,19.489,15.855,35.345,35.345,35.345c19.489,0,35.345-15.856,35.345-35.345C440.249,417.352,424.393,401.496,404.904,401.496z M404.904,446.94c-5.568,0-10.099-4.53-10.099-10.099c0-5.568,4.53-10.099,10.099-10.099c5.568,0,10.099,4.53,10.099,10.099C415.003,442.409,410.472,446.94,404.904,446.94z" />
      <path d="M338.417,424.218h-17.673c-6.971,0-12.623,5.653-12.623,12.623s5.651,12.623,12.623,12.623h17.673c6.971,0,12.623-5.653,12.623-12.623S345.388,424.218,338.417,424.218z" />
      <path d="M279.934,424.218h-17.673c-6.972,0-12.623,5.651-12.623,12.623c0,6.971,5.653,12.623,12.623,12.623h17.673c6.971,0,12.623-5.653,12.623-12.623S286.904,424.218,279.934,424.218z" />
      <path d="M221.438,424.218H84.374c-6.971,0-12.623,5.653-12.623,12.623s5.653,12.623,12.623,12.623h137.064c6.971,0,12.623-5.653,12.623-12.623S228.408,424.218,221.438,424.218z" />
    </svg>
  );
}

function AgentsIcon() {
  // Bot silhouette — visually distinct from FlowsIcon (graph) so the eye
  // can sort the two related-but-different rows at a glance.
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="8" width="18" height="12" rx="2" />
      <path d="M12 4v4" />
      <circle cx="12" cy="3" r="1" />
      <circle cx="8.5" cy="13" r="1" />
      <circle cx="15.5" cy="13" r="1" />
      <path d="M9 17h6" />
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
  // svgrepo "skill" — hand holding a gear. Two paths: the small inner
  // shape (gear axis dot) + a compound outer shape whose ``fill-rule:
  // evenodd`` carves out the gear's teeth as a see-through region.
  // Filled with ``currentColor`` so the silhouette tracks the sidebar
  // foreground in either mode; the carved teeth automatically render
  // as the sidebar background colour, giving the "white outline + black
  // gear in dark mode / reverse in light mode" two-tone the user asked
  // for without needing explicit per-path theme fills.
  return (
    <svg width="15" height="15" viewBox="18 16 64 68" fill="currentColor" aria-hidden="true">
      <path fillRule="evenodd" d="M43.84,46.76a5.35,5.35,0,1,1,5.46-5.34A5.41,5.41,0,0,1,43.84,46.76Z" />
      <path fillRule="evenodd" d="M77.33,55.7,70.06,44.9V44A24,24,0,0,0,46.19,20a22,22,0,0,0-5.67.7A23.89,23.89,0,0,0,22.31,44a21.92,21.92,0,0,0,3.58,12.7c4.18,6,7,10.8,5.27,17.3a4.58,4.58,0,0,0,.9,4.2A4.43,4.43,0,0,0,35.74,80h19.6A4.72,4.72,0,0,0,60,76.2a5,5,0,0,0,.2-1.2,2.37,2.37,0,0,1,2.39-2H64a4.72,4.72,0,0,0,4.68-3.4A41.31,41.31,0,0,0,70.16,60h5.17a2.78,2.78,0,0,0,2.19-1.6A2.86,2.86,0,0,0,77.33,55.7ZM57.49,47.33l-1,1.57a2.22,2.22,0,0,1-1.76.94,2.38,2.38,0,0,1-.72-.16l-2.65-1a11.64,11.64,0,0,1-3.85,2.2l-.48,2.91a2,2,0,0,1-2,1.65h-2a2,2,0,0,1-2-1.65l-.48-2.91a10,10,0,0,1-3.69-2l-2.81,1a2.38,2.38,0,0,1-.72.16,2.1,2.1,0,0,1-1.76-1l-1-1.65a1.94,1.94,0,0,1,.48-2.51l2.33-1.89a10.11,10.11,0,0,1-.24-2.12,9.41,9.41,0,0,1,.24-2L31.1,36.88a1.92,1.92,0,0,1-.48-2.51l1-1.65a2,2,0,0,1,1.76-1,2.38,2.38,0,0,1,.72.16l2.81,1a11.52,11.52,0,0,1,3.69-2.12L41,28a1.91,1.91,0,0,1,2-1.57h2a1.92,1.92,0,0,1,2,1.49l.48,2.83a11.31,11.31,0,0,1,3.69,2l2.81-1a2.38,2.38,0,0,1,.72-.16,2.1,2.1,0,0,1,1.76,1l1,1.65A2,2,0,0,1,57,36.8l-2.33,1.89a9.56,9.56,0,0,1,.24,2.12,9.41,9.41,0,0,1-.24,2L57,44.74A2,2,0,0,1,57.49,47.33Z" />
    </svg>
  );
}

function AppearanceIcon() {
  // Half-moon "theme" glyph — distinct from the Sun/Moon used in the
  // mode toggle button so the nav row reads as a section, not a control.
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 3a9 9 0 0 1 0 18 6 6 0 0 0 0-12 6 6 0 0 1 0-6z" fill="currentColor" />
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

function McpServersIcon() {
  // Plug glyph from lucide-react's `plug` shape, redrawn inline to
  // match the rest of this file's icon style (sized 15, stroked
  // currentColor). Visually distinct from ProvidersIcon (rack-panel
  // stack) so the eye can sort the two AI-Setup rows.
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 22v-5" />
      <path d="M9 8V2" />
      <path d="M15 8V2" />
      <path d="M18 8v4a4 4 0 0 1-4 4h-4a4 4 0 0 1-4-4V8z" />
    </svg>
  );
}
