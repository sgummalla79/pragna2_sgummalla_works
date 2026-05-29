/**
 * Palette entries for the visual flow editor — the three node kinds the
 * author can drop on the canvas: Agent (content), If/Else (LLM-driven
 * router), End (terminator). Start is auto-placed by `newFlowGraph()` and
 * is intentionally NOT in the palette (LangGraph has exactly one entry).
 *
 * Each entry carries the icon used in BOTH the palette row AND the
 * on-canvas node card — single source of truth, so the icon a user sees
 * in the palette is the same one they see on the resulting node. The
 * palette key never reaches the BE: it picks which preset to seed (and
 * the icon to render); the BE only ever sees a UserAgent row with its
 * declared emits, the same shape as today.
 */

import { Bot, CircleStop, Play, Split, type LucideIcon } from 'lucide-react';

export type PaletteKey = 'agent' | 'if_else' | 'end';

export interface PaletteEntry {
  key: PaletteKey;
  label: string;
  icon: LucideIcon;
  /** Brief tooltip shown on hover in the palette. */
  description: string;
  /** Tailwind classes for the small rounded icon tile rendered in the
   *  palette row (and reused as the on-canvas card's icon chip). The
   *  hue matches the corresponding node-card tint so the palette feels
   *  like a preview of what drops onto the canvas. */
  iconTileClass: string;
  /** Optional Tailwind transform class applied to the icon itself
   *  (NOT the tile). Used to reorient an icon for a horizontal-flow
   *  canvas — the Split icon ships vertically (stem on top, branches
   *  going down) and needs `-rotate-90` so it reads left-to-right
   *  (stem on left, branches going right). */
  iconClass?: string;
}

export const PALETTE: ReadonlyArray<PaletteEntry> = [
  {
    key: 'agent',
    label: 'Agent',
    icon: Bot,
    description: 'An LLM call that produces content. One inbound, one outbound.',
    // Vivid tile (full saturation), white icon inside. Same hue as the
    // node card's icon chip on the canvas — palette IS the preview.
    iconTileClass: 'bg-sky-500 text-white',
  },
  {
    key: 'if_else',
    label: 'If/Else',
    // Split: a single line forking into two paths. Rotated -90° so the
    // stem points LEFT and the branches go RIGHT — matches the
    // horizontal Start-on-left → End-on-right canvas flow. (Tried
    // GitBranch — read as version-control. Tried Diamond — read as
    // flowchart decision, not branching.)
    icon: Split,
    iconClass: 'rotate-90',
    description: 'An LLM call that chooses a branch. One inbound, N+1 outbound (one per emit + else).',
    iconTileClass: 'bg-amber-500 text-white',
  },
  {
    key: 'end',
    label: 'End',
    icon: CircleStop,
    description: 'Terminator. A flow may have multiple Ends; all serialize to __end__.',
    iconTileClass: 'bg-rose-500 text-white',
  },
];

/** The icon shown on the auto-placed Start boundary node (NOT in palette). */
export const START_ICON: LucideIcon = Play;
/** Icon-tile class for the Start boundary (used on the canvas card). */
export const START_ICON_TILE_CLASS = 'bg-emerald-500 text-white';
/** Icon-tile class for the End boundary (used on the canvas card). */
export const END_ICON_TILE_CLASS = 'bg-rose-500 text-white';

/** Look up a palette entry; falls back to Agent if the key isn't recognised. */
export function paletteEntryFor(key: PaletteKey): PaletteEntry {
  return PALETTE.find((p) => p.key === key) ?? PALETTE[0];
}
