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
 * so styling is never mixed with data.
 *
 * Desktop (≥ 1024px): positioned statically as a fixed-width panel.
 * Mobile  (< 1024px): full-height drawer that slides in from the left,
 *                     dimmed backdrop behind it.
 *
 * Every surface (background, foreground, border) reads from the active
 * palette via Tailwind tokens.
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
          className="pragna-sidebar-backdrop fixed inset-0 z-40 bg-foreground/40 lg:hidden"
        />
      )}

      {/* Sidebar panel.
       *
       * Positioned `fixed` on mobile (sliding drawer) and `lg:static` on
       * desktop (column in the flex shell). The slide transform is the
       * only piece of CSS that needs custom rules — Tailwind doesn't ship
       * a "slide-in-from-left at < lg" primitive, so we keep a tiny
       * scoped style block that only governs the transform animation.
       * Colours all come from palette tokens. */}
      <aside
        id={panelId}
        aria-label={label}
        className={`
          pragna-sidebar pragna-sidebar--${isOpen ? 'open' : 'closed'}
          flex flex-col gap-1 px-3 py-4
          bg-background text-foreground border-r border-border
        `}
        style={{ width, minWidth: width }}
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

      {/* Slide-in transform — only piece of custom CSS; no colour rules. */}
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
        }
      `}</style>
    </>
  );
}
