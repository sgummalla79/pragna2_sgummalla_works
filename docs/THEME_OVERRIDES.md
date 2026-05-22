# Theme Overrides

Catalogue of every place where the app **deliberately ignores a TweakCN
palette token** in favour of a different (also-palette) token, or holds
a value constant across themes.

Why we keep this list: by default every surface in the app reads from
palette tokens so installed themes apply cleanly. When a token's
real-world value across popular themes produces a visibly broken
result (e.g. near-white sidebar borders in dark mode), we override.
Each override entry below records what's overridden, the substitute,
the reason, and the file(s) where the override lives.

When you add a new override, add a numbered entry here AND reference
the entry number in the code comment at the override site
(`// see docs/THEME_OVERRIDES.md (#N)`). Keeps the audit trail
discoverable from either direction.

---

## #1 — Sidebar borders & dividers use `border` instead of `sidebar-border`

**Overridden token:** `--color-sidebar-border`
**Substitute:** `--color-border`
**Scope:** every border/separator inside the chat sidebar AND the
settings sidebar — including the rail's right edge, the header bottom
edge, the footer top edge, and the `SidebarDivider` rule.

**Why:** the Claude TweakCN theme (and several others) ship
`sidebar-border: oklch(0.94 …)` — nearly white. On a dark sidebar
surface that renders as a stark white stripe along every edge, which
reads as a visual error rather than a separator. The TweakCN authors
appear to design `sidebar-border` against light-mode sidebars
specifically; we use the rail in both modes, so we hold the value
constant to `border` (which TweakCN themes tune for both modes).

**Files:**
- `src/presentation/components/ui/Sidebar/Sidebar.tsx`
- `src/presentation/components/ui/Sidebar/SidebarDivider.tsx`
- `src/presentation/views/chat/Sidebar.tsx`

**To restore the theme-defined behaviour** (i.e. follow the theme's
`sidebar-border` again): replace every `border-border` /
`bg-border` in the files above with `border-sidebar-border` /
`bg-sidebar-border` and delete this entry.

---

## #2 — Settings pages force `text-card-foreground` inheritance

**Overridden token:** *(none — this is an additive override)*
**Substitute:** every child of the settings `<main>` inherits
`--color-card-foreground` instead of the default `--color-foreground`.

**Scope:** all settings pages (Providers, Agents, Flows, Skills,
Appearance, Profile, and any future addition).

**Why:** shadcn's Label component is colour-less by design — it
inherits from its container. TweakCN's preview surfaces wrap forms
in `<Card>`, so labels there inherit `card-foreground` (~98%
lightness ≈ near-white). Our settings pages don't all use Card
wrappers, so without this override labels would inherit the dimmer
`foreground` (~80% lightness ≈ muted cream) and the contrast looks
washed out compared to the TweakCN preview the user references.

**Files:**
- `src/presentation/components/settings/SettingsLayout/SettingsLayout.tsx`
  (the `<main>` element)

**To restore the default behaviour:** remove `text-card-foreground`
from the `<main>` className and wrap individual form sections in
`<Card>` components instead (the shadcn-canonical fix).
