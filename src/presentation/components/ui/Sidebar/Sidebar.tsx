import { SidebarBackItem } from './SidebarBackItem';
import { SidebarNavItem } from './SidebarNavItem';
import { SidebarSection } from './SidebarSection';
import { SidebarDivider } from './SidebarDivider';
import type { SidebarItemConfig } from './types';

interface Props {
  items: SidebarItemConfig[];
  /** Controls drawer visibility on mobile (ignored on desktop). */
  isOpen: boolean;
  onClose: () => void;
  /** Width of the sidebar panel. Defaults to 240px. */
  width?: number;
  /** ARIA label for the aside element. */
  label?: string;
}

/**
 * Reusable sidebar shell.
 *
 * Items are driven entirely by the `items` config array — the Sidebar does
 * not know about specific routes or content. Each item type delegates
 * rendering to its dedicated component (SidebarBackItem, SidebarNavItem, etc.)
 * so that styling is never mixed with data.
 *
 * Desktop (≥ 1024px): positioned statically as a fixed-width panel.
 * Mobile  (< 1024px): full-height drawer that slides in from the left.
 *                     A semi-transparent backdrop covers the rest of the screen.
 */
export function Sidebar({
  items,
  width = 240,
  isOpen,
  onClose,
  label = 'Navigation',
}: Props) {
  const panelId = label.replace(/\s+/g, '-').toLowerCase();

  return (
    <>
      {/* Mobile backdrop */}
      {isOpen && (
        <div
          onClick={onClose}
          aria-hidden="true"
          className="pragna-sidebar-backdrop fixed inset-0 z-40 bg-black/55"
        />
      )}

      {/* Sidebar panel */}
      <aside
        id={panelId}
        aria-label={label}
        className={`pragna-sidebar pragna-sidebar--${isOpen ? 'open' : 'closed'}`}
        style={{
          width,
          minWidth: width,
          background: 'var(--color-background)',
          color: 'var(--color-foreground)',
          borderRight: '1px solid rgba(255,255,255,0.07)',
          display: 'flex',
          flexDirection: 'column',
          padding: '16px 12px',
          gap: 4,
        }}
      >
        {items.map((item, index) => {
          switch (item.type) {
            case 'back':
              return <SidebarBackItem key={index} to={item.to} label={item.label} />;
            case 'section':
              return <SidebarSection key={index} label={item.label} />;
            case 'nav':
              return <SidebarNavItem key={index} to={item.to} icon={item.icon} label={item.label} />;
            case 'divider':
              return <SidebarDivider key={index} />;
          }
        })}
      </aside>

      {/* Responsive behaviour */}
      <style>{`
        .pragna-sidebar {
          position: fixed;
          top: 0;
          left: 0;
          height: 100vh;
          z-index: 50;
          transition: transform 0.22s ease;
        }
        .pragna-sidebar--closed { transform: translateX(-100%); }
        .pragna-sidebar--open   { transform: translateX(0); }
        @media (min-width: 1024px) {
          .pragna-sidebar {
            position: static !important;
            transform: none !important;
            height: auto !important;
            min-height: 100vh;
          }
          .pragna-sidebar-backdrop { display: none !important; }
        }
      `}</style>
    </>
  );
}
