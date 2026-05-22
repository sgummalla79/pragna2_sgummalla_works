/**
 * Palette registry — the single source of truth for "what palettes
 * can the app render right now".
 *
 * Two storage paths feed the registry:
 *
 *   1. **Bundled palettes** (this file): shipped with the build. Always
 *      available, can't be uninstalled. Used as the safe fallback if
 *      localStorage is empty or corrupt.
 *   2. **Imported palettes** (localStorage): TweakCN JSON the user
 *      pasted into the Import dialog. Survives reloads. Removable.
 *
 * `getPalette(id)` looks at bundled first, then localStorage. If a
 * user installs a palette with the same id as a bundled one, the
 * installed copy wins — letting users override "claude" with their
 * own tweaked variant.
 */

import type { Palette, TweakCNTheme } from './types';
import { isTweakCNTheme } from './tweakcn';
import { CLAUDE_PALETTE } from './claude';

const STORAGE_KEY = 'pragna:installed-palettes';
const ACTIVE_KEY = 'pragna:active-palette';

/** Build-time bundled palettes. Add more by importing + appending. */
export const BUNDLED_PALETTES: readonly Palette[] = [CLAUDE_PALETTE];

/** Fallback id when nothing else resolves. */
export const DEFAULT_PALETTE_ID = CLAUDE_PALETTE.id;

/** Shape of one entry written to localStorage. */
interface InstalledRecord {
  id: string;
  label: string;
  description?: string;
  theme: TweakCNTheme;
  /** ISO timestamp; surfaces "Installed N days ago" if/when we want it. */
  installedAt: string;
}

/** Read the installed-palette list from localStorage. Silently
 *  returns [] on any I/O or shape failure — never throws. */
export function readInstalledPalettes(): Palette[] {
  if (typeof window === 'undefined') return [];
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const out: Palette[] = [];
    for (const entry of parsed) {
      if (
        typeof entry !== 'object' || entry === null ||
        typeof (entry as InstalledRecord).id !== 'string' ||
        !isTweakCNTheme((entry as InstalledRecord).theme)
      ) {
        continue;
      }
      const rec = entry as InstalledRecord;
      out.push({
        id: rec.id,
        label: rec.label ?? rec.id,
        description: rec.description,
        bundled: false,
        theme: rec.theme,
      });
    }
    return out;
  } catch {
    return [];
  }
}

/** Persist the installed-palette list. */
function writeInstalledPalettes(palettes: Palette[]): void {
  if (typeof window === 'undefined') return;
  const records: InstalledRecord[] = palettes.map((p) => ({
    id: p.id,
    label: p.label,
    description: p.description,
    theme: p.theme,
    installedAt: new Date().toISOString(),
  }));
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
}

/** The merged palette list: bundled + installed, installed-wins on
 *  id collision. Order: bundled first, then installed (newest last). */
export function listPalettes(): Palette[] {
  const installed = readInstalledPalettes();
  const installedIds = new Set(installed.map((p) => p.id));
  const bundledFiltered = BUNDLED_PALETTES.filter((p) => !installedIds.has(p.id));
  return [...bundledFiltered, ...installed];
}

/** Resolve one palette by id, falling back to the default. */
export function getPalette(id: string | null | undefined): Palette {
  const list = listPalettes();
  return list.find((p) => p.id === id) ?? list[0] ?? CLAUDE_PALETTE;
}

/** Add or replace a user-installed palette. Returns the saved Palette
 *  so callers can immediately apply it. */
export function installPalette(args: {
  theme: TweakCNTheme;
  label?: string;
  description?: string;
}): Palette {
  const list = readInstalledPalettes();
  const id = args.theme.name;
  const palette: Palette = {
    id,
    label: args.label ?? id.charAt(0).toUpperCase() + id.slice(1),
    description: args.description,
    bundled: false,
    theme: args.theme,
  };
  const replaced = list.filter((p) => p.id !== id);
  replaced.push(palette);
  writeInstalledPalettes(replaced);
  return palette;
}

/** Remove an installed palette. No-op if the id is bundled-only.
 *  Returns true when something was actually removed. */
export function uninstallPalette(id: string): boolean {
  const list = readInstalledPalettes();
  const next = list.filter((p) => p.id !== id);
  if (next.length === list.length) return false;
  writeInstalledPalettes(next);
  return true;
}

/** Active-palette persistence — used by uiStore. */
export function readActivePaletteId(): string {
  if (typeof window === 'undefined') return DEFAULT_PALETTE_ID;
  return window.localStorage.getItem(ACTIVE_KEY) ?? DEFAULT_PALETTE_ID;
}

export function writeActivePaletteId(id: string): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(ACTIVE_KEY, id);
}
