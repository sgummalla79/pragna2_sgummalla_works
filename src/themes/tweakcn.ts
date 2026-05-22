/**
 * TweakCN JSON parser, validator, and runtime applier.
 *
 * Apply mechanism: we translate TweakCN's kebab-case keys to
 * Tailwind v4's `--color-*` prefixed variables and write them as
 * inline style properties on `<html>`. CSS cascade does the rest —
 * every component reading `var(--color-background)` re-renders with
 * the new value, and `bg-background` utility classes (driven by the
 * `@theme` block in src/index.css) inherit the override via cascade.
 *
 * Why inline-style writes instead of swapping a stylesheet?
 *
 *   - One execution path covers bundled palettes AND user-imported
 *     palettes from localStorage. Both end up as the same JSON shape.
 *   - No FOUC: ``applyPaletteOnBoot`` runs synchronously before React
 *     mounts (called from uiStore at module load).
 *   - Removing all inline overrides (``resetPaletteOverrides``)
 *     falls back to whatever the `@theme` block in index.css says,
 *     which is our default Claude palette.
 */

import type { Palette, ThemeMode, TweakCNTheme } from './types';

/** Keys we treat as font/typography rather than color — they don't get
 *  the `--color-` prefix when written to the DOM. */
const NON_COLOR_KEYS = new Set([
  'font-sans', 'font-serif', 'font-mono',
  'radius',
  'spacing',
  'letter-spacing',
  'tracking-normal', 'tracking-tight', 'tracking-tighter',
  'tracking-wide', 'tracking-wider', 'tracking-widest',
  'shadow-color', 'shadow-opacity', 'shadow-blur', 'shadow-spread',
  'shadow-offset-x', 'shadow-offset-y',
  'shadow-2xs', 'shadow-xs', 'shadow-sm', 'shadow',
  'shadow-md', 'shadow-lg', 'shadow-xl', 'shadow-2xl',
]);

/** Convert a TweakCN var key (`background`, `font-sans`) to the CSS
 *  variable name we write on `<html>` (`--color-background`,
 *  `--font-sans`). Keeping the rule simple: anything that isn't on
 *  the NON_COLOR_KEYS deny-list gets the color prefix. */
export function toCssVarName(key: string): string {
  return NON_COLOR_KEYS.has(key) ? `--${key}` : `--color-${key}`;
}

/** Loose runtime guard for TweakCN JSON. We accept anything that has
 *  the right shape — TweakCN extends the format from time to time
 *  (chart-N, sidebar-*, font tokens) and we want forward-compat. */
export function isTweakCNTheme(raw: unknown): raw is TweakCNTheme {
  if (typeof raw !== 'object' || raw === null) return false;
  const t = raw as Record<string, unknown>;
  if (typeof t.name !== 'string' || t.name.length === 0) return false;
  const v = t.cssVars;
  if (typeof v !== 'object' || v === null) return false;
  const vv = v as Record<string, unknown>;
  if (typeof vv.light !== 'object' || vv.light === null) return false;
  if (typeof vv.dark !== 'object' || vv.dark === null) return false;
  // At minimum every TweakCN theme must define background + foreground.
  const light = vv.light as Record<string, unknown>;
  const dark = vv.dark as Record<string, unknown>;
  return (
    typeof light.background === 'string' &&
    typeof light.foreground === 'string' &&
    typeof dark.background === 'string' &&
    typeof dark.foreground === 'string'
  );
}

/** Parse a JSON string into a TweakCNTheme, throwing on shape mismatch. */
export function parseTweakCNTheme(json: string): TweakCNTheme {
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch (err) {
    throw new Error(`Invalid JSON: ${err instanceof Error ? err.message : 'parse failed'}`);
  }
  if (!isTweakCNTheme(raw)) {
    throw new Error(
      "JSON doesn't look like a TweakCN theme. Expected `name` (string) and `cssVars.light` / `cssVars.dark` with at least `background` + `foreground`.",
    );
  }
  return raw;
}

/**
 * Apply a palette to the DOM for the given mode.
 *
 * Sets `data-palette` + `data-theme` on `<html>` (used by CSS-level
 * selectors and by the picker UI) AND writes every token in the
 * matching cssVars block as an inline style property so the cascade
 * picks them up. The `theme` shared block (fonts, radius) is applied
 * once on top.
 *
 * Removes any prior inline overrides first — switching from a palette
 * that defines `--color-sidebar` to one that doesn't would otherwise
 * leak the old value.
 */
export function applyPalette(palette: Palette, mode: ThemeMode): void {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;

  resetPaletteOverrides();

  const block = palette.theme.cssVars[mode];
  for (const [key, value] of Object.entries(block)) {
    root.style.setProperty(toCssVarName(key), value);
  }

  const shared = palette.theme.cssVars.theme;
  if (shared) {
    for (const [key, value] of Object.entries(shared)) {
      if (typeof value === 'string') {
        root.style.setProperty(toCssVarName(key), value);
      }
    }
  }

  root.dataset.palette = palette.id;
  root.dataset.theme = mode;
}

/** Remove every inline `--color-*` / `--font-*` / `--radius` etc.
 *  override previously written by `applyPalette`. Useful when
 *  switching palettes or resetting to the @theme defaults baked
 *  into index.css. */
export function resetPaletteOverrides(): void {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  // Iterate a snapshot — removeProperty mutates the list while we walk.
  const props = Array.from(root.style);
  for (const prop of props) {
    if (
      prop.startsWith('--color-') ||
      prop === '--font-sans' ||
      prop === '--font-serif' ||
      prop === '--font-mono' ||
      prop === '--radius' ||
      prop.startsWith('--tracking-') ||
      prop.startsWith('--shadow') ||
      prop === '--spacing' ||
      prop === '--letter-spacing'
    ) {
      root.style.removeProperty(prop);
    }
  }
}
