# pragna2 FE — end-to-end browser tests

Self-contained Playwright suite for the FE. Lives as its own
sub-workspace (its own `package.json`, deps NOT in the root) so a
casual FE dev doesn't pay the Chromium download cost.

## Layout

```
e2e/
├── package.json                # Playwright + TypeScript only
├── playwright.config.ts        # baseURL=http://localhost:5173, retains failures
├── tsconfig.json               # isolated; root tsc -b ignores this dir
├── auth-strategy-switch.patch  # tracked patch; applied + reverted by setup/teardown
├── helpers/
│   ├── env.ts                  # ports, container name, test creds
│   ├── auth.ts                 # login(page) — FE form login
│   ├── db.ts                   # psql via docker exec for DB assertions
│   └── canvas.ts               # React Flow drag/click tricks (raw mouse + dispatchEvent)
├── tests/
│   └── flow-editor.spec.ts     # items 1–10 from the original verify plan
└── scripts/
    ├── setup-stack.sh          # PG + BE + FE + patch + register user + seed model
    ├── teardown-stack.sh       # reverse: revert patch, stop processes, drop container
    └── seed-model.sh           # called by setup; bypasses encryption with dummy key
```

## Prerequisites

- Docker running.
- BE repo at the path in `helpers/env.ts` (override with `E2E_BE_REPO`),
  on a branch including migration `0024` (`master` post-2026-05-28).
- Python + `uv` installed (BE runs via `uv run uvicorn`).
- Node + npm.

## Run

```bash
cd e2e
npm install                  # one-time
npx playwright install chromium   # one-time, ~100 MB
npm run setup                # spin PG + BE + FE; apply patch; register user + seed model
npm test                     # run the suite
npm run teardown             # revert patch + stop everything
```

For a development iteration loop:

```bash
npm run test:headed   # see the browser
npm run test:ui       # Playwright's interactive UI mode
npm run report        # open the last HTML report
```

## Why the auth-strategy patch

The FE's `ServiceProvider` hard-codes `Auth0Repository`, which POSTs to
`oauth/token` on an Auth0 tenant. Tests need to log in against our
local BE (`AUTH_STRATEGY=local`), so `setup-stack.sh` applies a small
patch that swaps `ServiceProvider`'s auth wiring to an env-driven
`pickAuthRepo` (chooses `AuthRepository` when `VITE_AUTH_STRATEGY=local`).
`teardown-stack.sh` reverts it.

The patch lives in this dir as a tracked file. **If the auth strategy
switch ever becomes a real product feature, promote the patch's content
to a proper commit in `src/` and delete this file.**

## What the tests cover

The unit + integration suites cover the editor's logic (graphToYaml /
buildEditorGraph round-trip, store, connection rules, NodePanel render,
FlowEditorView shell mount). These browser tests cover the
pointer/visual cases jsdom can't reach:

- **#1** editor mounts with `▶ Start` + `■ End` boundaries
- **#2** four side handles hidden until node hover
- **#3** Add node creates an agent card + opens the side panel
- **#4** side-handle drag (`right` → `left`) creates a connector
- **#5a** self-loop is rejected at draw time
- **#5b** duplicate `source→target` is rejected
- **#6** condition not in source `emits` renders red dashed + tooltip
- **#7** `node_id` collision → inline error + draft reverts
- **#8** YAML "view source" dialog shows the collapse invariant
- **#9** Save round-trip creates flow + flow-owned agents in the DB
- **#10** Resave after deleting a node prunes its `user_agent` row

## Non-obvious Playwright tricks (already encoded in `helpers/canvas.ts`)

These cost real time to rediscover, so capture them:

| Symptom | Fix |
|---|---|
| `.hover()` times out on a side handle | The handle is `opacity-0` until parent hover — use raw `page.mouse.move(centerOfNode, …)` then `boundingBox()` on the handle. `.hover()` would re-trigger actionability on every retry. |
| `.click()` on a cascade-stacked node hits the wrong one | React Flow does its own pointer hit-test — the topmost z-index wins. `force: true` doesn't help. Use `locator.dispatchEvent('click')` to fire the synthetic event directly on the target element. |
| Radix `Select` jsdom infinite-loop | Stub the `Select` module in vitest. In the real browser nothing's wrong. |

## Tests assume

- Stack is up (run `npm run setup` first).
- A test user `verify@example.com` / `VerifyTest123!` exists in the test DB.
- A flow-eligible `claude-sonnet-4-6` user_model is seeded.

The test suite mutates the DB (creates a flow, agents, edges, then
deletes a node + saves again). It uses `test.describe.configure({ mode:
'serial' })` so the order is deterministic, and the first run after
`setup` is the canonical state.

## Tear down

`npm run teardown` reverts the patch in the FE working tree, stops the
BE + FE processes, and removes the Postgres container. The script
fails loud if the FE working tree had uncommitted changes before
setup, to keep patch application clean.

## Limitations / future

- `helpers/db.ts` uses `docker exec psql` — replace with a proper async
  pg client (e.g. `postgres` package) if assertions grow.
- The tests serialize on one DB. To parallelize, give each worker its
  own schema or use Playwright's `globalSetup` to spin a fresh DB per
  worker.
- Stack setup is shelled out (bash). A `globalSetup` in
  `playwright.config.ts` could wrap it for a one-command `npm test`.
- No CI wiring yet — when added, gate on a job that runs `setup-stack`
  + `npm test` + `teardown` in sequence.
