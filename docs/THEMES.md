# Pragna Theme System — shadcn Zinc

Single source of truth for colour. Every UI component must use the semantic Tailwind tokens listed below; **never** inline a hex literal like `bg-[#171717]` because it stops flipping when the user toggles light/dark.

The tokens live in [src/index.css](../src/index.css) as CSS custom properties under `@theme` (dark mode default) plus a `[data-theme="light"]` override block. Tailwind 4 auto-generates a utility class for every `--color-*` token (`bg-background`, `text-foreground`, `border-border`, …).

Theme is toggled from the avatar menu — implementation in [src/presentation/store/uiStore.ts](../src/presentation/store/uiStore.ts).

---

## Surfaces

| Token | Tailwind utility | Dark value | Light value | Use it for |
|---|---|---|---|---|
| `--color-background`          | `bg-background`          | `#09090B` (zinc-950) | `#FFFFFF`            | The page canvas. Default body background. The chat surface bg. |
| `--color-foreground`          | `text-foreground`        | `#FAFAFA` (zinc-50)  | `#09090B`            | Default body text. Primary headings and paragraph text. |
| `--color-card`                | `bg-card`                | `#18181B` (zinc-900) | `#FFFFFF`            | Elevated surface — modals, cards, the chat header strip. One step "above" the page. |
| `--color-card-foreground`     | `text-card-foreground`   | `#FAFAFA`            | `#09090B`            | Text sitting on a `bg-card` surface. Usually the same as foreground. |
| `--color-popover`             | `bg-popover`             | `#18181B`            | `#FFFFFF`            | Dropdown menus, tooltips, autocomplete popovers. |
| `--color-popover-foreground`  | `text-popover-foreground`| `#FAFAFA`            | `#09090B`            | Text inside popovers. |
| `--color-muted`               | `bg-muted`               | `#27272A` (zinc-800) | `#F4F4F5` (zinc-100) | Subtle filled areas — skeleton placeholders, "no data yet" zones, disabled inputs. |
| `--color-muted-foreground`    | `text-muted-foreground`  | `#A1A1AA` (zinc-400) | `#71717A` (zinc-500) | Secondary text: captions, helper text, timestamps, placeholders. Never use it for primary copy. |
| `--color-accent`              | `bg-accent`              | `#27272A`            | `#F4F4F5`            | **Hover states** on list rows, sidebar items, menu items. Pair with `hover:bg-accent`. |
| `--color-accent-foreground`   | `text-accent-foreground` | `#FAFAFA`            | `#09090B`            | Text on accent surface. |
| `--color-secondary`           | `bg-secondary`           | `#27272A`            | `#F4F4F5`            | Less-emphasised buttons (the Cancel button in a modal, "Maybe later" CTAs). |
| `--color-secondary-foreground`| `text-secondary-foreground` | `#FAFAFA`         | `#09090B`            | Text on secondary buttons. |

## Interaction

| Token | Tailwind utility | Dark value | Light value | Use it for |
|---|---|---|---|---|
| `--color-primary`             | `bg-primary`             | `#FAFAFA`            | `#18181B`            | The shadcn "primary" button — high-contrast inverse. **NOT** the orange brand button (see Brand). |
| `--color-primary-foreground`  | `text-primary-foreground`| `#18181B`            | `#FAFAFA`            | Text on primary buttons. |
| `--color-destructive`         | `bg-destructive`         | dark red             | bright red           | Prominent destructive buttons ("Delete forever", "Discard changes"). |
| `--color-destructive-foreground` | `text-destructive-foreground` | `#FAFAFA`     | `#FAFAFA`            | Text on destructive button surfaces. |
| `--color-error-bg`            | `bg-[var(--color-error-bg)]`     | very dark red | very light pink     | Soft error banner background (inline validation, "couldn't save"). |
| `--color-error-border`        | `border-[var(--color-error-border)]` | dark red border | light red border | Border on a soft error banner. |
| `--color-error-text`          | `text-[var(--color-error-text)]` | light red    | dark red             | Text inside a soft error banner / inline validation message. |

## Structure

| Token | Tailwind utility | Dark value | Light value | Use it for |
|---|---|---|---|---|
| `--color-border` | `border-border` or just `border` | `#27272A` | `#E4E4E7` (zinc-200) | Dividers, card outlines, separators, table row borders. Default border colour. |
| `--color-input`  | `border-input`                  | `#27272A` | `#E4E4E7`            | Form input borders (textarea, select, text input). |
| `--color-ring`   | `ring-ring` / `focus:ring-ring` | `#A1A1AA` | `#18181B`            | Default focus ring. For brand-emphasised focus rings, use `--color-brand-ring`. |

## Brand (constant across themes)

These four tokens **do not change** when light/dark flips. The copper is the brand's identity in both modes.

| Token | Tailwind utility | Value | Use it for |
|---|---|---|---|
| `--color-brand`       | `bg-brand` / `text-brand` / `border-brand` | `#C97040`                      | The Pragna copper. Primary CTAs (Send button), the active conversation indicator, important highlights. |
| `--color-brand-hover` | `hover:bg-brand-hover`                     | `#B5633A`                      | Hover state for any element on `bg-brand`. |
| `--color-brand-light` | `bg-brand-light`                           | `rgba(201, 112, 64, 0.12)`     | Subtle brand-tinted background — the active row in the sidebar, "selected" pill backgrounds. |
| `--color-brand-ring`  | `ring-brand-ring`                          | `rgba(201, 112, 64, 0.35)`     | Brand-emphasised focus ring for primary inputs. |

---

## How to pick a token (decision tree)

**Is it text?**
- Primary content (paragraph, heading) → `text-foreground`
- Caption, helper, placeholder, timestamp → `text-muted-foreground`
- Sitting on a primary button → `text-primary-foreground`
- Sitting on a destructive button → `text-destructive-foreground`
- Sitting on a brand-coloured button → `text-white` (the copper is dark enough that white text reads in both modes)

**Is it a background?**
- The whole page → `bg-background`
- A card or panel raised above the page → `bg-card`
- A dropdown / tooltip / popover → `bg-popover`
- A subtle disabled / placeholder area → `bg-muted`
- A hover state on a list / menu row → `hover:bg-accent`
- The Pragna primary CTA → `bg-brand` (`hover:bg-brand-hover`)

**Is it a border?**
- Always `border-border` (or just `border` on most Tailwind versions).
- Form input border → `border-input`

**Is it a focus ring?**
- Default → `ring-ring`
- Brand-emphasised → `ring-[var(--color-brand-ring)]`

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

## Adding a new token

1. Add to `@theme` in [src/index.css](../src/index.css) (dark default).
2. Add the override inside `[data-theme="light"] { … }`.
3. Add a row to the appropriate table in this doc with both values and a "use it for" description.
4. Reference it via the Tailwind utility (`bg-<token>`).

Avoid one-offs. If a UI surface needs a new shade, ask whether an existing token can cover it before introducing a new one — the tighter the token list, the easier the system is to keep coherent.
