# Pragna Theme System — shadcn/ui Copper

Single source of truth for colour. Every UI component must use the semantic Tailwind tokens listed below; **never** inline a hex literal like `bg-[#171717]` because it stops flipping when the user toggles light/dark.

The tokens live in [src/index.css](../src/index.css) as CSS custom properties under `@theme` (dark mode default) plus a `[data-theme="light"]` override block. They follow the shadcn/ui v2 convention: oklch colour space, `--primary` as the brand accent, neutrals tuned for warmth. Tailwind 4 auto-generates a utility class for every `--color-*` token (`bg-background`, `text-foreground`, `bg-primary`, …).

Theme is toggled from the avatar menu — implementation in [src/presentation/store/uiStore.ts](../src/presentation/store/uiStore.ts).

---

## Surfaces

| Token | Tailwind utility | Dark (default) | Light | Use it for |
|---|---|---|---|---|
| `--color-background`          | `bg-background`          | near-black (`oklch(0.145 0.004 285)`) | white                          | The page canvas. Default body background. The chat surface bg. |
| `--color-foreground`          | `text-foreground`        | near-white (`oklch(0.985 0 0)`)       | near-black                     | Default body text. Primary headings and paragraph text. |
| `--color-card`                | `bg-card`                | dark zinc (`oklch(0.21 0.006 285)`)   | white                          | Elevated surface — modals, cards, the chat header strip. One step "above" the page. |
| `--color-card-foreground`     | `text-card-foreground`   | near-white                            | near-black                     | Text sitting on a `bg-card` surface. Usually the same as foreground. |
| `--color-popover`             | `bg-popover`             | dark zinc                             | white                          | Dropdown menus, tooltips, autocomplete popovers. |
| `--color-popover-foreground`  | `text-popover-foreground`| near-white                            | near-black                     | Text inside popovers. |
| `--color-muted`               | `bg-muted`               | medium zinc (`oklch(0.274 0.006 286)`)| light zinc (`oklch(0.967 …)`)  | Subtle filled areas — skeleton placeholders, "no data yet" zones, disabled inputs. |
| `--color-muted-foreground`    | `text-muted-foreground`  | light zinc (`oklch(0.705 …)`)         | mid zinc (`oklch(0.552 …)`)    | Secondary text: captions, helper text, timestamps, placeholders. Never use it for primary copy. |
| `--color-accent`              | `bg-accent`              | medium zinc                           | light zinc                     | **Hover states** on list rows, sidebar items, menu items. Pair with `hover:bg-accent`. |
| `--color-accent-foreground`   | `text-accent-foreground` | near-white                            | near-black                     | Text on accent surface. |
| `--color-secondary`           | `bg-secondary`           | medium zinc                           | light zinc                     | Less-emphasised buttons (Cancel in a modal, "Maybe later"). |
| `--color-secondary-foreground`| `text-secondary-foreground` | near-white                         | near-black                     | Text on secondary buttons. |

## Brand accent — Copper

shadcn/ui places the brand accent under the `--primary` token rather than a dedicated `--brand` namespace. The Pragna copper sits there in both modes, slightly lighter in dark so the warm hue still reads against the near-black background.

| Token | Tailwind utility | Dark | Light | Use it for |
|---|---|---|---|---|
| `--color-primary`             | `bg-primary` / `text-primary` / `border-primary` | copper (`oklch(0.7 0.13 47)`)  | copper (`oklch(0.62 0.135 47)`) | The Pragna copper — primary CTAs (Send button), active conversation indicator, important highlights. |
| `--color-primary-foreground`  | `text-primary-foreground`                        | near-black                     | near-white                      | Text on primary buttons. |

Conventional opacity utilities replace what would have been dedicated hover/light variants:

| Pattern | Use it for |
|---|---|
| `hover:bg-primary/90` | Hover state for a primary button. (Previously `--brand-hover`.) |
| `bg-primary/10`       | Subtle brand-tinted background — selected conversation row, active pill. (Previously `--brand-light`.) |
| `ring-ring`           | Default focus ring; `--color-ring` is wired to the copper, so this **is** the brand ring. |

## Destructive

| Token | Tailwind utility | Dark | Light | Use it for |
|---|---|---|---|---|
| `--color-destructive`         | `bg-destructive`              | bright red                 | bright red                 | Prominent destructive buttons ("Delete forever", "Discard changes"). |
| `--color-destructive-foreground` | `text-destructive-foreground` | near-white               | near-white                 | Text on destructive button surfaces. |
| `--color-error-bg`            | `bg-[var(--color-error-bg)]`     | very dark red             | very light pink            | Soft error banner background (inline validation, "couldn't save"). |
| `--color-error-border`        | `border-[var(--color-error-border)]` | dark red border       | light red border           | Border on a soft error banner. |
| `--color-error-text`          | `text-[var(--color-error-text)]` | light red                  | dark red                   | Text inside a soft error banner / inline validation message. |

## Structure

| Token | Tailwind utility | Dark | Light | Use it for |
|---|---|---|---|---|
| `--color-border` | `border-border` or just `border` | translucent white (`oklch(1 0 0 / 0.1)`)  | light zinc | Dividers, card outlines, separators, table row borders. |
| `--color-input`  | `border-input`                  | translucent white (`oklch(1 0 0 / 0.15)`) | light zinc | Form input borders (textarea, select, text input). |
| `--color-ring`   | `ring-ring` / `focus:ring-ring` | copper                                   | copper      | Default focus ring. Wired to the primary so focus rings feel branded. |

---

## How to pick a token (decision tree)

**Is it text?**
- Primary content (paragraph, heading) → `text-foreground`
- Caption, helper, placeholder, timestamp → `text-muted-foreground`
- On a primary (copper) button → `text-primary-foreground`
- On a destructive button → `text-destructive-foreground`

**Is it a background?**
- The whole page → `bg-background`
- A card or panel raised above the page → `bg-card`
- A dropdown / tooltip / popover → `bg-popover`
- A subtle disabled / placeholder area → `bg-muted`
- A hover state on a list / menu row → `hover:bg-accent`
- The Pragna primary CTA → `bg-primary hover:bg-primary/90`
- Subtle brand-tinted highlight (active row) → `bg-primary/10`

**Is it a border?**
- Default → `border-border` (or just `border`)
- Form input border → `border-input`
- Primary-coloured outline (rare) → `border-primary`

**Is it a focus ring?**
- Default → `ring-ring` (this is the copper)
- For a custom inline ring colour → `ring-[var(--color-ring)]`

---

## Hex literal anti-pattern

Bad — won't flip with theme:

```tsx
<div className="bg-[#0a0a0a] text-[#ececea] border-[#2a2a2a]">
```

Good — adapts automatically:

```tsx
<div className="bg-background text-foreground border-border">
```

If you find yourself reaching for an inline hex, the colour you need probably already exists as a token — check this table. If it doesn't, add a new `--color-*` token to [src/index.css](../src/index.css) in BOTH `@theme` and `[data-theme="light"]`, then update this doc.

The same rule applies to inline `style={{}}` — use `style={{ color: 'var(--color-foreground)' }}` instead of a hex string. Tailwind utility classes are preferred where the surface already supports them; CSS variables in `style={{}}` are the fallback for surfaces where Tailwind's classes don't reach (computed strokes, gradient stops).

---

## Theme toggle plumbing

| Concern | Where |
|---|---|
| Active theme state | `useUiStore.theme` ([uiStore.ts](../src/presentation/store/uiStore.ts)) |
| Persistence | `localStorage["pragna:theme"]` — set on toggle, read at module load |
| DOM attribute | `<html data-theme="light">` (absent = dark) |
| User entry point | Avatar menu → "Light mode" / "Dark mode" item |

First paint matches the persisted preference (no flash) because `applyTheme` runs at module load before React renders.

---

## Migrating from older `bg-brand` classes

Earlier iterations of this codebase carried a separate `--color-brand-*` namespace. The R2 theme overhaul retired it in favour of shadcn's `--color-primary`. If you encounter old patterns:

| Old | New |
|---|---|
| `bg-brand`           | `bg-primary`           |
| `text-brand`         | `text-primary`         |
| `border-brand`       | `border-primary`       |
| `hover:bg-brand-hover` | `hover:bg-primary/90` |
| `bg-brand-light`     | `bg-primary/10`        |
| `ring-brand-ring`    | `ring-ring`            |
| `var(--color-brand)` | `var(--color-primary)` |

---

## Adding a new token

1. Add to `@theme` in [src/index.css](../src/index.css) (dark default).
2. Add the override inside `[data-theme="light"] { … }`.
3. Add a row to the appropriate table in this doc with both values and a "use it for" description.
4. Reference it via the Tailwind utility (`bg-<token>`).

Avoid one-offs. If a UI surface needs a new shade, ask whether an existing token can cover it before introducing a new one — the tighter the token list, the easier the system is to keep coherent.
