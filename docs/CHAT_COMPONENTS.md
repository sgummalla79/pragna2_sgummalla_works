# Chat UI Components

Component-by-component reference for the chat surface (`/chat`, `/chat/:id`, `/chat/history`). Each section names a file, what it does, where it's used, and the props it accepts. Cross-reference [UI_DESIGN.md](./UI_DESIGN.md) for colour and spacing tokens.

The chat surface is owned by three top-level views, supported by a hook layer and a small component library:

```
ChatView                                      — layout shell (sidebar + outlet)
├── Sidebar                                   — left rail
│   ├── (brand row)
│   ├── New Chat                              — link to /chat (the landing)
│   ├── ConversationList                      — recent conversations
│   │   └── ConversationListItem  (1 per row)
│   │       └── RenameConversationDialog (modal)
│   └── AvatarMenu                            — History / Settings / theme / sign out
└── <Outlet> renders one of:
    ├── ChatLandingView                       — /chat (index): greeting + composer
    ├── ConversationsView                     — /chat/history: usage table
    └── ChatSessionView                       — /chat/:id
        ├── ChatHeader
        ├── (message list, scrolling)
        │   └── ChatMessage  (1 per turn)
        │       └── ToolCallBadge  (when LLM invokes a tool)
        └── ChatInput
            ├── Send button (when idle)
            └── StopButton (when running)
```

**Route map**

| Path | View | Notes |
|---|---|---|
| `/chat` | `ChatLandingView` | Greeting + centred composer. No conversation row created until the user sends. |
| `/chat/:id` | `ChatSessionView` | Live chat. Hydrates from persisted history on mount; consumes the landing handoff (if any). |
| `/chat/history` | `ConversationsView` | Past conversations + per-conversation cost breakdown. |
| `/chat/new` | redirects to `/chat` | Legacy; kept so stale bookmarks land somewhere useful. |

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

**Wedge A.2 slash routing.** `send` inspects the trimmed message text against the user's enabled-skills list (via `useSkills()`). If the text starts with `/{api_name}` and that name matches a skill, the agent's URL is mutated for that single run to `${PRAGNA_BASE_URL}/skills/{api_name}` (the deterministic slash endpoint on the backend). The persisted user message keeps the slash text intact so the chat history shows what was invoked. The URL is restored in `onRunFinalized` via the same `overrideUrlRef` pattern `sendWithModel` uses. Unknown slash names fall through to the default agent (so `/foo` becomes natural-language input the LLM may interpret freely — matches Claude's behaviour).

### `useGreeting()`

`src/presentation/views/chat/hooks/useGreeting.ts`

Time-of-day phrase + the user's first name, memoised against the auth user's display name and email so the value is stable across renders. Returns `{ text, phrase, firstName }`:

| Local time | `phrase` |
|---|---|
| 05:00 – 11:59 | "Good morning" |
| 12:00 – 16:59 | "Good afternoon" |
| 17:00 – 20:59 | "Good evening" |
| 21:00 – 04:59 | "Hello" |

`firstName` falls back to the local part of the user's email if `user.name` is empty. Used exclusively by `ChatLandingView`.

### `initialMessageHandoff` utility

`src/presentation/views/chat/hooks/initialMessageHandoff.ts`

A `sessionStorage`-backed one-shot transit for the user's first message between `ChatLandingView` and `ChatSessionView`. Two exports:

- `INITIAL_MESSAGE_STORAGE_KEY(conversationId)` — namespaced key (`pragna:initial-message:{id}`). Used by the landing to write the seed before navigating.
- `consumePendingInitialMessage(conversationId)` — read **and immediately remove** in one call. Returns `null` when no handoff is in flight (the common case for resumed conversations) or when `sessionStorage` is unavailable. Removal-on-read is what makes refresh safe — a reload of `/chat/{id}` re-mounts but finds nothing, so the persisted history renders instead of replaying the message.

`sessionStorage` was chosen over React Router state because it's automatically scoped to the tab (a duplicated tab won't see the seed) and because it survives an immediate redirect without the location-state quirks of `replace: true`.

---

## Components — Sidebar

### `Sidebar.tsx`

`src/presentation/views/chat/Sidebar.tsx`

The left rail next to the chat surface. Owns its collapse state via `useUiStore.chatPaneCollapsed`. When collapsed, shows only icons; when expanded, shows the "New Chat" button, the `ConversationList`, and the `AvatarMenu`.

**Props:**
- `onNewChat?: () => void` — override the default click handler (which navigates to `/chat`, the landing surface where a fresh thread begins). Useful if a future flow wants to clear ephemeral state before navigating.

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
- Trash icon → wrapped in `ConfirmButton` so a misclick can't delete. If the deleted conversation is the currently-open one, the view navigates back to `/chat` (the landing).

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

Slim header strip at the top of the chat surface. Shows the conversation title (or "New conversation" while the row is still pending) and hosts the `AgentPicker`. The app name sits on the far right as a quiet brand mark.

**Props:**
- `conversation: Conversation | null | undefined` — when present, header shows the title; nullish → "New conversation".
- `agentName: string` — the active agent's name. Resolved by `ChatSessionView` via a three-step fallback (handoff → flow lookup → `default`).

### `AgentPicker.tsx`

`src/presentation/views/chat/components/AgentPicker.tsx` *(new in R2)*

Per-conversation agent picker — a Radix dropdown listing every agent the user can run (`useAgents()`). The currently active agent is checked. Selecting an agent **always** navigates to `/chat?agent={name}` to start a fresh conversation under that agent, even when re-selecting the active value — this mirrors the backend's resume-mismatch guard (`pragna_run_agent` returns 400 if an existing conversation's `flow_id` doesn't match the requested agent).

When only the `default` agent is available (no flows authored), the picker collapses to inert text since there's nothing to pick.

**Props:**
- `value: string` — the active agent name. Used to label the trigger and check the active menu item.

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
| ~~Agent picker (R2)~~ | ✅ Shipped — `AgentPicker` lives in `ChatHeader`; selecting an agent navigates to `/chat?agent={name}` for a fresh conversation | `useAgents` |
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
