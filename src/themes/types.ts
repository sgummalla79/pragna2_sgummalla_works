/**
 * Type definitions for the theming framework.
 *
 * TweakCN (https://tweakcn.com) is the canonical theme source — we
 * mirror its JSON shape verbatim so users can copy-paste any TweakCN
 * theme without intermediate translation.
 *
 * The JSON looks roughly like:
 *
 *     {
 *       "name": "claude",
 *       "cssVars": {
 *         "light": { "background": "oklch(...)", "foreground": "oklch(...)", ... },
 *         "dark":  { ... },
 *         "theme": { "font-sans": "...", "font-mono": "...", "radius": "0.5rem", ... }
 *       }
 *     }
 *
 * Variables in `cssVars.light` / `cssVars.dark` use shadcn's classic
 * naming (no prefix). We add the `--color-` prefix at apply time so
 * they slot into Tailwind v4's `@theme` utility generation.
 */

/** Common-mode tokens (fonts, radius, tracking) shared by both modes. */
export interface TweakCNThemeShared {
  'font-sans'?: string;
  'font-serif'?: string;
  'font-mono'?: string;
  radius?: string;
  'tracking-normal'?: string;
  'tracking-tight'?: string;
  'tracking-tighter'?: string;
  'tracking-wide'?: string;
  'tracking-wider'?: string;
  'tracking-widest'?: string;
}

/** Per-mode token block. TweakCN's keys are kebab-case without prefix. */
export type TweakCNModeTokens = Record<string, string>;

/** The full TweakCN registry-item JSON shape. */
export interface TweakCNTheme {
  /** Stable id used as `data-palette` and as the storage key. */
  name: string;
  cssVars: {
    theme?: TweakCNThemeShared;
    light: TweakCNModeTokens;
    dark: TweakCNModeTokens;
  };
}

/** A palette as the app sees it: TweakCN JSON + a human-friendly label. */
export interface Palette {
  /** Matches `theme.name`; serves as the storage key. */
  id: string;
  /** Human label rendered in the picker. */
  label: string;
  /** Optional one-liner — origin, designer, anything. */
  description?: string;
  /** True for palettes baked into the build (uninstallable). */
  bundled: boolean;
  /** Raw TweakCN JSON. */
  theme: TweakCNTheme;
}

/** Active mode — light or dark. */
export type ThemeMode = 'light' | 'dark';

/** The subset of CSS variable keys we recognise. Anything else from
 *  TweakCN is also written (forward-compat for new shadcn primitives)
 *  but listing the well-known ones here keeps `applyPalette` honest. */
export const KNOWN_COLOR_KEYS = [
  'background', 'foreground',
  'card', 'card-foreground',
  'popover', 'popover-foreground',
  'primary', 'primary-foreground',
  'secondary', 'secondary-foreground',
  'muted', 'muted-foreground',
  'accent', 'accent-foreground',
  'destructive', 'destructive-foreground',
  'border', 'input', 'ring',
  'chart-1', 'chart-2', 'chart-3', 'chart-4', 'chart-5',
  'sidebar',
  'sidebar-foreground',
  'sidebar-primary',
  'sidebar-primary-foreground',
  'sidebar-accent',
  'sidebar-accent-foreground',
  'sidebar-border',
  'sidebar-ring',
] as const;
