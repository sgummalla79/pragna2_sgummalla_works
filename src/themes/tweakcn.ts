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

/** Parse a TweakCN "Code" panel CSS export — `:root { ... }` for light
 *  mode, `.dark { ... }` for dark mode — into a TweakCNTheme.
 *
 *  TweakCN's CSS export uses shadcn classic naming (`--background`,
 *  `--primary`, no `--color-` prefix), which is exactly the shape we
 *  store in TweakCNTheme.cssVars under each mode key. So this parser
 *  only has to split out the two selector blocks and strip the leading
 *  ``--`` from each property name.
 */
export function parseTweakCNCss(css: string, fallbackName = 'imported'): TweakCNTheme {
  const lightBlock = extractRuleBlock(css, ':root');
  const darkBlock = extractRuleBlock(css, '.dark');

  if (!lightBlock && !darkBlock) {
    throw new Error(
      "Couldn't find `:root { ... }` or `.dark { ... }` blocks in the CSS. " +
      "Paste the full output from TweakCN's Code panel — it should include both.",
    );
  }

  const light = lightBlock ? parseDeclarations(lightBlock) : {};
  const dark = darkBlock ? parseDeclarations(darkBlock) : {};

  // Pull the theme name out of a leading ``/* … claude theme … */``
  // comment if present, else use the fallback.
  const nameMatch = css.match(/\/\*[^*]*?([\w-]+)\s+theme[^*]*?\*\//i);
  const name = nameMatch ? nameMatch[1] : fallbackName;

  if (!light.background || !light.foreground) {
    throw new Error(
      "`:root` block is missing `--background` or `--foreground`. " +
      'Make sure you copied the full Code panel, not just one block.',
    );
  }
  if (!dark.background || !dark.foreground) {
    throw new Error(
      "`.dark` block is missing `--background` or `--foreground`. " +
      'Make sure you copied the full Code panel, not just one block.',
    );
  }

  return { name, cssVars: { light, dark } };
}

/** Match a TweakCN registry URL anywhere in the input — accepts both
 *  the bare URL and copy-pasted CLI commands like
 *  ``npx shadcn add https://tweakcn.com/r/themes/foo.json``. */
const TWEAKCN_URL_RE = /https:\/\/tweakcn\.com\/r\/themes\/[\w-]+\.json/;

/**
 * Auto-detect input format and parse to a TweakCNTheme.
 *
 * Four shapes accepted:
 *   1. **JSON** — starts with `{` (the raw registry-item shape).
 *   2. **CSS**  — has `:root { ... }` + `.dark { ... }` selectors,
 *                 as shown in TweakCN's Code panel under `index.css`.
 *   3. **URL**  — `https://tweakcn.com/r/themes/<name>.json` (the
 *                 registry endpoint). We fetch + parse as JSON.
 *   4. **CLI command** — any string containing a TweakCN URL
 *                        (`pnpm dlx shadcn@latest add <URL>`,
 *                        `npx shadcn add <URL>`, etc.). We extract
 *                        the URL and treat it as case 3.
 *
 * URL paths run async; JSON / CSS are sync. To keep one call site,
 * the function always returns a Promise.
 */
export async function parseTweakCNInput(
  text: string,
  fallbackName = 'imported',
): Promise<TweakCNTheme> {
  const trimmed = text.trim();
  if (!trimmed) {
    throw new Error(
      'Paste a TweakCN theme — the install URL, JSON, or CSS from the Code panel.',
    );
  }

  // URL or CLI-command — extract the URL and fetch.
  const urlMatch = trimmed.match(TWEAKCN_URL_RE);
  if (urlMatch) {
    return fetchTweakCNTheme(urlMatch[0]);
  }

  // JSON path starts with `{` (after stripping any leading banner comment).
  const firstSignificantChar = trimmed
    .replace(/^\/\*[\s\S]*?\*\//, '')
    .trimStart()[0];
  if (firstSignificantChar === '{') {
    return parseTweakCNTheme(trimmed);
  }

  // Fall through to CSS.
  return parseTweakCNCss(trimmed, fallbackName);
}

/** Fetch a TweakCN registry URL and parse it as a TweakCNTheme.
 *  Wraps network/CORS errors in a user-friendly message that points
 *  the user at the CSS paste fallback. */
async function fetchTweakCNTheme(url: string): Promise<TweakCNTheme> {
  let response: Response;
  try {
    response = await fetch(url, { mode: 'cors' });
  } catch (err) {
    throw new Error(
      `Couldn't reach ${url} — check your network or paste the CSS from the index.css tab instead. (${err instanceof Error ? err.message : 'fetch failed'})`,
    );
  }
  if (!response.ok) {
    throw new Error(
      `TweakCN responded ${response.status} for ${url}. Try pasting the CSS instead.`,
    );
  }
  const json = await response.text();
  return parseTweakCNTheme(json);
}

/** Extract everything between the FIRST `selector { ... }` block.
 *  Returns the inner declarations as a string (no surrounding braces),
 *  or `null` if the selector isn't present. */
function extractRuleBlock(css: string, selector: string): string | null {
  // Anchor on the selector verbatim + optional whitespace + `{`. We
  // accept selector matches anywhere (TweakCN may write `.dark`,
  // `html.dark`, or other variants) but the simple form is the common
  // case.
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const startRe = new RegExp(`${escaped}\\s*\\{`, 'g');
  const match = startRe.exec(css);
  if (!match) return null;
  // Walk forward counting braces to find the matching `}`.
  const start = match.index + match[0].length;
  let depth = 1;
  for (let i = start; i < css.length; i++) {
    if (css[i] === '{') depth++;
    else if (css[i] === '}') {
      depth--;
      if (depth === 0) return css.slice(start, i);
    }
  }
  return null;
}

/** Parse `--key: value;` declarations into a `{ key: value }` map.
 *  Strips the leading `--` so keys match TweakCN's JSON shape
 *  (`background`, not `--background`). Comments are skipped. */
function parseDeclarations(block: string): Record<string, string> {
  const out: Record<string, string> = {};
  const cleaned = block.replace(/\/\*[\s\S]*?\*\//g, '');
  for (const raw of cleaned.split(';')) {
    const decl = raw.trim();
    if (!decl) continue;
    const colon = decl.indexOf(':');
    if (colon < 0) continue;
    const keyRaw = decl.slice(0, colon).trim();
    const value = decl.slice(colon + 1).trim();
    if (!keyRaw.startsWith('--')) continue;
    out[keyRaw.slice(2)] = value;
  }
  return out;
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

  // Tell the browser which system theme to use for native chrome
  // (`<select>` popups, scrollbars, form-control accents). Without
  // this, a dark app shows white-bordered native popups; a light app
  // shows dark scrollbars. Matching `color-scheme` to our mode lets
  // the browser pick sensible defaults for the things we can't style.
  root.style.colorScheme = mode;
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
