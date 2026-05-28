# Pragna — Project Standards

These standards apply to every file touched in this project, every session, without exception. They are not a checklist to revisit at the end — they govern every decision made during implementation.

---

## 1. UI Framework

All UI is built with **Tailwind CSS v4** and **shadcn/ui** (Radix UI primitives). No other component library is introduced.

- Use shadcn/ui primitives (`Button`, `Card`, `Input`, `Label`, `Badge`, `Separator`, etc.) as the base. Custom components extend them — they never replace them.
- Styling is done exclusively through Tailwind utility classes and CSS custom properties defined in `src/index.css`. No inline `style` props, no CSS Modules, no styled-components.
- Component variants are managed with `class-variance-authority` (cva) + `tailwind-merge`. Never conditionally concatenate raw class strings.

---

## 2. UI Standards — Every Page

Every screen must satisfy all of the following before it is considered done:

**Layout**
- Mobile-first. Default styles target mobile (`< 640 px`). Use `sm:`, `md:`, `lg:` prefixes to scale up.
- All interactive elements are at minimum 44 × 44 px (WCAG 2.5.5 touch target).
- Consistent spacing scale: use Tailwind's spacing tokens (`p-4`, `gap-6`, etc.). No arbitrary pixel values unless unavoidable.

**Brand**
- Primary accent: `var(--color-brand)` (#c97040 — Pragna Copper). Used for primary buttons, active states, focus rings, and highlights.
- Hover state: `var(--color-brand-hover)` (#b5633a).
- Light tint: `var(--color-brand-light)` (#f3e0d4) for subtle backgrounds.
- Font: Carlito only. Never introduce a second typeface.
- Logo: `src/assets/logo.svg` imported as a React component via `?react`. Used in nav, auth pages, and loading states.

**Accessibility**
- All form inputs have an associated `<Label>`. Never use placeholder as the only label.
- Error states use `role="alert"` so screen readers announce them.
- Interactive elements have visible focus rings using `var(--color-brand-ring)`.
- Decorative images and icons carry `aria-hidden="true"`.

**States**
- Every async action has a loading state (spinner or disabled + aria-busy).
- Every error is surfaced with a user-facing message from the error catalog (`src/constants/errors.ts`). Raw API error strings never appear in the UI.
- Empty states are designed, not blank.

---

## 3. Evolving Design System

The design system is not frozen. When a new pattern is introduced:
1. If it can reuse an existing shadcn/ui component — do so.
2. If a new shared component is needed — add it to `src/presentation/components/ui/`.
3. If a new token (colour, spacing, radius) is needed — add it to `src/index.css` under `@theme`. Never hardcode a value in a component.
4. Document any new token or component in a comment at the definition site — not in the component that uses it.

---

## 4. Clean Architecture — Layer Rules

```
constants/  →  domain/  →  application/  →  infrastructure/  →  presentation/
```

Each layer may only import from layers to its left. Violations are not allowed.

| Layer | Owns | Must not import |
|---|---|---|
| `constants/` | Config values read from env; error catalog | Nothing from src |
| `domain/` | TypeScript types; pure utility functions | React, axios, fetch |
| `application/` | Port interfaces; service classes | React, axios, DOM APIs |
| `infrastructure/` | Repository implementations; HTTP client; logger; tokenStorage | React components |
| `presentation/` | Components, views, hooks, stores, router, context providers | Direct axios calls; direct tokenStorage reads (except via hooks) |

---

## 5. SOLID Principles

Every class, module, and component must satisfy all five:

**S — Single Responsibility.** One reason to change. Route handlers handle HTTP. Repositories handle data. Stores handle state. Components handle rendering.

**O — Open/Closed.** New behaviour is added by adding new code, not editing existing logic. Use the port/repository pattern; add new providers or strategies without touching existing ones.

**L — Liskov Substitution.** Every repository implementation is fully substitutable for its port interface. Callers never detect which concrete implementation is injected.

**I — Interface Segregation.** Ports are narrow. Components receive only the props they use. Functions accept only the arguments they need.

**D — Dependency Inversion.** High-level modules depend on abstractions (ports), not concrete implementations. `ServiceProvider` is the only place where concrete dependencies are wired.

---

## 6. No Hardcoding

**Zero literals in logic code.** Before writing any string or number directly into a component, hook, service, or repository, ask: *"Can this value change without a redeploy?"*

- If yes → it belongs in `.env` (consumed only through `src/constants/`).
- If no, but it could change between environments → `src/constants/`.
- If it is a well-known external constant (e.g. Auth0's database connection name) → `src/constants/` with a comment explaining why it is not an env var.
- Error messages → `src/constants/errors.ts`.
- Route paths → `src/constants/routes.ts`.

ESLint enforces that `import.meta.env` is only accessed inside `src/constants/`.

---

## 7. Error Handling

All application errors are defined in `src/constants/errors.ts` with a code, user-facing message, and severity. No error message string appears in more than one place.

Thrown errors use `PragnaError` from `src/domain/errors/PragnaError.ts`:
```typescript
throw new PragnaError(ERRORS.AUTH_003);
```

Logging uses `logger.fromError()` which automatically extracts the error code:
```typescript
logger.fromError('auth:refresh:failed', err);
// logs: [AUTH_003] auth:refresh:failed  correlationId=…
```

No PII, no token values, no conversation payloads are ever logged.

---

## 8. Documentation — Every Method

Every exported function, class method, React component, and hook must have a JSDoc comment that answers:
- **What** it does (one sentence).
- **Why** it exists if the name alone is not self-explanatory.
- **Parameters** — only when the type annotation is insufficient.
- **Throws** — if it can throw, state what and when.

```typescript
/**
 * Exchanges an Auth0 authorisation code for an access/refresh token pair using PKCE.
 * Called from the popup flow after the callback page posts the code via BroadcastChannel.
 *
 * @throws {PragnaError} AUTH_010 — if Auth0 rejects the exchange (expired code, mismatched verifier).
 */
private async exchangeCode(code: string, verifier: string, redirectUri: string): Promise<AuthTokens>
```

Inline comments are written only when the *why* is non-obvious (a constraint, a workaround, a subtle invariant). Never explain what the code does — the code already does that.

---

## 9. Testing

- **Framework:** Vitest + React Testing Library + MSW v2.
- **Coverage threshold:** 80 % lines, enforced in `vitest.config.ts`. New code must not drop coverage below this threshold.
- Tests live in `src/__tests__/` mirroring the `src/` structure.
- No mocking of the database or internal modules except at the port/interface boundary.
- UI tests assert user-visible behaviour (rendered text, accessible labels, navigation) — not implementation details (state shape, internal function calls).
- **Browser-tier (Playwright) suite lives at [`e2e/`](e2e/)** — its own sub-workspace (own `package.json`, deps NOT in root `node_modules` so a casual FE dev doesn't pay the Chromium download cost). Covers the pointer/visual cases jsdom can't reach (handle hover-reveal, side-handle drag, draw-time connection rules, save round-trip, prune-on-resave). Run via `npm run e2e:setup && cd e2e && npm test && npm run e2e:teardown`. Vitest is configured to ignore `e2e/**` so the unit suite doesn't try to resolve `@playwright/test`. See [`e2e/README.md`](e2e/README.md) for the full runbook and the non-obvious React Flow tricks (raw mouse for opacity-0 handles, `dispatchEvent` for z-index, psql via stdin).
