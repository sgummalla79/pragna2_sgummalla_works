import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { SettingsSidebar } from '../SettingsSidebar/SettingsSidebar';
import { useLocation } from 'react-router-dom';
import { ROUTES } from '@/constants/routes';

/** Maps a settings path to a human-readable title for the mobile top bar. */
const SECTION_TITLES: Record<string, string> = {
  [ROUTES.SETTINGS_PROVIDERS]: 'Providers',
  [ROUTES.SETTINGS_AGENTS]:    'Agents',
  [ROUTES.SETTINGS_FLOWS]:     'Flows',
  [ROUTES.SETTINGS_SKILLS]:    'Skills',
  [ROUTES.SETTINGS_PROFILE]:   'Profile',
};

/**
 * Two-panel settings shell.
 *
 * Desktop (≥ 1024px): sidebar fixed on the left, content fills the right.
 * Mobile (< 1024px):  mobile top bar with page title + hamburger, sidebar
 *                     slides in as a full-height drawer overlay.
 */
export function SettingsLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { pathname } = useLocation();
  const pageTitle = SECTION_TITLES[pathname] ?? 'Settings';

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--color-background)' }}>

      {/* ── Sidebar ─────────────────────────────────────────────────────── */}
      <SettingsSidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      {/* ── Main area ───────────────────────────────────────────────────── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

        {/* Mobile top bar — hidden on desktop */}
        <header className="settings-topbar" style={{
          display: 'none',
          alignItems: 'center',
          gap: 12,
          padding: '0 16px',
          height: 52,
          background: 'var(--color-muted)',
          borderBottom: '1px solid rgba(255,255,255,0.07)',
          flexShrink: 0,
        }}>
          <button
            onClick={() => setSidebarOpen(true)}
            aria-label="Open settings menu"
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: 8,
              borderRadius: 6,
              color: 'var(--color-foreground)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <HamburgerIcon />
          </button>
          <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--color-foreground)' }}>
            {pageTitle}
          </span>
        </header>

        {/* Content area */}
        <main style={{ flex: 1, overflowY: 'auto', padding: 32 }}>
          <Outlet />
        </main>
      </div>

      {/* Show mobile top bar only on small screens */}
      <style>{`
        @media (max-width: 1023px) {
          .settings-topbar { display: flex !important; }
        }
      `}</style>
    </div>
  );
}

function HamburgerIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
      <line x1="3" y1="6"  x2="21" y2="6"  />
      <line x1="3" y1="12" x2="21" y2="12" />
      <line x1="3" y1="18" x2="21" y2="18" />
    </svg>
  );
}
