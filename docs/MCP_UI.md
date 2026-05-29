# MCP UI (Wedge B.2)

FE for the MCP server registration + per-tool toggle flow shipped on the
BE in Wedge B. Sits under `/settings/mcp-servers`. The tool picker in
the agent editor was also upgraded to surface MCP tools alongside
built-ins.

## Architecture

Mirrors the `/settings/providers` page shape one-for-one:

| Layer | File |
|---|---|
| Domain types | [src/domain/types/mcp.types.ts](../src/domain/types/mcp.types.ts) + [src/domain/types/tool.types.ts](../src/domain/types/tool.types.ts) |
| Ports | [src/application/ports/IMcpServerRepository.ts](../src/application/ports/IMcpServerRepository.ts) + [IToolRepository.ts](../src/application/ports/IToolRepository.ts) |
| Repositories (axios) | [src/infrastructure/repositories/McpServerRepository.ts](../src/infrastructure/repositories/McpServerRepository.ts) + [ToolRepository.ts](../src/infrastructure/repositories/ToolRepository.ts) |
| Mappers (snake_case ↔ camelCase) | [src/infrastructure/repositories/mappers/mapMcpServer.ts](../src/infrastructure/repositories/mappers/mapMcpServer.ts) + [mapTool.ts](../src/infrastructure/repositories/mappers/mapTool.ts) |
| Services (facade) | [src/application/services/McpServerService.ts](../src/application/services/McpServerService.ts) + [ToolService.ts](../src/application/services/ToolService.ts) |
| TanStack Query hooks | [src/presentation/hooks/mcp-servers/useMcpServers.ts](../src/presentation/hooks/mcp-servers/useMcpServers.ts) + [tools/useTools.ts](../src/presentation/hooks/tools/useTools.ts) |
| Page | [src/presentation/views/settings/McpServersView/McpServersView.tsx](../src/presentation/views/settings/McpServersView/McpServersView.tsx) |
| Card | [McpServerCard.tsx](../src/presentation/views/settings/McpServersView/McpServerCard.tsx) |
| Registration form | [RegisterMcpServerForm.tsx](../src/presentation/views/settings/McpServersView/RegisterMcpServerForm.tsx) |
| Tool picker | [src/presentation/components/settings/ToolPicker/ToolPicker.tsx](../src/presentation/components/settings/ToolPicker/ToolPicker.tsx) |

## Page UX

`McpServersView` (route `/settings/mcp-servers`):

- **Empty state** — no servers registered. CTA opens the registration modal.
- **Populated state** — vertical list of `McpServerCard`s, one per active server. Top-right "Register server" button always available.
- **Post-register banner** — green confirmation banner with the discovered tool count and a "expand the card to opt them in" nudge.

`McpServerCard`:

- **Collapsed header** (always visible): display_name + transport badge (`http` / `stdio`) + disabled chip (when applicable) + `enabled / total tools enabled` count + expand chevron. Clickable to expand.
- **Expanded body** (when clicked): action row (Refresh tools button + Server enabled checkbox + Archive… button) + per-tool toggle list with description text.

`RegisterMcpServerForm` (in modal):

- `display_name` text input, `transport` radio (locked to `http` in v1 — stdio is Wedge B.3 once the allowlist endpoint exists), `config.url`, optional headers (key-value editor).
- Submit → `useRegisterMcpServer.mutateAsync()` → BE runs discovery → 502 on upstream failure surfaces as inline error.
- Unsaved-changes guard (future-discussions #7): once any field is touched (trimmed non-empty display_name / URL / header), Escape key + overlay click are blocked and the browser's `beforeunload` prompt arms for tab close / refresh. Labelled close affordances (X button, Cancel button, successful registration) bypass the guard. Form notifies its parent via `onDirtyChange` so the parent modal's `useDirtyDialog` hook does the actual hardening.

## Hooks

```
useMcpServers()             → GET /api/user-mcp-servers
useRegisterMcpServer()      → POST /api/user-mcp-servers
useUpdateMcpServer()        → PATCH /api/user-mcp-servers/{id}
useArchiveMcpServer()       → DELETE /api/user-mcp-servers/{id}
useRefreshMcpServerTools()  → POST /api/user-mcp-servers/{id}/refresh-tools

useTools()                  → GET /api/tools
useToggleTool()             → PATCH /api/tools/{id}
```

Cache keys: `MCP_SERVERS_KEY = ['mcp-servers']` and `TOOLS_KEY = ['tools']`. Every server mutation invalidates BOTH keys because tool inventory + per-server counts both change. Same for `useToggleTool` — flipping a tool's enabled flag changes the per-server `enabled` count surfaced on `useMcpServers().data[i].tools.enabled`.

## ToolPicker — hybrid autocomplete

`ToolPicker` is a drop-in replacement for `ChipInput` used in `AgentEditorView`'s Tools field.

- **Suggestions** filtered against `Tool.apiName` AND `Tool.displayName` (case-insensitive `startsWith`). ↑↓ keyboard navigation, Enter to accept the highlighted suggestion.
- **Freeform commit** — Enter or comma commits whatever's in the input as a chip, even if no suggestion matched. Lets authors:
  - Pre-author tools for an MCP server they haven't registered yet (the chip becomes valid once the server lands).
  - Keep existing flows working when an MCP server is archived later (existing chips stay; render with the ⚠️ unknown badge).
- **Unknown badge** — chips for api_names not in `useTools().data` render with a `lucide-react` `AlertTriangle` icon + a `title="No matching tool found"` hover hint. They're still editable; the resolver decides at runtime whether to actually bind them.
- **Already-selected filter** — suggestions exclude tools already in the chip list.

## Tests

22 new tests under `src/__tests__/`:

- Repository (msw-backed): 9 — request shape + response mapping for both repos.
- Hooks (renderHook + QueryClient): 7 — service calls + cache invalidations.
- ToolPicker: 8 — autocomplete + freeform + unknown badge.
- McpServerCard: 6 — collapsed/expanded, per-tool toggle, archive confirm, refresh diff.
- McpServersView: 4 — empty state, populated state, register modal flow, success banner.

Total FE suite after this PR: 156 passing.

## What's out of scope (see [pranga2-api/docs/future-discussions.md](../../pranga2-api/docs/future-discussions.md))

- **Stdio support** — needs a `GET /api/mcp-stdio-packages` BE endpoint first (the allowlist ships empty). Wedge B.3.
- **Cross-server tool catalog browser** — find-by-name across all servers. Premature without real demand.
- **Operator allowlist UI** — operators INSERT into `mcp_stdio_packages` directly today.
