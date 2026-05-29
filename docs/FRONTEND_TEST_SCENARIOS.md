# Frontend Test Scenarios

A manual test script for the chat feature, written for someone seeing
the app for the first time. No coding, no developer tools, no command
line — just clicks and reads.

> **Untestable agentic-flow patterns:** the BE parking lot at `pragna2-api/docs/future-discussions.md` entries #28–#32 catalogues the patterns that aren't currently testable (Orchestrator → Subagent, Multi-Agent Debate, Tree of Thought, Event-Driven triggers, cross-conversation memory) — each entry records the missing primitive, the closest workaround today, and the prerequisites for shipping a real scenario. When one of those ships, write a new scenario here and close the corresponding entry.

Each scenario walks through one user-visible behaviour from start to
finish. Pick any scenario, follow the steps in order, and tick off the
checks at the bottom. If a check fails, the scenario fails — note what
you saw and report it.

---

## Before you start — first-time setup (do this ONCE)

Skip this section if you've already used the app once and have it set
up. Otherwise do every step below in order — every scenario below
assumes this setup is complete.

### A. Open the app

1. Open Chrome (or any modern browser).
2. Go to the app's web address. If you're testing locally, that's
   usually `http://localhost:5173`. Otherwise use the address your
   team gave you.
3. You should see a **Sign in** page or, if you have no account yet, a
   **Sign up** link.

### B. Create an account (if you don't have one)

1. Click the **Sign up** link on the sign-in page.
2. Fill in your email, a password, and a display name.
3. Click **Sign up**.
4. You're now signed in. You should see the chat screen (an empty
   middle panel with a text box at the bottom and a sidebar on the
   left).

### C. Sign in (if you already have an account)

1. On the sign-in page, type your email and password.
2. Click **Sign in**.
3. You should see the chat screen.

### D. Connect an AI provider (so the chat has a brain to talk to)

The app doesn't ship with its own AI — you bring your own API key. If
you don't have one, get a free Anthropic or OpenAI account first and
generate an API key from their dashboard.

1. Click the **gear icon** in the bottom-left of the sidebar
   (Settings).
2. In the settings sidebar, click **Providers** (under "AI Setup").
3. Click the tile for **Anthropic** (or OpenAI / Gemini / whichever you
   have a key for).
4. A panel slides in. Paste your API key into the **API key** field.
5. Click **Connect**.
6. After a few seconds you should see a list of models appear (e.g.
   `claude-sonnet-4-5`, `claude-opus-4-7`, etc.).

### E. Enable at least one model for chat

1. Still on the **Providers** page, find the model you want to use.
2. Click the **toggle** next to its name to enable it.
3. Click the **chat** checkbox (sometimes labelled "Available for chat")
   so it can be used by the default agent.
4. The model is now usable.

### F. Go back to chat

1. Click the **app logo** in the top-left (or click any conversation in
   the sidebar) to leave settings and return to chat.

You're ready to run any of the scenarios below.

---

## How to read each scenario

Every scenario uses the same shape:

- **Goal** — one sentence describing what we're checking.
- **Arrange** — things to set up before you start the test (sometimes
  empty if the first-time setup is enough).
- **Act** — the exact clicks and typing. Do these in order.
- **Assert** — checkboxes for what you should see. Tick each one. If
  any check fails, the scenario fails.
- **If something looks off** — common gotchas for that scenario.

---

## Reference — Building a flow in the visual editor

Scenarios 3 onwards have an **Arrange** step that builds a flow. The
editor was redesigned 2026-05-28; the doc points back here for the
authoring mechanics so each scenario can just say "build this topology"
instead of repeating the same clicks. The editor lives at the
top-level URL **`/flows/new`** (new flow) or **`/flows/{flowId}/edit`**
(existing). From Settings → Flows, click **+ New flow** or the edit
icon on a flow card; the editor opens as a full-screen view (a
**Draft** chip sits next to the title; the back arrow returns to the
flows list).

**Agents are flow-owned.** There's no standalone Agents settings page
anymore — every agent is authored inline within its flow and never
shared across flows. The node id IS the agent's api_name. If a
scenario below says "the `research-agent` agent" it means a flow node
whose **Node id** is `research-agent`.

### Top meta row (above the canvas)

Four inputs + one checkbox at the top of the editor:
- **Display name** — the human label shown in proposal cards and the
  Flows list.
- **api-name** — kebab-case identifier (also used in slash dispatch
  collision detection).
- **Description** — short sentence. The default chat agent reads this
  to decide when to propose your flow; be specific.
- **Expose as /slash** checkbox + slash-name input — when checked, the
  flow is reachable at `POST /pragna/flows/{slash-name}` AND auto-bound
  as a tool on the default chat agent. The starter template ticks the
  checkbox by default.

### The "NODES" palette (left side)

Three click-to-add entries. Each drops a node at a cascading default
position; you can then drag it anywhere.

- **Agent** (sky-blue tile, robot icon) — content producer. 1 inbound,
  1 outbound. 4 omni-handles (top / right / bottom / left), Loose
  mode lets connectors leave from any side — useful for back-edges
  that route through node sides instead of arcing.
- **If/Else** (amber tile, branching icon) — LLM-driven router. 1
  inbound target on the left, **N+1 outbound source ports** on the
  right: one per declared emit label + a permanent `else` port. The
  LLM picks a branch by calling the auto-bound `set_route` tool;
  unmatched outcomes fire the `else` port.
- **End** (rose tile, stop icon) — terminator. A flow may have
  **multiple End sinks** (drop the End palette entry again to add
  another). All End instances serialize to `to: __end__` in YAML;
  positions persist via `metadata.end_routing`.

**Start** is auto-placed on every new flow (singleton — exactly one
inbound entry per LangGraph contract; can't be deleted, only moved).
Single right-side source handle (id `out`).

### Configuring a node (the NodePanel)

Click any node on the canvas. A panel slides in from the right
("Node & agent") with these fields:

- **Node id** — must be unique within the flow. Becomes the agent's
  `api_name` automatically (the editor enforces `agent.api_name ===
  node_id`).
- **Display name** — what shows on the card's second line; also the
  human label in proposal cards.
- **Description** (optional) — usually left blank.
- **Model** — dropdown of models you marked "Available for flows".
  If empty, see Part 1 of any scenario for how to enable a model.
- **System prompt** — the steering prompt prepended to every turn.
- **Emit labels** (chip input) — **the lever that turns an Agent into
  an If/Else**. Type a label, press Enter to add a chip. As soon as
  there's one chip, the node's card re-renders as an If/Else with
  N+1 right-side ports. Removing all chips collapses it back to a
  plain Agent.
- **Tools** (optional chip input) — `ask_user` for HITL forms,
  registered MCP tools, slash-exposed flow names.
- **Context slots (advanced)** — collapsible section for #26 per-node
  slot wiring; ignore unless a scenario calls it out.
- **Delete node** — bottom of the panel (boundary nodes can't be
  deleted via this button).

### Wiring edges

- **Chat agents (no emits) → next node:** drag from one of the 4
  small handle dots on a card's edge to any handle dot on the target.
  The hand-drawn side persists across reload via `metadata.edge_handles`.
- **If/Else → next nodes:** drag from a specific **right-side port**
  (`port:passed`, `port:failed`, ..., `port:else`) to the target's
  inbound. The edge's routing **condition is derived from which port
  it leaves** — there is no edge-midpoint dropdown anymore.
- **To an End sink:** drag any source handle to an End node's left
  target handle. To split exits to different End nodes, drop more
  Ends from the palette and wire each path to its own.

### Selected / dirty / save

- A selected node shows a **solid white border** (no dash, no orange
  ring). Selection drives the NodePanel content.
- The **Save** button is disabled until something is dirty (drag,
  add, delete, rename, emits-edit, etc.); it lights up on the first
  change.
- **Validate** (left of Save) runs the same server-side YAML
  validation Save runs — useful for catching mistakes before
  committing. A green "Looks good" banner means Save will succeed.
- **YAML** (left of Validate) opens a **read-only** view of the saved
  YAML. The canvas is the source of truth; YAML is just for
  inspection.

---

## Scenario 1 — Plain chat (no special features)

### Goal
Send a message to the AI and get a reply. The simplest possible test.

### Arrange
Nothing beyond the first-time setup.

### Act

1. In the sidebar on the left, click the **+ New chat** button (at the
   top). A blank chat opens.
2. Click into the text box at the bottom of the screen.
3. Type exactly: `Hello, give me a one-sentence introduction of
   yourself.`
4. Press the **Enter** key (or click the **Send** arrow button on the
   right of the text box).

### Assert

- [ ] Your typed message appears as a **bubble on the right side**
  almost immediately.
- [ ] Just above where the reply will appear, you see a **small
  spinning logo** and the text **"Drafting response..."** (this is the
  "thinking strip").
- [ ] Within a few seconds, an AI reply starts streaming in word by
  word as a **bubble on the left side**.
- [ ] When the reply finishes, the spinning logo + "Drafting
  response..." text **disappears**.
- [ ] The reply is one sentence (roughly — the AI may go slightly
  over) and reads like a normal self-introduction.
- [ ] The **Send arrow** at the bottom turns back into a Send arrow
  (during streaming it became a **Stop** button).

### If something looks off

- **Nothing happens after Enter.** Check that you connected a provider
  and enabled at least one model (Setup steps D + E). The text box
  area usually shows the model name — if it says "No model selected"
  or similar, click it and pick the one you enabled.
- **Error message in red appears.** Read what it says. If it mentions
  "401" or "API key", your key was rejected — re-paste it on the
  Providers page.
- **Spinning logo never disappears.** The AI may have stalled. Click
  the **Stop** button (where Send used to be), then try again.

---

## Scenario 2 — Chat that opens a form (the "ask user" tool)

### Goal
Prove that the AI can pause the chat and pop up a form asking for
specific information, then continue once you submit it.

### Arrange
Nothing beyond the first-time setup. The form feature is built in to
every chat by default.

### Act

1. Open a fresh chat by clicking **+ New chat** in the sidebar.
2. Click the text box at the bottom.
3. Type the following message exactly — the wording matters because
   we're nudging the AI to use the form:

   ```
   I want to book a meeting room. Please use ask_user to collect the
   room name, the meeting date, and how many people will attend, then
   confirm the details back to me.
   ```

4. Press **Enter**.

### Assert

- [ ] Your message appears on the right side immediately.
- [ ] The spinning logo + "Drafting response..." text appears briefly.
- [ ] Within a few seconds, a **form pops up** above the text box.
  It should contain at least three input fields — one for room name,
  one for date, one for number of people.
- [ ] The "Drafting response..." text **disappears** while the form is
  showing (the form replaces it as the "what's happening now"
  indicator).
- [ ] There's a **Submit** button at the bottom of the form (the label
  may differ slightly — "Submit", "Send", or "Continue").
- [ ] Fill in the three fields with any reasonable values (e.g. "Oak
  Room", "Tomorrow", "5"). Click **Submit**.
- [ ] The form **disappears**.
- [ ] The spinning logo + "Drafting response..." reappears for a beat.
- [ ] An AI reply streams in that **mentions the values you typed**
  back to you (e.g. "Got it — I've noted Oak Room, tomorrow, 5
  attendees.").

### If something looks off

- **No form appears, the AI just answers in text.** The AI didn't
  decide to call the form tool. This isn't a hard failure — the AI
  has discretion. Try once more, or rephrase to be more explicit:
  "You MUST call ask_user before answering."
- **Form appears but Submit button is greyed out.** A required field
  is empty. Fill in every field with a value.
- **Form pops up, you click Cancel.** A confirmation dialog should
  appear ("Are you sure?"). Click confirm — the chat should add a
  small message saying you cancelled, and the spinning logo should
  disappear.

---

## Scenario 3 — Run a slash command (slash-exposed flow)

### Goal
Build a flow from scratch, expose it as `/research`, and prove that
typing `/research <question>` in the chat dispatches that flow
directly (not the normal default chat path).

> Note: the legacy "Skills" page was retired. Slash exposure is now a
> property of a Flow declared inline in the flow's YAML
> (`slash_api_name:` + `exposed_as_slash: true`). So you will build,
> in order: **1) enable a model for flows → 2) create an agent → 3)
> create a flow with slash exposure pre-filled → 4) test it.** Do
> every part below — none are optional. Every field value is spelled
> out exactly; type them literally.
>
> **2026-05-27 — A+D:** the flow YAML now declares its slash
> exposure inline. The starter template the editor opens with
> pre-fills `exposed_as_slash: true` + `slash_api_name` matching the
> `api_name` — a fresh flow is slash-invocable the moment it saves.
> The separate "Expose as /slash command" toggle on the flow card
> still works (and is the right way to opt OUT or rename), but you
> no longer need to remember to toggle it after every Save.

### Arrange (one-time setup for this scenario)

#### Part 1 — Enable a model for Flows

(The first-time setup only enabled your model for chat. Flows use a
separate "Available for flows" flag.)

1. Click the **gear icon** in the bottom-left (Settings).
2. Click **Providers** in the settings sidebar (under "AI Setup").
3. Click the tile for the provider you connected earlier (e.g.
   Anthropic).
4. In the model list, find the model you enabled in first-time setup
   (e.g. `claude-sonnet-4-5`).
5. Tick the **"Available for flows"** checkbox next to that model
   (in addition to the "Available for chat" checkbox you already
   ticked). The model now has BOTH checkboxes ticked.

#### Part 2 — Build the flow in the visual editor

(Agents are flow-owned now — there's no separate "Create the agent"
step. The agent is authored inline as a node within this flow.)

1. In the settings sidebar, click **Flows** (under "Workflows").
2. Click the **+ New flow** button (top-right). The full-page editor
   opens (URL: `/flows/new`). A **Draft** chip sits next to the
   title; the left "NODES" palette is visible with Agent / If/Else /
   End entries. Start is already on the canvas at the left; End is
   on the right.
3. **Fill the top meta row** (above the canvas):
   - **Display name:** `Research Flow`
   - **api-name:** `research-flow`
   - **Description:** `Quick research answers on any topic.`
   - Confirm the **Expose as /slash** checkbox is ticked.
   - **Slash-name:** `research`
4. **Add the Agent node.** Click the **Agent** entry in the left
   palette. A sky-blue Agent card appears on the canvas; its
   NodePanel opens automatically on the right.
5. In the NodePanel, fill in:
   - **Node id:** `research-agent` (the editor enforces a unique
     id; this becomes the agent's api_name automatically).
   - **Display name:** `Research Agent`
   - **Model:** pick the model you just enabled for Flows in Part 1
     (e.g. `claude-sonnet-4-5`). If the dropdown says "No models are
     enabled for Flows", go back to Part 1.
   - **System prompt** (paste this exactly):
     ```
     You are a careful researcher. Answer the user's question in 3 to 5 sentences using plain English. If the question is unclear, make a reasonable assumption and state it.
     ```
   - Leave **Emit labels** empty (this stays a content-producing
     Agent, not an If/Else).
   - Leave **Tools** empty.
6. **Wire the edges.** You need two: `Start → research-agent` and
   `research-agent → End`.
   - Hover the Start node (left side) to see its right-edge handle
     dot. Drag from that dot to one of the four edge dots on the
     `research-agent` card.
   - Hover the `research-agent` card and drag from any of its edge
     dots to the End node's left-edge handle dot.
7. Click the **Validate** button (top-right). A green banner should
   say **"Looks good — ready to save."** Red errors usually mean a
   missing model selection or a missing required meta field.
8. Click the **Save** button. The banner should change to
   **"Created 'Research Flow'."** The Draft chip stays (Publish
   semantics aren't wired on this branch).

(For sanity-checking, click the **YAML** button — a read-only dialog
opens showing the saved YAML, which should match the topology you
just built. Close the dialog with the X to keep editing.)

#### Part 4 — Verify slash exposure landed

1. Click the **back arrow** (top-left, next to "Edit flow") to
   return to the Flows list.
2. You should now see a card titled **"Research Flow"** with
   `research-flow` underneath.
3. **A `/research` badge should be visible at the top of the row**
   — that's the YAML's `slash_api_name: research` taking effect.
   If the badge is missing, the YAML save dropped one of the slash
   lines; re-open the flow, confirm both `slash_api_name:` and
   `exposed_as_slash: true` are present, and re-save.

   (You can also use the "Expose as /slash command" row at the
   bottom of the card to opt OUT or rename. We don't need that
   here — the YAML already set it up.)

#### Part 5 — Return to chat and refresh

1. Click the **app logo** in the top-left to leave Settings and
   return to the chat screen.
2. **Hard-refresh the page** (Cmd+Shift+R on Mac, Ctrl+Shift+R on
   Windows). This is important — the chat caches the list of
   slash-exposed flows, and a freshly-exposed slash may not show up
   until the cache is refreshed. Without this refresh the test can
   silently fall back to the LLM-driven path (see gotchas below).

### Act

1. Click **+ New chat** in the sidebar.
2. Click the text box at the bottom.
3. Type the `/` character. A popover should appear above the
   composer listing available slash commands — you should see
   **/research** in that list. **If `/research` is NOT in the
   popover, STOP** — see gotchas below before continuing. Sending
   anyway will not exercise this scenario.
4. Click the **/research** entry (or press Enter while it's
   highlighted). The text box should now contain `/research ` (with
   a trailing space).
5. Continue typing after the slash: `what is retrieval-augmented
   generation?`
6. The full text in the box should now read:
   `/research what is retrieval-augmented generation?`
7. Press **Enter**.

### Assert

- [ ] Your message appears as a bubble on the right side, **and the
  bubble text includes the literal `/research` prefix** (the slash
  is not stripped or hidden).
- [ ] The spinning logo appears with a label that mentions your
  agent — it should say **"Research Agent..."** (because the agent's
  display name is "Research Agent"), NOT the generic "Drafting
  response...". If it says "Drafting response...", the slash didn't
  route — see the gotchas below.
- [ ] **No tool-call card appears in the chat.** Specifically, you
  should NOT see a card labelled `tool` with `research` and a JSON
  blob like `{"topic":"..."}`. If you see that, the run went through
  the wrong path — see the "tool-call card appears" gotcha below.
- [ ] Within a few seconds, an AI reply streams in as a bubble on
  the left side, answering the question about retrieval-augmented
  generation.
- [ ] The reply is roughly 3–5 sentences (per the agent's system
  prompt).
- [ ] When streaming finishes, the spinning logo + label
  **disappears**.
- [ ] The **Stop** button (where Send was during streaming) turns
  back into a **Send** arrow.

### If something looks off

- **`/research` doesn't appear in the slash popover when you type
  `/`.** Go back to Settings → Flows. Confirm: (a) the "Expose as
  /slash command" checkbox is still ticked, (b) the slash name
  reads exactly `research`, (c) the `/research` badge is visible on
  the card. If any are missing, the Save in Part 4 didn't go
  through — try again.
- **You get a red error message mentioning "404" and "/research".**
  Same root cause as above — the exposure wasn't saved.
- **Red error message mentioning "no model" or "user model not
  found".** Go back to Part 1 — your model isn't enabled for flows.
- **Spinning logo says "Drafting response..." (the default), not
  "Research Agent...".** The slash didn't route. Make sure you
  picked `/research` from the popover (or typed `/research ` with a
  trailing space before the question). A message like `Research
  what is RAG?` (no leading slash) goes to the default chat path.
- **A tool-call card appears in the chat showing `tool` /
  `research` / `{"topic":"..."}`.** This means the chat used the
  LLM-driven path instead of the deterministic slash path. The
  LLM saw your `/research` text and decided to call the
  slash-exposed flow as a tool — which is technically valid
  backend behavior but is NOT what Scenario 3 is testing. Root
  cause is almost always **stale slash-popover cache**: you
  exposed `/research` and sent a message before the chat
  refetched the slash list. **Fix:**
  1. Go back to Settings → Flows and confirm the `/research`
     badge is still on the card.
  2. Return to chat and **hard-refresh the page** (Cmd+Shift+R /
     Ctrl+Shift+R).
  3. Open a fresh **+ New chat**, type `/`, and verify
     `/research` now appears in the popover before typing
     anything else.
  4. Pick it from the popover, then continue typing your
     question, then Enter.
  If after a hard refresh the popover still doesn't show
  `/research`, the BE doesn't think it's exposed — report this as
  a bug with a screenshot of the Flow card showing (or not
  showing) the `/research` badge.
- **Reply doesn't quite answer the question but is research-y.**
  That's a pass for THIS scenario — we're testing routing, not
  reply quality.

---

## Scenario 4 — RETIRED (subsumed by Scenarios 2 + 9)

Original scenario tested a slash-exposed flow whose agent had
`ask_user` bound. The same contract is now exercised end-to-end by:

- **Scenario 2** — default chat agent calling `ask_user` (form popup
  + resume).
- **Scenario 9** — a flow with **two** `ask_user` agents in sequence
  (slash dispatch + multi-form HITL + resume across nodes).

Scenario 4 added no behaviour the union of 2 + 9 didn't already
cover, and re-authoring `research-agent` mid-suite produced a fragile
cross-scenario dependency. Skip when running the scenarios.

---

## Scenario 5 — Sequential pipeline (research → summarize)

### Goal
Prove that a flow can chain two agents in sequence — the first
researches a topic, the second condenses the result into one sentence.
You should see TWO assistant bubbles back-to-back, one per node.

### Arrange (one-time setup for this scenario)

Requires Scenario 3 Part 1 (model enabled for flows). You do NOT need
the `research-flow` from Scenario 3 — this scenario builds its own
two-node flow with two inline agents.

#### Build the flow in the visual editor

(See the "Building a flow in the visual editor" reference section
above for the click-by-click mechanics. Repeated here only for the
topology specific to this scenario.)

1. Click **gear icon** → **Flows** → **+ New flow** (`/flows/new`).
2. Set the top meta row:
   - **Display name:** `Research Pipeline`
   - **api-name:** `research-pipeline`
   - **Description:** `Researches a topic, then condenses to one sentence.`
   - Confirm **Expose as /slash** ticked; **Slash-name:**
     `research-pipeline`.
3. **Add the first Agent.** Click the **Agent** palette entry. In
   the NodePanel that opens, set:
   - **Node id:** `pipeline-researcher`
   - **Display name:** `Pipeline Researcher`
   - **Model:** your Available-for-Flows model.
   - **System prompt:**
     ```
     You are a researcher. Write 3 to 5 sentences explaining the user's topic in plain English. Do NOT add a summary or conclusion line — output ONLY the explanation paragraph.
     ```
   - **Context slots (advanced)** — expand the collapsed section.
     Leave **Inputs** empty. In **Outputs**, type `research_notes`
     and press Enter to commit it as a chip. This publishes the
     researcher's reply to the `research_notes` slot for the
     summarizer to read.
4. **Add the second Agent.** Click the **Agent** palette entry
   again — a new card drops. Click it to open its NodePanel:
   - **Node id:** `pipeline-summarizer`
   - **Display name:** `Pipeline Summarizer`
   - **Model:** same as above.
   - **System prompt:**
     ```
     A research passage is provided below. Condense it into EXACTLY ONE sentence (max 25 words) that captures the most important fact. Output ONLY the one-sentence summary — no preface, no list, no quote of the original.
     ```
   - **Context slots (advanced)** — expand. In **Inputs**, type
     `research_notes` and press Enter. The summarizer's prompt now
     sees the researcher's slot content auto-wrapped as a user turn.

   > **Why slots here?** Without slot wiring, the summarizer
   > inherits the full message transcript ending on the researcher's
   > **assistant** turn. Anthropic rejects assistant-prefill on this
   > model and the run fails with a 400. Slot inputs make the
   > summarizer's LLM call always end on a user turn (#26).
5. **Wire the edges.** Three of them, forming a sequential chain:
   - `Start → pipeline-researcher`: drag from Start's right-side
     handle to any handle on `pipeline-researcher`.
   - `pipeline-researcher → pipeline-summarizer`: drag from any
     handle on the researcher card to any handle on the summarizer.
   - `pipeline-summarizer → End`: drag from the summarizer to End's
     left-side handle.
6. Click **Validate** — green "Looks good — ready to save."
7. Click **Save** — banner says "Created 'Research Pipeline'."
8. Click the **back arrow** to return to the Flows list.
9. **Confirm the `/research-pipeline` badge is visible at the top
   of the Research Pipeline card** — the slash settings you ticked
   in the top meta row configured this inline, no separate toggle
   step needed.
10. Click the **app logo** to return to chat.
11. **Hard-refresh** the page (Cmd+Shift+R / Ctrl+Shift+R).

### Act

1. Click **+ New chat** in the sidebar.
2. Click the text box at the bottom.
3. Type `/` — the slash popover should list **/research-pipeline**.
4. Click **/research-pipeline**. The composer reads
   `/research-pipeline ` (with trailing space).
5. Continue typing: `what is photosynthesis?`
6. Full text in the box: `/research-pipeline what is photosynthesis?`
7. Press **Enter**.

### Assert

- [ ] Your message appears as a bubble on the right, **including the
  literal `/research-pipeline` prefix**.
- [ ] The spinning logo + label **"Pipeline Researcher..."** appears.
- [ ] Within a few seconds, an AI reply streams in as a bubble on
  the left — **3 to 5 sentences** about photosynthesis.
- [ ] When that bubble finishes, the spinning logo + label changes
  to **"Pipeline Summarizer..."** (the second node's display name).
- [ ] A SECOND AI bubble appears below the first — **one sentence**
  summary of the same topic.
- [ ] When the second bubble finishes, the spinning logo
  disappears.
- [ ] The Stop button reverts to a Send arrow.

### If something looks off

- **Validation fails with "Pick a model" or "user_model is required"
  for one of the nodes.** Click the node on the canvas, open the
  NodePanel, and select a model from the dropdown. If the dropdown
  is empty, you haven't enabled any model for Flows yet — see
  Scenario 3 Part 1.
- **Save complains the node id is already in use.** Each node id
  must be unique within the flow. Rename one of them in its
  NodePanel.
- **Only ONE assistant bubble appears instead of two.** The
  researcher's reply included a summary line, so the summarizer had
  nothing distinct to add (or it returned an empty reply). Re-read
  the bubbles — if both fit in one bubble that's a routing bug;
  report it. If the bubble content covers BOTH the research and the
  summary, the researcher ignored the "no summary" instruction —
  retry with a different topic.
- **Second bubble re-states the entire first bubble.** The
  summarizer ignored the "ONE sentence" instruction. Acceptable as
  a partial pass — the pipeline ran end-to-end, which is what this
  scenario tests.

---

## Scenario 6 — Reflection / revision loop (drafter ↔ reviewer)

### Goal
Prove that a flow can LOOP: a drafter writes a haiku, a reviewer
checks it, and if the reviewer rejects, the flow re-enters the
drafter to revise — until the reviewer approves. Tests conditional
back-edges, not just forward edges.

### Arrange (one-time setup for this scenario)

Requires Scenario 3 Part 1 (model enabled for flows).

#### Build the flow in the visual editor

This scenario tests the **If/Else** node — an LLM-driven router with
named ports. The Reviewer is the branching node; its two outbound
edges (`passed` and `failed`) are wired from distinct right-side
ports on its card. The `else` port stays unwired because the
reviewer's prompt always emits one of the two declared routes.

1. Click **gear icon** → **Flows** → **+ New flow**.
2. Top meta row:
   - **Display name:** `Revise Loop`
   - **api-name:** `revise-loop`
   - **Description:** `Drafts a haiku and revises until a reviewer approves.`
   - **Expose as /slash** ticked; **Slash-name:** `revise`.
3. **Add the Drafter Agent** (palette → Agent):
   - **Node id:** `haiku-drafter`
   - **Display name:** `Haiku Drafter`
   - **Model:** Available-for-Flows model.
   - **System prompt:**
     ```
     The user's topic appears below. Write a haiku (3 lines, roughly 5/7/5 syllables) on that topic. If a critique block is also below, address every concern in your revision. Output ONLY the haiku — no preface, no commentary.
     ```
   - Leave **Emit labels** empty.
   - **Context slots (advanced)** — expand. **Inputs:** add
     `user_query` and `critique` (two chips). **Outputs:** add
     `draft`. On the first iteration `critique` is empty; on loop
     iterations the reviewer's last judgement is there.
4. **Add the Reviewer as an If/Else** (palette → **If/Else**):
   - **Node id:** `haiku-reviewer`
   - **Display name:** `Haiku Reviewer`
   - **Model:** same as above.
   - **Emit labels:** the chip input is pre-filled with `passed` and
     `failed` (If/Else defaults). Leave those two chips as-is. The
     card now shows the amber If/Else tile and **three right-side
     ports**: `passed`, `failed`, and `else`.
   - **System prompt** (the post-#25 phrasing — routing is via the
     auto-bound `set_route` tool, NOT in-text tokens):
     ```
     A haiku draft appears below. Verify (a) exactly 3 lines, (b) roughly 5/7/5 syllables. Reply with one short sentence stating your judgement, then call set_route: target="passed" if BOTH checks succeed; target="failed" if either fails. Be slightly lenient on syllable counts — a 4/7/5 or 5/8/5 passes if the spirit is right.
     ```
   - **Context slots (advanced)** — **Inputs:** `draft`. **Outputs:**
     `critique`. The reviewer reads the latest draft from the slot
     and publishes its judgement so the drafter (on loop) can
     address it.

   > **Why slots here?** Without slot wiring, both nodes inherit the
   > full message transcript ending on the other's **assistant** turn.
   > Anthropic rejects assistant-prefill and the loop fails on the
   > second iteration. Slot inputs make every LLM call end on a user
   > turn (#26 — fixes both Failure A & B from that design call).
5. **Wire the edges** (4 total):
   - `Start → haiku-drafter`: drag from Start's right handle to any
     handle on the Drafter card.
   - `haiku-drafter → haiku-reviewer`: drag from any handle on
     Drafter to the Reviewer's **left inbound port** (the single
     left-side dot).
   - `haiku-reviewer → End` **via `passed`**: drag from the
     Reviewer's `passed` port (top of the right-side stack) to End's
     left handle.
   - `haiku-reviewer → haiku-drafter` **via `failed`** (the revise
     loop): drag from the Reviewer's `failed` port to any handle on
     the Drafter card. The edge label "failed" appears at its
     midpoint.
   - Leave the `else` port **unwired** — the Reviewer's prompt only
     emits `passed` or `failed`, so the else branch never fires.
     (The pre-save check requires `else` to go somewhere only if you
     intend the LLM to ever land on it; for this test we let an
     unmatched outcome fall through to the default condition which
     also matches `passed` in this flow — see "If something looks
     off" below if Save complains.)
6. **Validate** → **Save** → back-arrow. **Confirm the `/revise`
   badge is visible at the top of the Revise Loop card.**
7. App logo → hard-refresh.

### Act

1. **+ New chat**.
2. Type `/`, pick **/revise** from the popover.
3. Type after the slash: `the autumn moon`. Full text:
   `/revise the autumn moon`.
4. **Enter**.

### Assert

- [ ] Your message appears as a bubble on the right with the
  literal `/revise` prefix.
- [ ] The spinning logo + label **"Haiku Drafter..."** appears.
- [ ] A draft haiku appears as a bubble on the left — 3 lines.
- [ ] The label changes to **"Haiku Reviewer..."** and a second
  bubble streams in. It either:
  - states a one-sentence positive judgement (the route was
    `passed`), OR
  - states one short critique sentence (the route was `failed`).
  The reply text is **clean** — post-#25 routing is via the
  auto-bound `set_route` tool, NOT a `<<emit:passed>>` token in the
  bubble. If you see a literal `<<emit:...>>` string in the bubble
  the prompt is stale; see "If something looks off" below.
- [ ] If the reviewer chose **passed**, the flow ends — spinning
  logo disappears, Stop reverts to Send. Done.
- [ ] If the reviewer chose **failed**, the spinning logo flips
  back to **"Haiku Drafter..."** within a beat and a NEW draft
  bubble streams in (a revision). Followed by another reviewer
  bubble.
- [ ] The loop continues until reviewer chooses **passed** (usually
  within 1–3 revisions for this prompt). Final state: a positive
  judgement bubble, spinning logo gone.

### If something looks off

- **The reviewer NEVER approves and the flow keeps looping.**
  LangGraph's default recursion limit (25 steps) eventually halts
  the run. If you see >5 draft/review cycles, the reviewer is too
  strict for this topic — try a different topic (e.g.
  `cherry blossoms`) which haiku models tend to handle cleanly.
- **The reviewer's reply contains `<<emit:passed>>` or
  `<<emit:failed>>` visibly in the bubble.** That's the **legacy
  pre-#25** routing mechanism (text tokens) and shouldn't appear
  anymore. The reviewer's system prompt is stale — re-open the
  flow, click the `haiku-reviewer` node, and confirm the prompt
  says "call set_route" (not "end with <<emit:...>>"). The text
  tokens are now ignored at runtime, so a stale prompt will fall
  through to default routing and break the loop.
- **Only one draft + one reviewer bubble appear, then the flow
  ends WITHOUT either an explicit pass or a revision.** The LLM
  forgot to call `set_route`. The runtime falls back to
  `EDGE_DEFAULT` — which in this flow has no matching outgoing
  edge, so the run terminates. Retry; modern LLMs rarely drop the
  tool call but it happens.
- **Save was blocked saying the `else` port must be wired.** This
  branch's pre-save check doesn't enforce that, but if a future
  build does, drag the Reviewer's `else` port to End — the else
  branch will never fire given the prompt, so it's a no-op wire.
- **The spinning logo says "Drafting response..." instead of
  "Haiku Drafter...".** The slash didn't route. See Scenario 3
  gotchas.

---

## Scenario 7 — In-flow routing (router agent → specialist by topic)

### Goal
Prove that a "router" agent can classify the user's question and
hand off to one of three specialist agents via conditional edges.
Different questions exercise different downstream branches.

### Arrange (one-time setup for this scenario)

Requires Scenario 3 Part 1.

#### Build the flow in the visual editor

The Triage Router is the centerpiece — an **If/Else with three
declared emits** (`code`, `math`, `general`). Its card shows four
right-side ports: the three emits + the always-present `else`.
Three specialist Agents catch each branch and terminate at End.

1. Settings → Flows → **+ New flow**.
2. Top meta row:
   - **Display name:** `Triage Router`
   - **api-name:** `triage`
   - **Description:** `Classifies the user's question into code, math, or general and routes to a specialist.`
   - **Expose as /slash** ticked; **Slash-name:** `triage`.
3. **Add the Router as an If/Else** (palette → If/Else):
   - **Node id:** `triage-router`
   - **Display name:** `Triage Router`
   - **Model:** Available-for-Flows model.
   - **Emit labels:** the chip input starts with `passed, failed`
     (the If/Else default). **Delete both default chips** by
     clicking each chip's × . Then type `code`, press Enter; type
     `math`, press Enter; type `general`, press Enter. The card
     now shows 4 right-side ports: `code`, `math`, `general`, and
     `else`.
   - **System prompt:**
     ```
     The user's question is below. Classify it into EXACTLY ONE of: "code" (anything about programming, software, debugging), "math" (numbers, equations, formulas, calculations), or "general" (everything else). Reply with one short sentence stating your classification — e.g. "Classified as code." — then call set_route with target equal to "code", "math", or "general". Do NOT answer the question yourself.
     ```
   - **Context slots (advanced)** — **Inputs:** `user_query`. The
     router sees ONLY the original user message wrapped as a user
     turn (no transcript pollution).
4. **Add the three specialist Agents** (palette → Agent each time).
   Each one needs `inputs: [user_query]` in its Context slots so
   it reads the original user question rather than inheriting the
   transcript that ends on the router's classification reply
   (which would trip Anthropic's assistant-prefill rejection).
   - Coder Specialist: **Node id** `triage-coder`, **Display
     name** `Coder Specialist`, **Model** as above, **System
     prompt:**
     ```
     The user's question (below) was classified as a code question. Answer with concise code or a 1-2 sentence explanation. Begin your reply with the literal text "[CODE]".
     ```
     **Context slots → Inputs:** `user_query`.
   - Math Specialist: **Node id** `triage-mathematician`,
     **Display name** `Math Specialist`, **Model** as above,
     **System prompt:**
     ```
     The user's question (below) was classified as a math question. Answer with the relevant formula or short calculation. Begin your reply with the literal text "[MATH]".
     ```
     **Context slots → Inputs:** `user_query`.
   - Generalist: **Node id** `triage-generalist`, **Display name**
     `Generalist`, **Model** as above, **System prompt:**
     ```
     The user's question (below) was classified as general. Answer in 1-2 plain sentences. Begin your reply with the literal text "[GENERAL]".
     ```
     **Context slots → Inputs:** `user_query`.
5. **Wire the edges** (7 total — Start → router, 3 branches off
   the router via its named ports, 3 specialists → End):
   - `Start → triage-router`: drag from Start's right handle to
     the Router's **left inbound port**.
   - `triage-router(code) → triage-coder`: drag from the Router's
     `code` port (right side, top-most) to any handle on the
     Coder Specialist card.
   - `triage-router(math) → triage-mathematician`: drag from the
     Router's `math` port to any handle on the Math Specialist.
   - `triage-router(general) → triage-generalist`: drag from the
     Router's `general` port to any handle on the Generalist.
   - Leave the Router's `else` port unwired (the LLM is instructed
     to always pick one of the three declared routes).
   - `triage-coder → End`: drag any handle on the Coder card to
     End's left handle.
   - `triage-mathematician → End`: drag any handle on the Math
     card to End's left handle. (You may want to **drop a second
     End** from the palette for this so the edge doesn't cross
     other branches visually — the BE collapses both ends to
     `__end__` regardless.)
   - `triage-generalist → End`: same — wire to whichever End
     instance reduces edge-crossings on the canvas.
6. **Validate** → **Save** → back-arrow. **Confirm the `/triage`
   badge is visible at the top of the card.**
7. App logo → hard-refresh.

### Act

Run the test **three times** — once per branch — to prove the
router routes correctly for each kind of question.

Run A — code:
1. **+ New chat**, type `/`, pick **/triage**, then continue with
   `how do I reverse a string in python?`. **Enter**.

Run B — math:
2. **+ New chat**, type `/`, pick **/triage**, then continue with
   `what is the value of pi squared?`. **Enter**.

Run C — general:
3. **+ New chat**, type `/`, pick **/triage**, then continue with
   `what is the capital of Japan?`. **Enter**.

### Assert (apply to each of the three runs)

- [ ] Your message appears with the `/triage` prefix.
- [ ] The spinning logo + label **"Triage Router..."** appears.
- [ ] A short router bubble streams in containing something like
  "Classified as code." (or math / general — matching the
  question type).
- [ ] The label changes to the matching specialist:
  - Run A → **"Coder Specialist..."**
  - Run B → **"Math Specialist..."**
  - Run C → **"Generalist..."**
- [ ] A second bubble streams in starting with the corresponding
  literal prefix: **`[CODE]`** / **`[MATH]`** / **`[GENERAL]`**.
- [ ] Spinning logo disappears, Stop reverts to Send.

### If something looks off

- **The router classified correctly but the WRONG specialist
  ran.** The conditional-edge mapping is broken — capture the
  router bubble's text (it shows what was classified) and report.
- **Run hangs after the router bubble — no specialist bubble.**
  The router's `set_route` call didn't match any conditional
  edge. Most likely the LLM forgot to call `set_route` and the
  runtime fell back to `EDGE_DEFAULT` — which has no outgoing
  edge here. Retry with a fresh chat; modern LLMs rarely drop the
  tool call but it happens. If the literal text `<<emit:...>>`
  appears in the router's bubble, the prompt is stale on the old
  text-token routing — re-edit the node and confirm the prompt
  says "call set_route with target=..." (not "end with
  <<emit:...>>").
- **All three runs end up in the Generalist branch regardless of
  question.** Either (a) the router is always emitting `general`
  (model can't distinguish — try a stronger model), or (b) the
  `general` edge was somehow wired to the router's `else` port
  instead of the `general` port; click the edge, confirm its
  midpoint label reads "general" (not absent and not "else").

---

## Scenario 8 — Plan & Execute (planner → executor)

### Goal
Prove that one agent can produce a structured plan as text and a
downstream agent can read it from conversation history and act on
it. The two agents are distinct nodes with different roles.

### Arrange (one-time setup for this scenario)

Requires Scenario 3 Part 1.

#### Build the flow in the visual editor

Two sequential chat agents — same pattern as Scenario 5 but with
different prompts and one more boilerplate edge.

1. Settings → Flows → **+ New flow**.
2. Top meta row:
   - **Display name:** `Plan & Do`
   - **api-name:** `plan-and-do`
   - **Description:** `A planner outlines steps, then an executor performs them.`
   - **Expose as /slash** ticked; **Slash-name:** `plan-and-do`.
3. **Add the Planner Agent** (palette → Agent):
   - **Node id:** `plan-planner`
   - **Display name:** `Planner`
   - **Model:** Available-for-Flows model.
   - **System prompt:**
     ```
     The user asks you to perform a task. Do NOT perform it yourself. Output a numbered list of 3 to 5 concrete steps that an executor would follow. Begin with the literal line "Plan:" then list each step on its own line ("1. ...", "2. ...", etc.). No commentary after the list.
     ```
   - **Context slots (advanced)** — **Outputs:** `plan` (publishes
     the numbered plan for the executor to read).
4. **Add the Executor Agent** (palette → Agent):
   - **Node id:** `plan-executor`
   - **Display name:** `Executor`
   - **Model:** same as above.
   - **System prompt:**
     ```
     A "Plan:" with numbered steps appears below. Execute each step by writing exactly one line per step that begins with "Step N:" and describes what you did in 5-10 words (you have no real tools — narrate plausibly). End your reply with the single word "Done." on its own line.
     ```
   - **Context slots (advanced)** — **Inputs:** `plan` (reads the
     planner's slot output).

   > **Why slots here?** Without slot wiring, the executor's prompt
   > inherits the full transcript ending on the planner's
   > **assistant** turn — Anthropic rejects assistant-prefill and
   > the run fails before any executor output. Slots make the
   > executor's LLM call always end on a user turn (#26).
5. **Wire the edges** (3 total, sequential chain):
   - `Start → plan-planner`
   - `plan-planner → plan-executor`
   - `plan-executor → End`
6. **Validate** → **Save** → back-arrow. **Confirm the
   `/plan-and-do` badge is visible at the top of the card.**
7. App logo → hard-refresh.

### Act

1. **+ New chat**, type `/`, pick **/plan-and-do**.
2. Continue typing: `organise a small birthday party for ten guests`.
3. **Enter**.

### Assert

- [ ] Your message appears with the `/plan-and-do` prefix.
- [ ] The spinning logo + label **"Planner..."** appears.
- [ ] A bubble streams in that **starts with the literal `Plan:`**
  and contains a numbered list of 3 to 5 steps.
- [ ] The label changes to **"Executor..."**.
- [ ] A SECOND bubble streams in that contains lines starting with
  `Step 1:`, `Step 2:`, ... matching the planner's step count,
  AND ends with `Done.`.
- [ ] Spinning logo disappears, Stop reverts to Send.

### If something looks off

- **Only one bubble appears and it contains BOTH the plan AND the
  execution.** The planner ignored "Do NOT perform it yourself" and
  the executor had nothing to add (or echoed). Acceptable as a
  partial pass — the flow ran two nodes; the LLM merged the roles.
- **Executor's step count doesn't match the planner's.** The
  executor mis-counted or stopped early. Re-read both bubbles —
  this is a content issue, not a flow issue. Pass.
- **Executor's reply doesn't mention specific steps from the
  plan.** The executor isn't reading conversation history properly,
  OR the planner's output didn't follow the "Plan:" format the
  executor expects. Re-run; if it persists, file as a bug.

---

## Scenario 9 — Multi-pause HITL (two ask_user forms in one flow)

### Goal
Prove that a single flow run can pause TWICE — once at each of two
different nodes — and the same chat surface handles both forms in
sequence within one episode.

### Arrange (one-time setup for this scenario)

Requires Scenario 3 Part 1.

#### Build the flow in the visual editor

Two sequential Agents, each with the `ask_user` tool. The flow
pauses TWICE — once at each node — within a single episode.

1. Settings → Flows → **+ New flow**.
2. Top meta row:
   - **Display name:** `Two-Stage Form`
   - **api-name:** `two-stage-form`
   - **Description:** `Collect identity, then preferences, then summarise.`
   - **Expose as /slash** ticked; **Slash-name:** `two-stage-form`.
3. **Add Stage 1 Collector** (palette → Agent):
   - **Node id:** `stage-1-collector`
   - **Display name:** `Stage 1 Collector`
   - **Model:** Available-for-Flows model.
   - **Tools:** type `ask_user`, press Enter to commit it as a
     chip. The chip is required for this node to fire its form.
   - **System prompt:**
     ```
     You collect basic identity. You MUST call the ask_user tool EXACTLY ONCE to collect: (1) "name" — first name (text, required); (2) "city" — city the user lives in (text, required). After the user submits the form, write ONE short line: "Got it: <name> in <city>." then stop. Do NOT call ask_user a second time.
     ```
4. **Add Stage 2 Collector** (palette → Agent):
   - **Node id:** `stage-2-collector`
   - **Display name:** `Stage 2 Collector`
   - **Model:** same as above.
   - **Tools:** add an `ask_user` chip here too.
   - **System prompt:**
     ```
     You collect an activity preference. You MUST call the ask_user tool EXACTLY ONCE to collect: (1) "activity" — favourite weekend activity (text, required). After the user submits, write one summary sentence that mentions the activity AND repeats the earlier name + city from the conversation. End with "All done." Do NOT call ask_user a second time.
     ```
5. **Wire the edges** (3 total, sequential):
   - `Start → stage-1-collector`
   - `stage-1-collector → stage-2-collector`
   - `stage-2-collector → End`
6. **Validate** → **Save** → back-arrow. **Confirm the
   `/two-stage-form` badge is visible at the top of the card.**
7. App logo → hard-refresh.

### Act

1. **+ New chat**, type `/`, pick **/two-stage-form**.
2. Press **Enter** without typing anything after the slash. Full
   text in the box: `/two-stage-form`.

### Assert

- [ ] Your message appears with the `/two-stage-form` prefix.
- [ ] The spinning logo + label **"Stage 1 Collector..."** appears.
- [ ] **First form** pops up above the composer with two fields:
  `name` and `city`. Fill in: `Alex` and `Berlin`. Click **Submit**.
- [ ] The form disappears. The composer reclaims its slot
  immediately (with a **Stop** button visible — NOT an empty
  band).
- [ ] The label briefly stays **"Stage 1 Collector..."** then a
  short bubble streams in: `Got it: Alex in Berlin.`.
- [ ] The label changes to **"Stage 2 Collector..."**.
- [ ] **Second form** pops up with ONE field: `activity`. Fill in:
  `cycling`. Click **Submit**.
- [ ] The form disappears, composer + Stop reappear immediately
  (same as the first transition).
- [ ] A final bubble streams in containing **all three values**:
  the activity (cycling), the name (Alex), AND the city (Berlin),
  ending with `All done.`.
- [ ] Spinning logo disappears, Stop reverts to Send.

### If something looks off

- **After submitting the first form, the SAME form re-appears with
  the same fields.** The stage-1 LLM called `ask_user` a second
  time instead of moving on. The system prompt says "EXACTLY ONCE"
  — the LLM ignored it. Retry; if it persists, try a stronger
  model. This is an LLM-compliance issue, not a flow bug.
- **First form submits, no in-between bubble, second form appears
  directly.** Stage-1 finished without writing its "Got it:" line.
  Acceptable — the flow advanced. Continue with the second form.
- **Empty composer band appears between form submit and the next
  bubble/form.** This is the bug fixed by commit `0e87e85`
  (May 2026) — if you see it, the FE regressed. Report it.
- **Final bubble doesn't mention name OR city.** Stage-2 ignored
  earlier conversation history. Re-read the bubble — if `cycling`
  is present but not Alex / Berlin, mark as a partial pass and
  note the omission.
- **Form appears with 3+ fields instead of 2 (first) or 1
  (second).** The agent's prompt drove the wrong schema shape.
  Re-open the flow, click the offending node, verify the prompt
  matches what you pasted exactly.

---

## Scenario 10 — Aggregator (parallel fan-out + synthesis)

### Goal
Prove that a flow can fan-out the user's question to three agents
running in PARALLEL, each producing its own perspective, then fan-in
to a synthesizer agent that reads all three and writes a unified
answer. The visual editor writes one React-Flow edge per outgoing
target — the BE collapses these per-source same-condition groups
into a parallel dispatch.

### Arrange (one-time setup for this scenario)

Requires Scenario 3 Part 1.

#### Build the flow in the visual editor

This scenario exercises **fan-out + fan-in**. The visual editor
represents fan-out as multiple edges from the same source (no
special syntax — just draw N edges), and fan-in as multiple edges
into the same target. The runtime runs the fanned-out branches in
parallel and waits for all of them to finish before invoking the
fan-in target.

1. Settings → Flows → **+ New flow**.
2. Top meta row:
   - **Display name:** `Multi-Perspective Aggregator`
   - **api-name:** `aggregate`
   - **Description:** `Gets three perspectives in parallel, then synthesises them.`
   - **Expose as /slash** ticked; **Slash-name:** `aggregate`.
3. **Add the three Perspective Agents** (palette → Agent × 3).
   Each one reads the user's question from the `user_query` slot
   and publishes its reply to a **distinct per-perspective slot**
   so the synthesizer can read all three independently (the
   NodePanel doesn't expose the "append" reducer, so a single
   shared `perspectives` slot would last-wins-clobber across the
   parallel writes).
   - Technical: **Node id** `agg-technical`, **Display name**
     `Technical Perspective`, **Model** Available-for-Flows,
     **System prompt:**
     ```
     The user's question (below) needs a TECHNICAL perspective. Answer in 1-2 sentences. Begin your reply with the literal text "[TECHNICAL]".
     ```
     **Context slots → Inputs:** `user_query`. **Outputs:**
     `perspective_tech`.
   - Practical: **Node id** `agg-practical`, **Display name**
     `Practical Perspective`, **Model** as above, **System prompt:**
     ```
     The user's question (below) needs a PRACTICAL / everyday perspective. Answer in 1-2 sentences. Begin your reply with the literal text "[PRACTICAL]".
     ```
     **Context slots → Inputs:** `user_query`. **Outputs:**
     `perspective_prac`.
   - Historical: **Node id** `agg-historical`, **Display name**
     `Historical Perspective`, **Model** as above, **System prompt:**
     ```
     The user's question (below) needs a HISTORICAL perspective. Answer in 1-2 sentences. Begin your reply with the literal text "[HISTORICAL]".
     ```
     **Context slots → Inputs:** `user_query`. **Outputs:**
     `perspective_hist`.
4. **Add the Synthesizer Agent** (palette → Agent):
   - **Node id:** `agg-synthesizer`
   - **Display name:** `Synthesizer`
   - **Model:** as above.
   - **System prompt:**
     ```
     Three perspectives on the user's question are provided below, each prefixed with [TECHNICAL], [PRACTICAL], or [HISTORICAL]. Write a single 2-3 sentence synthesis that EXPLICITLY weaves together insights from ALL THREE — name each perspective by its label at least once. Begin your reply with the literal text "[SYNTHESIS]".
     ```
   - **Context slots → Inputs:** `perspective_tech`,
     `perspective_prac`, `perspective_hist` (three chips). The
     synthesizer's prompt now sees each perspective in its own
     slot, wrapped as a single user turn — no transcript
     contention.

   > **Why slots here?** Without slot wiring, the synthesizer
   > inherits the full transcript ending on three back-to-back
   > **assistant** turns. Anthropic rejects assistant-prefill and
   > the run fails. Slots make every LLM call always end on a
   > user turn (#26).
5. **Wire the edges** (7 total — Start fans out to 3, 3 fan into
   the synthesizer, synthesizer to End):
   - `Start → agg-technical`, `Start → agg-practical`,
     `Start → agg-historical` — drag three separate edges from
     Start's right handle to each perspective card's inbound.
     (The visual editor doesn't have a special "fan-out" syntax;
     just draw three edges.)
   - `agg-technical → agg-synthesizer`, `agg-practical →
     agg-synthesizer`, `agg-historical → agg-synthesizer` — three
     more edges, all terminating at the Synthesizer's inbound.
     LangGraph's fan-in semantics wait for all three to finish
     before invoking the Synthesizer once.
   - `agg-synthesizer → End`.
6. **Validate** → **Save** → back-arrow. **Confirm the `/aggregate`
   badge is visible at the top of the card.**
7. App logo → hard-refresh.

### Act

1. **+ New chat**, type `/`, pick **/aggregate**.
2. Continue typing: `why do we use clocks?`.
3. **Enter**.

### Assert

- [ ] Your message appears with the `/aggregate` prefix.
- [ ] The spinning logo + label appears. **The label may show any
  of "Technical Perspective...", "Practical Perspective..." or
  "Historical Perspective..." — and may flicker between them while
  the three branches run in parallel.** That's expected (last-wins
  across parallel agents).
- [ ] **THREE assistant bubbles** stream in (possibly overlapping
  in time, possibly in any order):
  - one beginning with **`[TECHNICAL]`**,
  - one beginning with **`[PRACTICAL]`**,
  - one beginning with **`[HISTORICAL]`**.
- [ ] Once all three have finished, the spinning logo + label
  changes to **"Synthesizer..."**.
- [ ] A FOURTH bubble streams in beginning with **`[SYNTHESIS]`**.
  Its content mentions each of the three perspective labels at
  least once, OR explicitly weaves together their insights.
- [ ] Spinning logo disappears, Stop reverts to Send.

### If something looks off

- **Only one perspective bubble appears, then the synthesizer
  runs.** You're missing some of the fan-out edges. Re-open the
  flow and confirm there are **three separate edges** leaving
  Start — one to each perspective card. The YAML preview (YAML
  button) should show three lines `{from: __start__, to:
  agg-technical}`, `{from: __start__, to: agg-practical}`,
  `{from: __start__, to: agg-historical}`.
- **The synthesizer's bubble mentions perspective labels but the
  content doesn't actually match the perspective bubbles above —
  e.g. the synthesizer talks about "[HISTORICAL]" insights that
  weren't in the historical bubble.** The slot wiring may be off.
  Open the flow, click each perspective node, and confirm the
  **Outputs** chip is distinct per perspective
  (`perspective_tech` / `perspective_prac` / `perspective_hist`).
  Then click the synthesizer and confirm all three appear in its
  **Inputs**. A shared slot would last-wins-clobber across the
  parallel writes.
- **The synthesizer's bubble doesn't mention all three labels at
  all.** Content miss but structural pass — re-read the bubble; if
  the four bubbles (3 perspectives + synthesizer) all appeared
  cleanly the flow ran end-to-end. Mark partial.
- **Bubbles appear in the wrong order — e.g. synthesizer streams
  BEFORE all three perspectives have finished.** This is a real
  bug. LangGraph's fan-in semantics should block the synthesizer
  until ALL three branches complete. Capture screenshots and
  report.
- **Run halts after the three perspective bubbles — no synthesizer
  bubble.** The fan-in edge didn't fire. Re-check the YAML — the
  edge must be `{from: "tech_1,prac_1,hist_1", to: synth_1}` with
  the `from` value quoted as a single string (the quotes matter
  because the comma would otherwise be interpreted as a YAML list
  separator in some contexts).
- **All four bubbles have identical content.** All four agents are
  using the same prompt; check that you pasted each agent's
  `system_prompt` block correctly and didn't accidentally
  copy-paste over them.

---

## Scenario 11 — Navigate away mid-response, come back to find it complete (OR streaming live)

**What you're testing.** The Background-Run Execution architecture
(claude.ai parity): once you submit a chat, the BE keeps generating
the LLM response even if you navigate away. Before this work, closing
the streaming view cancelled the run and the response was lost —
"abandoned" chats produced ghost rows in the sidebar with no content.

**Setup.** Any model registered + at least one chat-eligible model
enabled. No flow needed — default chat is fine.

**Steps.**

1. From the landing page, type a prompt that takes a while to
   answer (e.g. "Write a 1000-word essay on the history of the
   printing press"). Hit send.
2. While the response is still streaming (the thinking strip is
   visible above the streaming bubble), click **+ New chat** in the
   sidebar.
3. **Variant A (mid-stream reattach):** Within ~5-10s, click back
   on the first chat. You should see the assistant response RESUME
   streaming live — the tokens that landed while you were away
   replay all at once (M5.2 event-log replay), then live tokens
   continue arriving until the response completes.
4. **Variant B (wait for completion):** Wait ~30 seconds without
   opening the first chat. Then click it.

**What you should see (both variants).** The first chat shows the
FULL assistant response — exactly as if you'd stayed on the page
the whole time. The sidebar entry should also have a real title
(auto-generated within the first ~1 second of your submit) instead
of "New chat".

**What's broken if you don't see this.** The most likely failures:

- **Chat shows your message but no assistant reply.** The BE run
  didn't survive the disconnect — either the eager-create + persist
  flow has regressed (M1) or the background task isn't spawning
  (M2). Check `logs/app.log` for `endpoint=pragna_run_chat` lines:
  the happy-path log should include `episode_id` AND a follow-up
  `Eager-created turn state` info line.
- **Sidebar entry stuck on "New chat" (no title even after 5+
  seconds).** Auto-title didn't fire. Check the user's first message
  is non-empty and that the conversation row has a `user_model_id`
  stamped (the title flow bails when it's NULL). `logs/app.log`
  filtered by `logger == "auto-title"` shows the bail reason.
- **Reload makes the response appear.** The BG task DID persist but
  the FE didn't pick up the new messages on re-mount. That's a
  React Query cache invalidation issue, not a Background-Run bug —
  refresh and continue.

---

## Scenario 12 — Hard refresh during streaming

**What you're testing.** Same as Scenario 11 but with a more
aggressive interruption — a browser reload that completely
discards the FE state. The BE has no way to know whether your
client crashed or you closed the tab; in either case it should
keep running and persist on completion.

**Setup.** Same as Scenario 11.

**Steps.**

1. Submit a long prompt (e.g. "Explain quantum entanglement in
   depth").
2. While the response is streaming (thinking strip visible), hit
   browser **Cmd-R / Ctrl-R** (hard refresh).
3. Wait ~30 seconds on the (now-empty) landing page.
4. Click the first chat in the sidebar.

**What you should see.** Same as Scenario 11 — the full response
should be there.

**What's broken if you don't see this.** Same failure modes as
Scenario 11. The reload is functionally equivalent to "close tab"
from the BE's perspective.

---

## Scenario 13 — Multi-tab consistency

**What you're testing.** Two tabs on the same chat should both
eventually reflect the same DB state. Today there's no real-time
push between tabs — Tab B sees new messages only after a manual
refresh OR navigation.

**Setup.** Same as Scenario 11.

**Steps.**

1. From the landing page, submit a prompt.
2. As soon as the chat surface mounts, **right-click the chat in
   the sidebar → Open in new tab**. You now have two tabs on the
   same conversation.
3. In Tab A (the original), wait for the response to complete.
4. In Tab B (the copy), refresh (Cmd-R).

**What you should see.** Tab B now shows the same assistant
response Tab A has. Both tabs have the same title in the sidebar
entry.

**What's broken if you don't see this.** Tab B's messages list
might not have refreshed. Try navigating Tab B to a different
sidebar entry and back — that forces a `/messages` refetch.

**Out of scope.** Real-time push to Tab B as Tab A's stream
progresses. ChatGPT and Claude.ai also don't do this — Tab B
catches up only on navigation or manual refresh.

---

## Scenario 14 — Rapid chat switching (the 2026-05-26 bug repro)

**What you're testing.** The exact user-reported repro that
motivated the Background-Run Execution work. Before this work,
rapid submits with immediate "+ New chat" clicks produced ghost
sidebar entries (visible in the sidebar but no DB row backing
them — refresh and they vanished).

**Setup.** Same as Scenario 11.

**Steps.**

1. Submit any prompt (e.g. "hello").
2. Immediately click **+ New chat** in the sidebar.
3. Submit another prompt (e.g. "hi").
4. Immediately click **+ New chat** again.
5. Repeat steps 3-4 two more times so you've submitted 4 prompts
   in rapid succession.
6. Wait ~30 seconds.
7. Click each of the 4 chats in the sidebar in turn.

**What you should see.** Each of the 4 chats shows BOTH your
prompt AND a complete assistant response. No "ghost" entries —
every sidebar item has real content. Each has a real title.

**What's broken if you don't see this.**

- **Some chats show your message but no response.** Eager-create
  worked (the conversation + user message are there) but the
  background task didn't complete persistence. Likely a regression
  in M2's `_drive_run_task` finally block. Check `logs/app.log`
  for the corresponding `episode_id` — there should be a
  matching `mark_episode_terminal` log entry.
- **Some chats are entirely missing (sidebar entry has no
  backing row when you click).** The eager-create write failed
  silently. Check `logs/app.log` for any 4xx / 5xx during the
  POST /api/conversations or POST /pragna/chat windows.
- **You get a "Too many chats in flight" error on the 4th
  submit.** That's the cap working as intended — the per-user
  concurrent-runs cap (3 today) prevents resource exhaustion.
  Wait for one of the in-flight runs to finish, then retry.

---

## Scenario 15 — RETIRED (no longer applicable post-migration 0024)

This scenario tested reverse-reference pills on a standalone Agents
settings page. Migration 0024 made agents **flow-owned** — every agent
belongs to exactly one flow, authored inline inside the flow editor,
and the standalone Agents page was retired. There is no longer a "what
breaks if I edit this agent?" question because editing an agent inside
a flow only affects that single flow.

The functional intent (let the operator see which flow owns each
agent) is now trivially answered by **opening the flow** — every node
on the canvas IS the agent. If you want to enumerate "all agents
across all flows", iterate the Flows list and read each flow's nodes.

Left in place for historical reference (so anyone reading older
commits can see what was here); skip when running the scenarios.

---

## Scenario 16 — Dynamic fan-out: author + visualize a dispatching edge

### Goal
Prove that the visual editor can declare **per-item dynamic fan-out**
on an edge (BE future-discussions #35) — N parallel invocations of the
target node, where N is decided at runtime from a list slot. Verifies
the EdgePanel inspector wires the three dispatch fields correctly,
the dispatching edge renders a visible `↴ per-item` badge, and the
configuration round-trips through save + reload without loss.

Differs from Scenario 10 (aggregator): static fan-out in Scenario 10
hard-codes the **target** nodes at author time (three sibling
perspective nodes). **Dynamic fan-out spawns N copies of ONE target
node**, where N is decided at runtime by the upstream slot's contents.

### Arrange (one-time setup for this scenario)

Requires Scenario 3 Part 1.

#### Build the flow in the visual editor

1. Settings → Flows → **+ New flow**.
2. Top meta row:
   - **Display name:** `Dispatch Sketch`
   - **api-name:** `dispatch-sketch`
   - **Description:** `Minimal flow to author a per-item dispatch edge.`
   - **Expose as /slash** unticked (this scenario doesn't run the flow;
     authoring is the test).
3. **Add the Producer Agent** (palette → Agent):
   - **Node id:** `producer`
   - **Display name:** `Producer`
   - **Model:** Available-for-Flows.
   - **System prompt:** (anything — won't run this scenario)
   - **Context slots → Outputs:** `raw_items`. (The Outputs chip input
     lives in the NodePanel's "Context slots (advanced)" collapsible.
     Type the slot name, press Enter.)
4. **Add the Verifier Agent** (palette → Agent):
   - **Node id:** `verifier`
   - **Display name:** `Verifier`
   - **Model:** as above.
   - **System prompt:** (anything)
   - **Context slots → Inputs:** `one_item`.
5. **Wire the edges** in this order:
   - `Start → producer` (drag from Start's right handle to the
     Producer's inbound).
   - `producer → verifier` (drag from Producer's right handle to the
     Verifier's inbound). **This is the edge we'll mark as a
     dispatch.**
   - `verifier → End`.
6. **Save** (use the Save button at top right). Confirm the green
   success banner.

### Act

1. **Click the `producer → verifier` edge** on the canvas (anywhere on
   the connector line). A new side-panel slides in from the right
   titled **Edge** with a subheader `producer → verifier`.
2. In the Edge panel, find the **Dynamic fan-out** section. Tick the
   **Send per item** checkbox.
3. Two dropdowns appear below the checkbox: **Items slot (source
   list)** and **Item slot (per-instance payload)**.
4. In **Items slot**, pick `raw_items` (the slot you declared on the
   Producer's Outputs). A built-in entry **`user_query`** is also
   available — leave it; pick `raw_items` for this test.
5. In **Item slot**, pick `one_item` (the slot you declared on the
   Verifier's Inputs).
6. Below the dropdowns the panel shows a sentence like *"Runtime: one
   parallel invocation of `verifier` per item in `raw_items`, bound
   to `one_item` on each instance."*
7. Close the Edge panel (X button at top).
8. **Save** again. Green success banner.
9. Click the **back arrow** to return to the flows list. Then click
   **Dispatch Sketch** to re-open the flow.

### Assert

- [ ] After step 2 the **Send per item** checkbox is ticked AND the
  two dropdowns are visible.
- [ ] After steps 4-5 both dropdowns show your chosen slot names
  (`raw_items` and `one_item`).
- [ ] After step 7 the edge **`producer → verifier`** on the canvas
  shows a small **blue `↴ per-item` chip** near its midpoint.
- [ ] The dispatching edge's line is rendered **dashed** (not solid)
  to visually distinguish it from non-dispatching edges.
- [ ] Hovering the chip surfaces a tooltip mentioning the items slot
  (e.g. *"Dynamic fan-out: one parallel target invocation per item
  in 'raw_items'."*).
- [ ] After step 9 (close + reopen the flow), the **chip is still on
  the edge** AND clicking the edge re-opens the EdgePanel with the
  checkbox **still ticked** and both dropdowns **still populated**
  with `raw_items` and `one_item`. **This is the round-trip check.**
- [ ] Untick the **Send per item** checkbox. The two dropdowns
  disappear AND the chip on the edge disappears AND the line goes
  back to solid. (Optional — confirms the toggle round-trips both
  ways.)

### If something looks off

- **Clicking the edge doesn't open a panel.** The EdgePanel only
  opens for plain edges, not for the four omni-handles. Aim for the
  curved line in the middle of the connector, not for a node.
- **The Items slot dropdown shows ONLY `user_query`, not
  `raw_items`.** The Producer node has no `outputs` declared. Re-open
  it (click the producer card), expand **Context slots (advanced)**,
  and confirm `raw_items` is in the **Outputs** chip list.
- **The Item slot dropdown is empty.** The Verifier node has no
  `inputs` declared. Re-open it and confirm `one_item` is in the
  **Inputs** chip list.
- **The Save button is greyed out after I made changes.** The dirty
  flag may not have fired — try clicking somewhere else on the
  canvas (deselects edge), then back on the edge, then re-toggle.
- **The chip appears in step 7 but disappears after reload.** The
  YAML round-trip is broken. Open the YAML preview (YAML button in
  the header) — the dispatching edge should show three keys:
  `dispatch_mode: per_item`, `items_slot: raw_items`,
  `item_slot: one_item`. If those keys are missing on reload,
  capture the YAML and report — this is a real round-trip bug.

---

## Scenario 17 — Dynamic fan-out: mutual-exclusion gate with If/Else

### Goal
Prove that the EdgePanel correctly **prevents** declaring per-item
dispatch on an edge whose source is an **If/Else** node — the v1
locked design call: a node either branches via `set_route` OR fans
out, **not both**. The gate is enforced via a disabled toggle plus
an amber callout naming the source's `emits`, mirroring the BE YAML
validator's `mutual-exclusion` error.

### Arrange (one-time setup for this scenario)

Requires Scenario 3 Part 1.

#### Build the flow in the visual editor

1. Settings → Flows → **+ New flow**.
2. Top meta row:
   - **Display name:** `Gate Sketch`
   - **api-name:** `gate-sketch`
   - **Description:** `Minimal flow to test the dispatch mutual-exclusion gate.`
   - **Expose as /slash** unticked.
3. **Add an If/Else node** (palette → If/Else). It drops with two
   emit chips by default (`passed`, `failed`).
4. **Add a Worker Agent** (palette → Agent):
   - **Node id:** `worker`
   - **Display name:** `Worker`
   - **Model:** Available-for-Flows.
   - **Context slots → Inputs:** `payload`.
5. **Wire the edges:**
   - `Start → node_1` (drag from Start to the If/Else's inbound; the
     If/Else's node id defaults to `node_1`).
   - `node_1 → worker` — drag from the **`port:passed`** port (the
     top right-side port on the If/Else card; the `else` port is the
     last one). **The edge we'll click is this one.**
   - `worker → End`.
6. **Save**. Confirm the green success banner.

### Act

1. **Click the `node_1 → worker` edge** (the line leaving the If/Else's
   `port:passed`). The Edge panel slides in.
2. Find the **Dynamic fan-out** section. **Look at the Send per item
   checkbox.**
3. Look for an **amber callout** beneath the checkbox (info-circle
   icon, amber background, dark amber text).
4. (Optional) Try to **click the checkbox**.

### Assert

- [ ] The **Send per item** checkbox is **disabled** (cannot be
  clicked / greyed out).
- [ ] An **amber callout** is visible beneath the checkbox.
- [ ] The callout text mentions the source agent's **emits** list
  (e.g. *"Agent ... already branches via emits ['passed', 'failed']
  ..."*) AND the words **"either branches or fans out"** (or
  similar). The exact wording: a node either branches via `emits` or
  fans out via `dispatch_mode`, not both (v1).
- [ ] If you tried to click the checkbox in step 4: nothing happens
  (it stays unticked).
- [ ] The dropdowns for **Items slot** and **Item slot** are **NOT**
  rendered (only appear when dispatch is on, and dispatch is gated
  off here).
- [ ] The edge on the canvas does **not** show a `↴ per-item` chip.

### If something looks off

- **The checkbox is enabled (not greyed out).** The mutual-exclusion
  gate has regressed. Re-open the source node (`node_1`), expand
  **Emit labels**, and confirm both `passed` and `failed` chips are
  there. If they are AND the checkbox is still enabled, this is a
  real bug — capture a screenshot of the Edge panel and report.
- **The checkbox is disabled BUT no callout is visible.** The gate
  fires but the user has no explanation. Capture a screenshot and
  report — the callout's purpose is to teach the author *why* the
  toggle is off.
- **The callout text mentions a different reason** (e.g. "target is
  __end__" or "source isn't an agent node"). You may have wired the
  edge wrong — the test wants the edge to leave `port:passed` and
  arrive at `worker`. The EdgePanel only renders the FIRST blocking
  reason it finds; other reasons are still bugs to fix but the test
  here is specifically the source-has-emits gate.
- **The checkbox is enabled AND ticking it succeeds, dispatching
  fields appear.** The gate isn't being checked at all. This is a
  bigger regression — the BE will reject the YAML on Save with a
  `mutual-exclusion` 422 error. The test fails here, not at Save.

---

## If something doesn't work (general gotchas)

Things to check before reporting a bug:

- **Page won't load at all.** The backend may not be running. Ask
  whoever set you up to confirm the server is on.
- **Chat works but replies are super slow (over 30 seconds).** Could
  be a slow AI model or a network issue. Try a different model in
  Settings → Providers.
- **Spinning logo keeps spinning forever.** Click the **Stop** button
  (where Send normally is, but it changes to Stop while streaming).
  Then try again with a fresh chat.
- **You get logged out unexpectedly.** Sessions expire — sign in
  again and continue.
- **A form pops up but the page behind it is greyed out and
  unclickable.** That's normal — the form is "modal", meaning you have
  to either submit it or cancel before doing anything else.
- **You can't find a button described in this doc.** The UI may have
  changed since this doc was written. Look for buttons with similar
  labels or icons. Report the discrepancy.

---

## How to report a failed scenario

When a scenario fails, capture:

1. **Which scenario number** (1 through 15).
2. **Which assertion failed** (the checkbox text).
3. **What you saw instead** (in plain English — e.g. "the form
   appeared but had four fields instead of three").
4. **Any error message text** (copy it exactly, including red
   highlights or pop-ups).
5. **A screenshot if possible** (press `Cmd+Shift+4` on Mac,
   `Windows+Shift+S` on Windows, then drag a box around the relevant
   part of the screen).

Send these to whoever asked you to run the test.

---

## Adding new scenarios

When new chat features ship, add a scenario here following the same
shape:

- One sentence **Goal**.
- **Arrange** — setup steps a non-technical tester can follow,
  including any data they need to create.
- **Act** — exact, numbered clicks and typing. Treat literal text as
  literal (use code blocks).
- **Assert** — checkbox list of visible things they should see. UI
  only — no network tabs, no databases.
- **If something looks off** — the three most likely causes.

Keep each step simple enough that someone using the app for the first
time could do it without asking questions. If a scenario needs more
than ~10 steps in Act, split it into two.
