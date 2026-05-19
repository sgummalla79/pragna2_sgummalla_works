# Pragna Frontend — Technical Documentation

**Stack:** React 19 · TypeScript 6 (strict) · Vite 6 · Tailwind CSS v4 · CopilotKit 1.51.4 · TanStack Query v5 · Zustand v5 · Axios · React Router v7 · ReactFlow

---

## 1. Architecture Overview

Pragna follows **Clean Architecture** with four strict layers. Dependencies only flow inward (outer layers depend on inner layers, never the reverse).

```
┌─────────────────────────────────────────┐
│            Presentation                 │  React components, views, hooks, stores
│   (depends on application ports only)   │
├─────────────────────────────────────────┤
│             Infrastructure              │  Axios client, repositories, logger, tokenStorage
│   (implements application ports)        │
├─────────────────────────────────────────┤
│              Application                │  Service classes, port interfaces (IRepository)
│   (depends on domain only)              │
├─────────────────────────────────────────┤
│                Domain                   │  TypeScript types, pure utility functions
│         (no dependencies)               │
└─────────────────────────────────────────┘
```

### Layer Contracts

| Layer | May import from | May NOT import from |
|---|---|---|
| Domain | nothing | everything |
| Application | Domain | Infrastructure, Presentation |
| Infrastructure | Domain, Application ports | Presentation |
| Presentation | Application ports, Domain types | Infrastructure directly |

Presentation accesses infrastructure only through **React context dependency injection** — `ServiceProvider.tsx` wires concrete repos into context; hooks read from context via `useServices()`, not from import paths.

---

## 2. Project Structure

```
src/
├── constants/          # ONLY place import.meta.env is read; all literals here
├── domain/             # Pure TypeScript: types + utils
│   ├── types/
│   └── utils/
├── application/        # Port interfaces + service classes
│   ├── ports/
│   └── services/
├── infrastructure/     # Axios, repositories, logger, token storage
│   ├── http/
│   ├── repositories/
│   ├── storage/
│   └── logging/
├── presentation/       # React: providers, stores, hooks, components, views, router
│   ├── providers/
│   ├── store/
│   ├── hooks/
│   ├── components/
│   ├── views/
│   └── router/
├── lib/                # cn() helper (tailwind-merge + clsx)
└── assets/             # logo.svg
```

---

## 3. Environment Configuration

Copy `.env.example` to `.env` before running.

| Variable | Purpose | Default |
|---|---|---|
| `VITE_API_BASE_URL` | FastAPI backend base URL | `http://localhost:8000` |
| `VITE_COPILOTKIT_URL` | CopilotKit SSE endpoint | `http://localhost:8000/pragna` |
| `VITE_REFRESH_TOKEN_PATH` | Token refresh path | `/api/auth/refresh` |
| `VITE_LOG_LEVEL` | Minimum log level: `debug\|info\|warn\|error` | `debug` |
| `VITE_FEATURE_FLOW_BUILDER` | Enables the flow builder route | `true` |
| `VITE_APP_NAME` | Application display name | `Pragna` |

**Rule:** No file other than `src/constants/api.ts` may reference `import.meta.env`. An ESLint `no-restricted-syntax` rule with a `MemberExpression` selector enforces this.

---

## 4. Authentication Flow

### Token Lifecycle

1. `POST /api/auth/login` → `{ access_token, refresh_token }`
2. `access_token` stored **in memory** via `src/infrastructure/storage/tokenStorage.ts`
3. `refresh_token` stored in `sessionStorage` (key: `pragna_rt`) — clears on tab close
4. All Axios requests attach `Authorization: Bearer <access_token>` via `authInterceptor.ts`
5. On 401 response: interceptor calls `POST /api/auth/refresh`, retries original request **once**
6. If refresh fails (401): `tokenStorage.clearAll()`, Zustand `reset()`, redirect to `/login`

### Concurrency Lock

`authInterceptor.ts` keeps a single `refreshPromise`. If multiple requests 401 simultaneously, all wait on the same promise — preventing duplicate refresh calls.

### No Token Logging

`tokenStorage.ts` contains zero logger calls. `authInterceptor.ts` logs event names only (`auth:refresh:triggered`, `auth:refresh:succeeded`, `auth:refresh:failed`) — never token values.

---

## 5. CopilotKit Integration

The `/pragna` endpoint speaks the **CopilotKit SSE protocol** — not REST. Do not call it with `fetch` directly.

### Provider Chain

```tsx
// App.tsx render tree
<QueryClientProvider>
  <BrowserRouter>
    <ServiceProvider>         ← wires repos/services into context
      <CopilotAuthProvider>   ← passes live token to <CopilotKit>
        <AppShell>
          <AppRoutes />
        </AppShell>
      </CopilotAuthProvider>
    </ServiceProvider>
  </BrowserRouter>
</QueryClientProvider>
```

`CopilotAuthProvider` subscribes to `useAuthStore(s => s.accessToken)`. Token refreshes re-render the provider, passing the new header to CopilotKit automatically.

### Chat Component

```tsx
// ChatView.tsx
<CopilotChat
  instructions="You are Pragna, an AI assistant…"
  labels={{ title: 'Pragna', placeholder: 'Ask Pragna anything…' }}
/>
```

CopilotKit handles streaming, skill invocation (`/slash-commands`), and agent state internally.

---

## 6. State Management

### Zustand (client-only state)

| Store | Owns |
|---|---|
| `authStore` | `user`, `accessToken`, `bootstrapped`, `isAuthenticated`, `setUser()`, `reset()` |
| `uiStore` | `sidebarCollapsed`, `activeNavItem`, `toggleSidebar()` |

### TanStack Query (server state)

| Query Key | Stale Time | Hook |
|---|---|---|
| `['agent-types']` | Infinity | `useAgentTypes` |
| `['providers']` | 30 s | `useProviders` |
| `['models']` | 30 s | `useModels` |
| `['flows']` | 30 s | `useFlows` |
| `['flows', id]` | 30 s | `useFlow(id)` |
| `['skills']` | 30 s | `useSkills` |
| `['conversations', page]` | 0 | `useConversations` |
| `['conversations', id, 'usage']` | 60 s | `useConversationUsage` |

Mutations invalidate the relevant query key on success.

**Rule:** Zustand stores no server data. TanStack Query stores no auth tokens or UI state.

---

## 7. Logging

### Logger API

```typescript
logger.info('provider:created', { providerId: '...' });
logger.info('user:login', { email: redactEmail(email) });  // MUST redact PII
// NEVER: logger.info('token', { token: accessToken });    // tokens banned from logs
```

### Redaction

| Function | Input example | Output |
|---|---|---|
| `redactEmail(email)` | `"user@example.com"` | `"[REDACTED_EMAIL]"` |
| `redactName(name)` | `"Alice"` | `"[REDACTED_NAME]"` |

### Never Logged

- Access tokens or refresh tokens
- Passwords or API keys
- Email addresses (without redaction)
- Conversation message content

### Correlation ID

One UUID per page-load from `correlationStore.ts`. Every log record and every outbound HTTP request (`X-Correlation-ID` header) stamps the same ID. Use it to trace a frontend action through to backend logs.

### Log Levels by Environment

- `development`: debug + info + warn + error → `ConsoleSink` (styled)
- `production`: warn + error only (prevents volume and PII leakage)

---

## 8. UI Components

Components live in `src/presentation/components/ui/`. They follow the **shadcn/ui pattern**: built on Radix UI primitives, styled with Tailwind CSS v4, typed with class-variance-authority.

### Variant Pattern

```typescript
const button = cva('base-classes', {
  variants: {
    variant: { default: '…', outline: '…', ghost: '…', danger: '…' },
    size:    { sm: '…', md: '…', lg: '…', icon: '…' },
  },
  defaultVariants: { variant: 'default', size: 'md' },
});

<button className={cn(button({ variant, size }), className)} />
```

The `cn()` helper (in `src/lib/utils.ts`) wraps `clsx + tailwind-merge` for safe class composition.

---

## 9. Responsive Design

### Breakpoints

| Name | Width | Layout |
|---|---|---|
| mobile (default) | < 768 px | stacked, hamburger nav, no canvas |
| tablet (`md`) | ≥ 768 px | sidebar visible, two-column forms |
| desktop (`lg`) | ≥ 1024 px | full sidebar rail, flow canvas available |

### Key Responsive Behaviours

| Component | Mobile | Desktop |
|---|---|---|
| `AppShell` | Sidebar in slide-over drawer (Sheet) | Fixed 240 px sidebar rail |
| `NavBar` | Hamburger icon opens drawer | Not rendered (md:hidden) |
| `ChatView` | Full-screen, 100vh | Max-width container |
| `FlowBuilderView` | List view only (no canvas) | List view (canvas planned in v2) |
| Forms | Stacked single column | Two-column grid |

Touch targets: all interactive elements ≥ 44 × 44 px everywhere.

---

## 10. Testing

### Stack

- **Vitest** — test runner
- **React Testing Library** — component rendering and interaction
- **MSW v2** — network-level mock (intercepts Axios requests)
- **@testing-library/user-event** — realistic user interaction simulation
- **@testing-library/jest-dom** — custom matchers (`toBeInTheDocument`, etc.)

### Coverage Threshold

`vitest.config.ts` enforces:
```typescript
thresholds: { lines: 80, functions: 80, branches: 75, statements: 80 }
```

### Test Structure

Tests mirror `src/` under `src/__tests__/`:
```
src/__tests__/
├── domain/utils/              # pure unit tests (no mocks)
├── infrastructure/http/        # interceptor tests (MSW)
├── infrastructure/repositories/ # repository tests (MSW)
├── application/services/      # service tests (mock ports)
├── presentation/router/       # route guard tests (RTL)
└── presentation/views/        # view tests (RTL + mock services)
```

### SVG Mock in Tests

`src/__tests__/setup.ts` mocks `@/assets/logo.svg?react` to return `null`. jsdom cannot parse SVG with XML comments (the logo file contains `<!-- ... -->` nodes). This is the **correct and intentional** mock — the logo renders normally in a real browser.

---

## 11. Development Setup

```bash
# 1. Install dependencies
npm install

# 2. Copy env template
cp .env.example .env

# 3. Start the backend (must run on http://localhost:8000)
#    See backend repository README

# 4. Start the frontend dev server
npm run dev    # → http://localhost:5173

# 5. Run tests
npm run test           # watch mode
npm run test:coverage  # coverage report

# 6. Type check
npm run typecheck      # tsc --noEmit, strict mode

# 7. Lint
npm run lint           # eslint --max-warnings 0
```

### Available Scripts

| Script | Purpose |
|---|---|
| `dev` | Vite HMR dev server |
| `build` | TypeScript check + production bundle |
| `preview` | Preview production build locally |
| `test` | Vitest watch mode |
| `test:coverage` | Istanbul coverage report |
| `typecheck` | `tsc --noEmit` strict check |
| `lint` | ESLint zero-warnings policy |
| `format` | Prettier write |

---

## 12. Naming Conventions

| Entity | Convention | Example |
|---|---|---|
| React components | PascalCase folder + file | `ChatView/ChatView.tsx` |
| Hooks | camelCase `use` prefix | `useProviders.ts` |
| Domain types | camelCase + `.types.ts` | `provider.types.ts` |
| Constants files | camelCase | `edgeConditions.ts` |
| Services | PascalCase + `Service.ts` | `AuthService.ts` |
| Repositories | PascalCase + `Repository.ts` | `ProviderRepository.ts` |
| Port interfaces | `I` prefix + PascalCase | `IProviderRepository.ts` |
| Tests | mirror name + `.test.ts(x)` | `LoginView.test.tsx` |
