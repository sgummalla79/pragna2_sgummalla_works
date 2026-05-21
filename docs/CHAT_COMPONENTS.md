# Chat UI Components

Component-by-component reference for the chat surface (`/chat/new`, `/chat/:id`). Each section names a file, what it does, where it's used, and the props it accepts. Cross-reference [UI_DESIGN.md](./UI_DESIGN.md) for colour and spacing tokens.

The chat surface is owned by two top-level views, supported by a hook layer and a small component library:

```
ChatView                                      — layout shell (sidebar + outlet)
├── Sidebar                                   — left rail
│   ├── (brand row)
│   ├── New Chat                              — link to /chat/new
│   ├── ConversationList                      — recent conversations
│   │   └── ConversationListItem  (1 per row)
│   │       └── RenameConversationDialog (modal)
│   └── AvatarMenu                            — user / settings / sign out
└── <Outlet> renders one of:
    ├── ConversationsView                     — /chat (index): usage table
    └── ChatSessionView                       — /chat/new or /chat/:id
        ├── ChatHeader
        ├── (message list, scrolling)
        │   └── ChatMessage  (1 per turn)
        │       └── ToolCallBadge  (when LLM invokes a tool)
        └── ChatInput
            ├── Send button (when idle)
            └── StopButton (when running)
```

The hooks layer (`src/presentation/hooks/conversations/` and `src/presentation/views/chat/hooks/`) handles all data fetching, mutations, and AG-UI lifecycle. Components never call `fetch` directly.

---

## Hooks

### `useConversations(page)`

`src/presentation/hooks/conversations/useConversations.ts`

Read-side: paginated list of the user's conversations. TanStack `useQuery` against `GET /api/conversations`. `staleTime: 0` so the sidebar re-fetches on each mount (catches conversations created in other tabs).

### `useConversation(conversationId)`

`src/presentation/hooks/conversations/useConversation.ts` *(new in R1)*

Resolves a single conversation by id. Backed by the list endpoint (no dedicated `GET /api/conversations/{id}` route on the backend), with `staleTime: 30s` for cheap revisits. Returns `undefined` when the id isn't in the list.

### `useConversationMessages(conversationId)`

`src/presentation/hooks/conversations/useConversationMessages.ts` *(new in R1)*

The persisted message log for a conversation. `staleTime: Infinity` because once a turn is written it never rewrites — only invalidation triggers a refetch. Disabled when `conversationId` is `undefined` (the `/chat/new` route).

### `useConversationMutations.ts`

`src/presentation/hooks/conversations/useConversationMutations.ts` *(new in R1)*

Three mutation hooks:

| Hook | What it does |
|---|---|
| `useRenameConversation()` | Writes a new title via `PATCH /api/conversations/{id}`, invalidates the conversations list. |
| `useSetConversationModel()` | Changes the active model via the same PATCH endpoint. Future R2 home for the model picker. |
| `useDeleteConversation()` | Calls `DELETE /api/conversations/{id}`, invalidates the conversations list. |

Each mutation invalidates `['conversations']` on success — sidebar updates automatically.

### `useChatSession(agentName, options)`

`src/presentation/views/chat/hooks/useChatSession.ts`

The stateful core of the chat. One `HttpAgent` per `(agentName, accessToken, threadId)` triple. Exposes `messages`, `status`, `error`, `send`, `stop`. AG-UI events are mirrored into React state via the agent's subscriber callbacks.

`options.threadId` pins the conversation id so resumed chats keep the same thread. `options.initialMessages` seeds the agent's message list — used to hydrate from persisted history on resume.

---

## Components — Sidebar

### `Sidebar.tsx`

`src/presentation/views/chat/Sidebar.tsx`

The left rail next to the chat surface. Owns its collapse state via `useUiStore.chatPaneCollapsed`. When collapsed, shows only icons; when expanded, shows the "New Chat" button, the `ConversationList`, and the `AvatarMenu`.

**Props:**
- `onNewChat?: () => void` — override the default click handler (which navigates to `/chat/new`). Useful if a future flow wants to clear ephemeral state before navigating.

### `ConversationList.tsx`

`src/presentation/views/chat/components/ConversationList.tsx` *(new in R1)*

The "Recent" section inside the sidebar. Renders one of four states:

- **Loading** — placeholder text.
- **Error** — error-tinted message, suggests refresh.
- **Empty** — "No conversations yet" (first-run state).
- **Populated** — "Recent" header + one `ConversationListItem` per row.

Uses `useConversations(0)` (first page) — pagination beyond page 0 is a future feature; for now the user sees the most recent `DEFAULT_PAGE_SIZE`.

**Props:** none.

### `ConversationListItem.tsx`

`src/presentation/views/chat/components/ConversationListItem.tsx` *(new in R1)*

A single row in the conversation list.

**Visual states:**
- **Idle** — secondary text, transparent background.
- **Hover** — background brightens, rename + delete icons fade in.
- **Active** — brand-tinted background when the URL matches `/chat/{this.id}`, plus `aria-current="page"`.

**Behaviour:**
- Whole row is a `<Link>` to `/chat/{conversation.id}`.
- Pencil icon → opens `RenameConversationDialog`. `preventDefault` + `stopPropagation` keep the row click from firing.
- Trash icon → wrapped in `ConfirmButton` so a misclick can't delete. If the deleted conversation is the currently-open one, the view navigates back to `/chat/new`.

**Props:**
- `conversation: Conversation` — the row to render.

### `RenameConversationDialog.tsx`

`src/presentation/views/chat/components/RenameConversationDialog.tsx` *(new in R1)*

Radix `Dialog`-based modal for renaming a conversation. Submits on Enter or via the Save button. Empty / whitespace-only titles fall back to `"Untitled chat"`. Stays open on save error so the user can retry.

**Props:**
- `conversationId: string` — which conversation to rename.
- `currentTitle: string` — initial value for the input.
- `open: boolean` — parent owns visibility.
- `onOpenChange: (open: boolean) => void` — closed via Cancel, Escape, or successful save.

---

## Components — Chat surface

### `ChatSessionView.tsx`

`src/presentation/views/chat/ChatSessionView.tsx`

Top-level view for the chat surface. Mounted at both `/chat/new` and `/chat/:id` *(new in R1)*. Reads `:id` via `useParams`; when present, fetches the conversation + persisted messages and hydrates `useChatSession` with `initialMessages`.

Renders setup prompts (`CHT_001`, `CHT_002`) when the user has no providers or no chat-available models. Wraps the live chat in `ErrorBoundary` (`CHT_003` fallback) so runtime failures surface as "Chat unavailable" rather than a white page.

Internal sub-component `ChatSurface` only mounts after gating passes — keeps the underlying `HttpAgent` from being instantiated against incomplete state.

### `ChatHeader.tsx`

`src/presentation/views/chat/components/ChatHeader.tsx` *(new in R1)*

Slim header strip at the top of the chat surface. Shows the conversation title (or "New conversation" for `/chat/new`), the agent name, and the app name on the far right.

Future home for the agent picker (R2) and model picker — both surfaces will replace the static text spans with select controls.

**Props:**
- `conversation?: Conversation` — when present, header shows the title; absent → "New conversation".
- `agentName: string` — the active agent's name (currently always `'default'`).

### `ChatMessage.tsx`

`src/presentation/views/chat/components/ChatMessage.tsx`

One message bubble. Renders user turns right-aligned in brand colour; assistant turns left-aligned on a dark card. Suppresses `tool` and `system` turns (tool calls surface inside the assistant bubble via `ToolCallBadge`).

**Props:**
- `message: ChatMessage` — the message data.

### `ToolCallBadge.tsx`

`src/presentation/views/chat/components/ToolCallBadge.tsx`

Inline rendering of a tool call. Shows the tool name, the partial JSON arguments as they stream in, and the result once the matching `ToolCallResultEvent` arrives.

**Props:**
- `call: ChatToolCall` — the tool call to render.

### `ChatInput.tsx`

`src/presentation/views/chat/components/ChatInput.tsx`

The composer at the bottom. `Textarea` + send button by default; when `disabled` is true and `onStop` is provided, the send button is replaced by `StopButton`. Enter submits; Shift+Enter inserts a newline.

**Props:**
- `onSend: (text: string) => void` — user-pressed Enter or clicked Send.
- `onStop?: () => void` — user clicked Stop (only when `disabled`).
- `disabled?: boolean` — turn off input while a run is in flight.
- `placeholder?: string` — passed through to the Textarea.

### `StopButton.tsx`

`src/presentation/views/chat/components/StopButton.tsx` *(new in R1)*

The Stop variant of the send button. Renders the lucide `Square` icon plus "Stop" label. Only mounted by `ChatInput` while the parent's status is `running`.

**Props:**
- `onStop: () => void` — wired to `ChatSessionApi.stop` (which calls `HttpAgent.abortRun()`).

---

## Where new product features land

| Feature | Component to touch | Hook to add |
|---|---|---|
| Agent picker (R2) | `ChatHeader` — replace the static `agentName` span with a `<Select>` | `useAgents` (already built) |
| Model picker (R1 backend, frontend later) | `ChatHeader` — add a model select next to the agent picker | `useUserModels` (already built) + `useSetConversationModel` (new in R1) |
| Slash-command autocomplete (R4) | `ChatInput` — listen for `/` in the textarea and pop a dropdown | `useSkills` (already built) |
| Regenerate / edit / branch (R4) | `ChatMessage` — add an action menu on hover | New mutation hooks against new backend routes |
| Cost-per-conversation badge (R4) | `ConversationListItem` — render `useConversationUsage(id).data?.totalCostUsd` | `useConversationUsage` (already built) |
| Light-theme palette (R4) | Global CSS only | n/a |

---

## Anti-patterns to avoid

- **Calling `fetch` directly inside a component.** Use TanStack Query (one of the hooks above). The data-flow story is "component → hook → service → repository → HTTP."
- **Inline-editing the conversation title in the sidebar.** Use `RenameConversationDialog`. Inline edit is polish that we'll add when there's a clear user signal.
- **Skipping `aria-label` on icon-only buttons.** Every `<button>` with only an icon child needs an `aria-label` so screen readers and tests can find it.
- **Hard-coding hex colours.** Use the tokens listed in [UI_DESIGN.md](./UI_DESIGN.md). If a colour you need isn't there, the design is drifting — flag it.
- **Forgetting loading + empty + error states.** Every data-driven component listed above renders all three explicitly. Don't skip the empty state — first-time users will see it.
- **Re-creating the `HttpAgent` on every render.** `useChatSession` already handles this via `useMemo` with a tight dep set. Don't bypass it; if you need a new agent, change `agentName` or `threadId`.
