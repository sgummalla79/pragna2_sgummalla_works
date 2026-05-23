import { type ReactNode } from 'react';
import { PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { cn } from '@/lib/utils';

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
  /** Width of the sidebar panel when expanded. Default 240px. */
  width?: number;
  /** ARIA label for the aside element. */
  label?: string;
  /** Optional title rendered in the expanded header (e.g. "Settings").
   *  When omitted, the header still renders the collapse toggle but
   *  no text. */
  headerTitle?: string;
  /** Collapsed state. When true the sidebar shrinks to icon-only mode
   *  (w-14) and section labels are hidden. */
  collapsed?: boolean;
  /** Toggle handler. Must be set together with `collapsed` for the
   *  toggle control to render. */
  onCollapseToggle?: () => void;
  /** Icon rendered inside the toggle button. Used identically in both
   *  expanded and collapsed states — the direction of the action is
   *  carried by the `aria-label` / `title`. Defaults to lucide's
   *  PanelLeftClose / PanelLeftOpen pair (the conventional collapse
   *  affordance). Callers can pass a section-themed icon
   *  (e.g. a gear for Settings) when they'd rather identify the
   *  section than show a generic collapse glyph. */
  toggleIcon?: ReactNode;
  /** Optional brand/section icon rendered BEFORE `headerTitle` in the
   *  expanded header (e.g. a gear for Settings). In collapsed mode this
   *  icon replaces the generic collapse chevron and itself becomes the
   *  expand click target — same pattern the chat sidebar uses for the
   *  Pragna logo. Independent of `toggleIcon` (which still controls the
   *  collapse-button glyph when expanded). */
  headerIcon?: ReactNode;
}

/** Width of the sidebar in icon-only mode (matches chat sidebar). */
const COLLAPSED_WIDTH = 56;

/**
 * Reusable sidebar shell.
 *
 * Two display modes — both driven entirely by the `items` config and
 * the optional `collapsed` flag:
 *
 *   - **Expanded** (default): full width, item labels + section headers
 *     visible. A collapse toggle appears in the header iff
 *     `onCollapseToggle` is provided.
 *   - **Collapsed**: shrinks to `COLLAPSED_WIDTH` px, items render as
 *     icon-only with native `title` tooltips, section labels are
 *     skipped. Click the toggle (or any item) to interact.
 *
 * Mobile (< 1024px): always a sliding drawer regardless of `collapsed`
 * — there's no room for icon-only mode on a narrow viewport, so the
 * drawer always renders at the expanded width.
 *
 * Every surface (background, foreground, border, hover, focus ring)
 * reads from palette tokens.
 */
export function Sidebar({
  items,
  width = 240,
  isOpen,
  onClose,
  label = 'Navigation',
  headerTitle,
  collapsed = false,
  onCollapseToggle,
  toggleIcon,
  headerIcon,
}: Props) {
  const panelId = label.replace(/\s+/g, '-').toLowerCase();
  const showCollapseControl = Boolean(onCollapseToggle);
  const effectiveWidth = collapsed ? COLLAPSED_WIDTH : width;

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

      <aside
        id={panelId}
        aria-label={label}
        className={cn(
          'pragna-sidebar',
          `pragna-sidebar--${isOpen ? 'open' : 'closed'}`,
          'flex flex-col flex-shrink-0',
          // Sidebar surface uses sidebar-* tokens (theme intent for the
          // rail). Border deliberately uses `border-border` instead of
          // `border-sidebar-border` — see docs/THEME_OVERRIDES.md
          // (#1: many TweakCN themes ship a near-white sidebar-border
          // which looks like a stark stripe in dark mode).
          'bg-sidebar text-sidebar-foreground border-r border-border',
          'transition-[width] duration-150 ease-out',
        )}
        style={{ width: effectiveWidth, minWidth: effectiveWidth }}
      >
        {showCollapseControl && (
          <div
            className={cn(
              'flex h-12 items-center border-b border-border px-2',
              collapsed ? 'justify-center' : 'gap-2',
            )}
          >
            {collapsed ? (
              // When collapsed the only header element is the click
              // target that re-expands. If a `headerIcon` is supplied it
              // doubles as that target (matches the chat sidebar's logo-
              // is-the-expander pattern); otherwise we fall back to the
              // generic chevron — preserves backward-compat for callers
              // that don't pass a brand icon.
              <button
                type="button"
                onClick={onCollapseToggle}
                aria-label="Expand sidebar"
                aria-expanded={false}
                title="Expand sidebar"
                className={cn(
                  'flex h-8 w-8 items-center justify-center rounded-md',
                  'text-sidebar-foreground/80 hover:text-sidebar-accent-foreground hover:bg-sidebar-accent',
                  'transition-colors',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-sidebar-ring)]',
                )}
              >
                {headerIcon ?? toggleIcon ?? <PanelLeftOpen size={18} aria-hidden="true" />}
              </button>
            ) : (
              <>
                {headerIcon && (
                  <span
                    className="flex flex-shrink-0 items-center pl-1 text-sidebar-foreground"
                    aria-hidden="true"
                  >
                    {headerIcon}
                  </span>
                )}
                {headerTitle && (
                  <span className="flex-1 truncate px-1 text-[13px] font-semibold text-sidebar-foreground">
                    {headerTitle}
                  </span>
                )}
                <button
                  type="button"
                  onClick={onCollapseToggle}
                  aria-label="Collapse sidebar"
                  aria-expanded
                  title="Collapse sidebar"
                  className={cn(
                    'flex h-8 w-8 items-center justify-center rounded-md',
                    'text-sidebar-foreground/70 hover:text-sidebar-accent-foreground hover:bg-sidebar-accent',
                    'transition-colors',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-sidebar-ring)]',
                  )}
                >
                  {toggleIcon ?? <PanelLeftClose size={18} aria-hidden="true" />}
                </button>
              </>
            )}
          </div>
        )}

        <div className="flex-1 min-h-0 overflow-y-auto flex flex-col gap-1 px-3 py-4">
          {items.map((item, index) => {
            // Dividers and section headers are skipped wholesale in
            // collapsed mode — the icons are distinct enough that
            // category breaks don't earn their pixels at icon-only
            // width, and stacked rules just look like noise.
            if (collapsed && (item.type === 'divider' || item.type === 'section')) {
              return null;
            }

            switch (item.type) {
              case 'back':
                return (
                  <SidebarBackItem
                    key={index}
                    to={item.to}
                    label={item.label}
                    collapsed={collapsed}
                  />
                );
              case 'section':
                return <SidebarSection key={index} label={item.label} />;
              case 'nav':
                return (
                  <SidebarNavItem
                    key={index}
                    to={item.to}
                    icon={item.icon}
                    label={item.label}
                    collapsed={collapsed}
                  />
                );
              case 'divider':
                return <SidebarDivider key={index} />;
            }
          })}
        </div>
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
            height: 100% !important;
          }
        }
      `}</style>
    </>
  );
}
