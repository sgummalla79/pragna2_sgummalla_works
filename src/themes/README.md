# Theming framework

End-users author themes on [tweakcn.com](https://tweakcn.com) and
import the JSON into the app. No CSS edits, no rebuild, no
`pnpm dlx shadcn add` — paste, click Install, done.

## How a palette flows through the app

```
TweakCN JSON
   │
   │  pasted into Settings → Appearance → "Install from TweakCN"
   ▼
parseTweakCNTheme()        ── validates shape, throws on malformed input
   │
   ▼
installPalette()           ── persists to localStorage['pragna:installed-palettes']
   │
   ▼
setPaletteId() (uiStore)   ── flips active palette
   │
   ▼
applyPalette()             ── writes inline --color-* / --font-* properties
                              on <html>; Tailwind utilities pick them up
                              via CSS cascade
```

## Adding a bundled palette (build-time)

1. Copy the TweakCN JSON.
2. Drop a new file in `src/themes/` exporting a `Palette` constant —
   mirror `claude.ts`.
3. Add it to the `BUNDLED_PALETTES` array in `registry.ts`.

That's it. The picker auto-discovers anything in `BUNDLED_PALETTES`.

## File-by-file

| File | Purpose |
|---|---|
| `types.ts` | TypeScript shapes mirroring TweakCN's JSON contract. |
| `tweakcn.ts` | Parser / validator / `applyPalette` / `resetPaletteOverrides`. |
| `claude.ts` | Bundled default palette. |
| `registry.ts` | Bundled list + localStorage I/O for installed palettes. |

The `@theme` block in `src/index.css` is the **first-paint baseline**
— values there only show if JS hasn't run yet. Once `uiStore` loads
(at module import time, before React mounts), `applyPalette` overrides
them with the active palette + mode.

## Things to know

- **Mode toggle re-applies the palette.** Light/dark is a property of
  the palette, not separate state. Toggling mode just calls
  `applyPalette(samePalette, newMode)`.
- **Removing the active palette** falls back to the bundled default —
  see `refreshPalette` in `uiStore.ts`.
- **The `--color-error-*` triplet** is app-specific (not TweakCN's).
  We keep it red regardless of palette so error banners stay legible.
- **TweakCN occasionally extends the JSON** (new shadcn primitives like
  `sidebar-*`, `chart-N`). `applyPalette` writes every key it finds,
  so new keys flow through without code changes — `KNOWN_COLOR_KEYS`
  in `types.ts` is informational only.
