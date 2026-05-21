# Future Enhancements (Frontend)

A running list of follow-up work that was scoped out (or surfaced and parked)
during normal development on the React client. Items here are not stale
TODOs scattered in code comments — they're load-bearing decisions or known
sharp edges we agreed to defer. Anyone picking up work in the same area
should read this first.

For done work, see `git log`. For *currently in progress*, see the active
plan file in your editor. This document is for **deferred** work only.

Backend follow-ups live in the API repo's own document — keep the two
lists separate.

---

## Light-mode palette

**Today:** the avatar menu has a working theme toggle that flips
`document.documentElement.dataset.theme` between `dark` and `light`
and persists the choice in localStorage (`uiStore.theme` /
`toggleTheme`). The visual result is **nothing** — no CSS rules key off
`[data-theme=light]` yet, so the app remains visually dark in either
mode.

The plumbing is in place; only the colour tokens are missing.

**Why parked:** building a usable light palette is a separate design
exercise. The current dark UI uses ~30 hard-coded colour values
(`#212121`, `#737373`, `rgba(255,255,255,0.06)`, etc.) scattered across
components rather than CSS variables, so a light mode wants either
(a) a token sweep first or (b) an `[data-theme=light]` block that
overrides the few colour custom-properties we do have plus inline
overrides in any hard-coded component.

**Trigger:** as soon as a user actually wants to use the toggle, or
when accessibility / branding demands a light option.

**Proposed scope when resumed:**
1. **Token sweep first.** Replace every hard-coded colour in `src/`
   with a CSS variable defined under `:root` in `index.css`. Use
   semantic names: `--surface-1` (page bg), `--surface-2` (cards),
   `--surface-elevated` (modals), `--border-subtle`, `--text-primary`,
   `--text-muted`, etc. Each token gets a dark value at `:root` and a
   light override at `:root[data-theme=light]`.
2. Add a "System" option that follows `prefers-color-scheme` so the
   menu has Dark / Light / System (the toggle becomes a tri-state
   instead of a binary flip).
3. Wire the chat surface (CopilotChat's own theme), the syntax
   highlighter, and the provider modal scrollbar — each tends to need
   its own theme switch.

---

## Cross-page navigation + History page final home

**Today:** the global `Sidebar.tsx` / `NavBar.tsx` / `AppShell.tsx`
were deleted. Each route owns its own layout — `ChatView` has
`ChatSidebar` (brand + New Chat + Chats + Sign out), `/settings/*` has
`SettingsSidebar`. Auth views render full-page.

**Why parked:** removing the global rail was the goal of that PR;
deciding how the rest of the app gets navigated is its own design
discussion.

**Two gaps left behind:**

1. **No path out of `/chat` to non-chat pages.** Today the only way
   from the chat surface to `/settings/providers` (or `/skills`, or
   `/conversations`) is to type the URL. ChatSidebar's two entries
   (New Chat, Chats) don't include cross-app navigation.
2. **`/conversations` is orphaned.** The History page still exists
   and is rendered when visited by URL, but it has no nav back out
   and is not linked from anywhere.

**Trigger:** as soon as a second human uses the app, or whenever
navigation friction becomes user-visible.

**Three concrete shapes to consider when you resume:**

- **(a) Grow `ChatSidebar` into the app sidebar.** Below New Chat /
  Chats, add a section divider then Providers / Skills / History
  entries. Brand stays at top, Sign out stays at bottom. Most
  straightforward; concentrates all nav in one place.
- **(b) Settings-cog icon on the chat surface.** ChatSidebar stays
  chat-only; a small gear icon (in the header or footer) opens a
  popover menu with Settings + History + Sign out. Cleaner separation
  of concerns; one extra click for cross-page actions.
- **(c) Fold History into ChatSidebar's "Chats" item.** "Chats"
  becomes the conversations list. `/conversations` route is deleted
  entirely. Settings nav still needs a home (back to a / b).

Whichever shape wins, also resolve:
- Whether `/conversations` survives as a standalone route.
- Whether the FUTURE_ENHANCEMENTS item "UI for pricing refresh" lands
  in the same nav-restructure PR (the pricing-refresh button needs a
  home too).

---

## UI for pricing refresh (parked)

**Today:** the backend exposes `POST /api/llm-providers/refresh-pricing`
(two-pass refresh from the LiteLLM feed + in-code overrides). The endpoint
is reachable only via `curl`. There's no UI affordance for it.

**Why parked:** the Providers page is per-user (your registrations, your
models) but `model_pricing` is a global catalogue shared by every user.
Adding a button on a user page that mutates global state is unusual —
needs a design decision before shipping. The conversation captured three
placements (top-of-Providers banner, dedicated Settings → Pricing
sub-page, inside each provider modal) and the permission question
(any-authenticated-user vs admin-only) without locking on one.

**Trigger:** once the app has more than one human user, or someone
besides the operator starts noticing stale prices.

**When you resume:**
- Decide placement (table above is the starting point).
- Decide permissions. Tied to **Frontend RBAC** below.
- Decide whether to add a server-side cooldown — if the most-recent
  `model_pricing.updated_at` is < 60 seconds ago, the backend would
  return 429. Cheap protection against accidental double-clicks /
  two-users-clicking-simultaneously.
- Wire the call through `LlmProviderService` and a `useRefreshPricing`
  mutation hook. On success, invalidate the `llm-providers-with-
  registrations` query so pricing in every visible model card
  refreshes.

---

## "Pricing last refreshed N ago" freshness signal

**Today:** `model_pricing.updated_at` is stamped on every upsert (in
the API). The data exists; no UI consumes it yet.

**Why parked:** depends on where the refresh button lives (item above).

**Proposed scope when resumed:**
- Either:
  - hit a new `GET /api/llm-providers/pricing-status` →
    `{last_refreshed_at: ISO}` and render a `<RelativeTime>` chip near
    the refresh button, or
  - read `MAX(model_pricing.updated_at)` from a field added to the
    existing `with-registrations` response (cheaper — no extra
    round-trip).
- Use `Intl.RelativeTimeFormat` for the human-readable string;
  re-render every 60s so "Just now" → "1 minute ago" without a page
  reload.

---

## Frontend RBAC

**Today:** every authenticated user sees every UI surface. The frontend
has no concept of roles — `useAuth()` exposes a user but no `isAdmin`.

**Why parked:** tied to admin-role enforcement on the backend (also
parked there). Pointless to hide buttons on the client if the API
doesn't gate them.

**Trigger:** when the backend adds a `users.role` column and starts
gating privileged endpoints.

**Proposed scope when resumed:**
- `/api/auth/me` returns `role: 'user' | 'admin'`.
- Extend `AuthService` / `User` type with the role.
- Add `isAdmin: boolean` to `useAuth()`.
- Wrap admin-only nav items / buttons in `{isAdmin && (...)}`. Today's
  set: the pricing refresh button (once added) and anything else that
  mutates global state.

---

## DataGrid API consolidation

**Today:** `DataGrid` was rewritten (by a linter mid-PR) to expose
`save()` / `cancel()` via `forwardRef` + `useImperativeHandle`, and to
emit dirty state via an `onDirtyChange` callback. The current
`ConnectedPanel` + `ModelGrid` still use a different pattern —
`hideRowSave` doesn't exist on `DataGridProps` anymore, but `ModelGrid`
passes it. TypeScript permits it (excess props are dropped); the runtime
behaviour is fine because the rewritten DataGrid has no per-row Save
column at all. Latent inconsistency.

**Why parked:** the app works. The inconsistency is cosmetic — but it
will confuse the next person to touch this area.

**Trigger:** next time anyone edits `DataGrid` or `ConnectedPanel`.

**Proposed scope:**
- Pick one pattern (the controlled `onCellChange` pattern in
  `ConnectedPanel` is the more flexible).
- Either remove the imperative-handle plumbing in `DataGrid` and drop
  `hideRowSave` (because Save is always managed by the parent now), or
  keep the imperative API and document `hideRowSave` properly on
  `DataGridProps`.
- Remove the dead prop on `ModelGrid` either way.

---

## ConfirmButton coverage audit

**Today:** destructive actions (Disconnect, batch Cancel) use
`ConfirmButton`. The convention is documented in the component
docstring and in CLAUDE.md §9 (rule 4, via the danger-button rule).

**Why parked:** no automated enforcement. A future destructive action
added in a hurry could ship as a plain `<Button variant="danger">`
without a confirmation dialog.

**Trigger:** add to the next code review checklist or a custom eslint
rule.

**Proposed scope:**
- Either:
  - eslint rule that flags any JSX `<Button variant="danger" ...>` and
    suggests `<ConfirmButton>` instead, or
  - a one-off grep in CI: `git grep 'variant="danger"' src/` excluding
    `ConfirmButton.tsx` itself should return zero matches.

---

## ProviderModal prop reduction

**Today:** `ProviderModal` takes 12 props — credential state, connect
state, disconnect state, refresh state, plus the close handler. The
component is mostly a presentational shell that dispatches between
`ProviderConnectForm` and `ConnectedPanel`.

**Why parked:** it works; the prop list is verbose but each prop is
used. Cleanup is purely aesthetic.

**Trigger:** if `ProvidersView` grows further and the prop drilling
becomes a real maintenance burden.

**Proposed scope:**
- Pull `useProviderConnectFlow(selected)` and
  `useProviderDisconnectFlow(selected)` hooks out of `ProvidersView` so
  state lives next to the children that use it.
- `ProviderModal` becomes a thin layout component with `{children}` —
  `ProvidersView` puts `<ProviderConnectForm/>` or `<ConnectedPanel/>`
  inside it directly.

---

## Hook out the batch-edit state machine

**Today:** the dirty-buffer + Save/Cancel/Refresh toolbar pattern lives
inside `ConnectedPanel`. If the same pattern is wanted on another
settings page (e.g. a future Flows editor with per-row toggles), it
would have to be reimplemented.

**Why parked:** YAGNI. Only one consumer today.

**Trigger:** the second consumer.

**Proposed scope:**
- Extract `useBatchEditor<T>({ rows, getId, onSave, onCancel })` →
  `{ pendingChanges, effectiveRows, isDirty, dirtyCount, handleCellChange, handleSave, handleCancel }`.
- `ConnectedPanel` becomes thin glue around the hook + the toolbar.

---

## Bulk PATCH partial-success mode (client side)

**Today:** the backend bulk PATCH endpoint is all-or-nothing — the
frontend treats any error as "the whole batch failed" and keeps every
row dirty.

**Why parked:** matches the backend's chosen semantics. Partial mode is
on the backend's deferred list too.

**Trigger:** if the backend adds a `mode=partial` query param.

**Proposed scope:**
- Plumb the optional mode through `ModelRepository.bulkUpdate`.
- In partial mode, the response's `failures` array drives which rows
  remain dirty after a save — the succeeded rows clear from the buffer.
