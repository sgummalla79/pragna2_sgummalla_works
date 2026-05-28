import { useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Menu } from 'lucide-react';

import { SettingsSidebar } from '../SettingsSidebar/SettingsSidebar';
import { ROUTES } from '@/constants/routes';

/** Maps a settings path to a human-readable title for the mobile top bar. */
const SECTION_TITLES: Record<string, string> = {
  [ROUTES.SETTINGS_PROVIDERS]:  'Providers',
  [ROUTES.SETTINGS_APPEARANCE]: 'Appearance',
  [ROUTES.SETTINGS_FLOWS]:      'Flows',
  [ROUTES.SETTINGS_FLOW_AGENTS]: 'Flow agents',
  [ROUTES.SETTINGS_PROFILE]:    'Profile',
};

/**
 * Two-panel settings shell.
 *
 * Desktop (≥ 1024px): sidebar fixed on the left, content fills the right.
 * Mobile (< 1024px):  mobile top bar with page title + hamburger, sidebar
 *                     slides in as a full-height drawer overlay.
 *
 * Every surface follows the active palette via Tailwind tokens — no
 * inline colour styles, no custom CSS.
 */
export function SettingsLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { pathname } = useLocation();
  const pageTitle = SECTION_TITLES[pathname] ?? 'Settings';

  // ``h-screen`` (not ``min-h-screen``) so the viewport is the canvas:
  // the sidebar stays put while only the main content scrolls. Mirrors
  // the chat-page layout.
  return (
    <div className="flex h-screen bg-background text-foreground">
      {/* ── Sidebar ─────────────────────────────────────────────────────── */}
      <SettingsSidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      {/* ── Main area ───────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Mobile top bar — visible only below the lg breakpoint */}
        <header className="lg:hidden flex items-center gap-3 h-13 px-4 bg-muted border-b border-border flex-shrink-0">
          <button
            type="button"
            onClick={() => setSidebarOpen(true)}
            aria-label="Open settings menu"
            className="inline-flex h-9 w-9 items-center justify-center rounded-md text-foreground hover:bg-accent transition-colors"
          >
            <Menu size={20} aria-hidden="true" />
          </button>
          <span className="text-[15px] font-semibold text-foreground">
            {pageTitle}
          </span>
        </header>

        {/* Content area.
            `text-card-foreground` exposes every settings page to the
            brighter `--card-foreground` token (~98% lightness) instead
            of the page-default `--foreground` (~80%). Labels stay
            colour-less so they inherit this. See
            docs/THEME_OVERRIDES.md (#2) for the full rationale. */}
        <main className="flex-1 overflow-y-auto text-card-foreground">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
