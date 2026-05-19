# Pragna Frontend — Setup Issues & Resolutions

This document records every non-obvious problem encountered during initial project setup and how each was resolved. Future contributors will not need to debug these issues again.

---

## Issue 1: Vite `create-vite` CLI cannot scaffold into a non-empty directory

**Symptom:** Running `npm create vite@latest . -- --template react-ts` in the repo directory (which already contained `.gitignore` and `LICENSE`) produced `Operation cancelled` with no further output.

**Root cause:** `create-vite` v9 prompts interactively when the target directory is not empty. The CLI cannot receive piped stdin input (`echo "y" | npm create …`) and terminates immediately.

**Resolution:** The project was scaffolded manually by writing all config files directly (`package.json`, `tsconfig.json`, `vite.config.ts`, `vitest.config.ts`, `eslint.config.ts`, `index.html`) instead of using the CLI. This approach gives more precise control over dependency versions and eliminates the default boilerplate cleanup step.

---

## Issue 2: `npm install` exits with code 1 and no error message for the full dependency set

**Symptom:** Running `npm install` with all dependencies (including `@copilotkit/react-core` and `@copilotkit/react-ui`) produced:
```
npm error A complete log of this run can be found in: …debug-0.log
```
The debug log contained only `silly packumentCache` and `verbose` lines — no `error` or `ERESOLVE` lines before `verbose exit 1`.

**Root cause investigation:**
1. The npm debug log was 249 lines and exited immediately after resolving `zod-to-json-schema@^3.23.5` with zero error messages between manifests and exit.
2. Splitting the install revealed that all non-CopilotKit packages installed successfully.
3. CopilotKit `^1.8.15` (as specified in the initial `package.json`) **does not exist** — the package versioning starts at `1.x` but the first published version is much higher. `@copilotkit/react-core@1.8.15` returned `ETARGET: No matching version found`.
4. Resolving to the latest stable (`1.57.2`) still failed silently. Inspection of the dependency graph revealed that `@copilotkit/react-core@1.57.2` depends on `zod@>=3.0.0`, which npm resolved to `zod@4.4.3` (zod v4). The `zod@4.4.3` resolution conflicted with existing packages requiring `zod@^3.x`, causing npm's dependency tree computation to abort silently — a known npm 11 edge case where certain resolution failures produce no user-visible error message.

**Resolution:**
1. Pinned CopilotKit to `1.51.4` — the latest stable version that does not pull in `zod@4.x`.
2. Added `.npmrc` with `node-options=--max-old-space-size=4096` as a precaution for future large dependency trees (CopilotKit's resolution is memory-intensive).
3. The `package.json` `@copilotkit/react-core` and `@copilotkit/react-ui` versions were corrected from the non-existent `^1.8.15` to `^1.51.4`.

**What to do if this recurs after a CopilotKit upgrade:**
```bash
npm info @copilotkit/react-core versions --json | python3 -c "import json,sys; v=json.load(sys.stdin); print([x for x in v if 'canary' not in x and 'next' not in x][-5:])"
```
Pick the latest version from the output that does NOT match `^1.5[5-9]` or higher (where the `zod@4.x` dependency was introduced). Install it explicitly:
```bash
npm install @copilotkit/react-core@<version> @copilotkit/react-ui@<version>
```

---

## Issue 3: `jsdom` not found when running Vitest

**Symptom:** Running `npm run test` after initial setup produced:
```
MISSING DEPENDENCY  Cannot find dependency 'jsdom'
Error: Cannot find package 'jsdom' imported from …/vitest/dist/…
```

**Root cause:** Vitest v3's `environment: 'jsdom'` config option requires the `jsdom` package to be installed separately as a dev dependency. It is not bundled with Vitest.

**Resolution:**
```bash
npm install --save-dev jsdom
```
The package is now in `devDependencies` in `package.json`.

---

## Issue 4: SVG logo with XML comments fails to render in jsdom (test environment)

**Symptom:** LoginView tests produced:
```
InvalidCharacterError: "data:image/svg+xml,…" did not match the Name production
```
The SVG logo file (`src/assets/logo.svg`) contains XML comment nodes (`<!-- Outer 12-pointed star -->`). When `vite-plugin-svgr` inlines this as a data URI in jsdom, the comment characters (`<!-- -->`) are percent-encoded into the URI and then parsed back by jsdom's XML parser, which rejects them as invalid node names.

**Root cause:** jsdom does not fully support XML comment nodes inside inline SVG data URIs.

**Resolution:** Mock the SVG import in `src/__tests__/setup.ts`:
```typescript
vi.mock('@/assets/logo.svg?react', () => ({ default: () => null }));
```
This is intentional — the logo renders correctly in real browsers. Only the test environment is affected.

---

## Issue 5: ESLint `no-restricted-syntax` rule for `import.meta.env` fires on `src/constants/api.ts` itself

**Symptom:** After adding the ESLint rule to prevent `import.meta.env` access outside constants, the rule fired inside `src/constants/api.ts` — the file that is explicitly permitted to use it.

**Resolution:** Added `/* eslint-disable no-restricted-syntax */` at the top of `src/constants/api.ts`. This is the correct approach: the rule is intentionally disabled only in the one file that is the designated entry point for env variables. All other files remain protected by the rule.

---

## Notes on CopilotKit Version Compatibility

As of 2026-05-19, CopilotKit `1.51.4` is the highest stable version compatible with this project's dependency graph. Upgrading to `1.52.x` or higher may require:
- Checking if `zod@>=3.0.0` still resolves to `zod@4.x`
- If so, adding `"overrides": { "zod": "^3.x" }` to `package.json` to force zod v3 across the tree
