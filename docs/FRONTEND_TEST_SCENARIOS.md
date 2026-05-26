# Frontend Test Scenarios

A manual test script for the chat feature, written for someone seeing
the app for the first time. No coding, no developer tools, no command
line — just clicks and reads.

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
> property of a Flow, and a Flow references an Agent by name. So you
> will build, in order: **1) enable a model for flows → 2) create an
> agent → 3) create a flow → 4) expose the flow as a slash command →
> 5) test it.** Do every part below — none are optional. Every field
> value is spelled out exactly; type them literally.

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

#### Part 2 — Create an agent (flows reference agents by api_name)

1. In the settings sidebar, click **Agents** (under "AI Setup").
2. Click the **+ New agent** button (top-right of the page).
3. Fill in every field with exactly these values:
   - **API name:** `research-agent`
   - **Display name:** `Research Agent`
   - **Description (optional):** `Answers research questions in
     plain English.`
   - **Model:** click the dropdown and pick the same model you just
     enabled for flows (e.g. `claude-sonnet-4-5`). If the dropdown
     says "No models are enabled for Flows", go back to Part 1.
   - **Emit labels:** leave empty (no chips).
   - **Tools:** leave empty (no chips).
   - **System prompt** (paste this exactly, including the line
     break):
     ```
     You are a careful researcher. Answer the user's question in 3 to 5 sentences using plain English. If the question is unclear, make a reasonable assumption and state it.
     ```
4. Click **Save** (top-right). You should be sent back to the Agents
   list and see a card titled "Research Agent" with `research-agent`
   underneath.

#### Part 3 — Create a flow that uses that agent

1. In the settings sidebar, click **Flows** (under "Workflows").
2. Click the **+ New flow** button (top-right).
3. The YAML editor opens with a starter template. **Select all the
   text inside the editor (Cmd+A on Mac, Ctrl+A on Windows) and
   delete it.**
4. Paste this YAML exactly (every character matters, including
   indentation — YAML is whitespace-sensitive):
   ```yaml
   api_name: research-flow
   display_name: Research Flow
   description: Quick research answers on any topic.

   flow:
     nodes:
       - {node_id: research_1, agent: research-agent}
     edges:
       - {from: __start__, to: research_1}
       - {from: research_1, to: __end__}
   ```
5. Click the **Validate** button (top-right). A green banner should
   say **"Looks good — ready to save."** If you see red errors,
   re-check that you pasted the YAML exactly — indentation under
   `nodes:` and `edges:` must be two spaces.
6. Click the **Save** button (top-right). The banner should change
   to **"Created 'Research Flow'."** The right-hand preview should
   now show a small two-node graph: `__start__ → research_1 →
   __end__`.

#### Part 4 — Expose the flow as `/research`

1. Click the **back arrow** (top-left, next to "Edit flow") to
   return to the Flows list.
2. You should now see a card titled **"Research Flow"** with
   `research-flow` underneath.
3. At the bottom of that card, find the **"Expose as /slash
   command"** row.
4. **Tick the checkbox** "Expose as /slash command".
5. In the text input that becomes editable (it has a `/` prefix and
   placeholder "kebab-case-name"), type exactly: `research`
6. Click the **Save** button on that row.
7. After ~1 second, a **`/research` badge** appears at the top of
   the row. That confirms the exposure was saved.

   If the Save button is disabled or you see a warning ("Add a flow
   description before exposing"), go back to Part 3 — the flow's
   `description:` line is missing.

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

## Scenario 4 — Slash command that opens a form

### Goal
Combine Scenarios 2 and 3 — prove that a slash-exposed flow can also
pause mid-run and pop up the ask_user form, then resume with the
submitted values.

### Arrange (one-time setup for this scenario)

This scenario **requires Scenario 3's setup to be complete first**
(model enabled for flows, `research-agent` created, `research-flow`
created, `/research` exposed). If you haven't done Scenario 3 yet,
go do it now — Scenario 4 will not work without it.

Now we extend the `research-agent` so it pauses for a form before
answering. Exact steps:

1. Click the **gear icon** in the bottom-left (Settings).
2. Click **Agents** in the settings sidebar.
3. Find the card titled **"Research Agent"** (api_name
   `research-agent`). Click the **pencil icon** on that card to
   open the agent editor.
4. Update **two fields only** — leave every other field as it is:
   - **System prompt:** select all the text in the system prompt
     textarea (click into it, then Cmd+A / Ctrl+A) and replace it
     with exactly this:
     ```
     You are a careful researcher. Before answering anything, you MUST call the ask_user tool exactly once to collect two values from the user: (1) "topic" — the topic to research (text, required); (2) "depth" — the desired depth, one of "short", "medium", or "long" (text, required). After the user submits the form, write a research answer about their topic at roughly their chosen depth (short = 2 sentences, medium = 4 sentences, long = 7 sentences).
     ```
   - **Tools:** click into the Tools chip input. Type `ask_user`
     (lowercase, with the underscore) and press **Enter** to commit
     it as a chip. A chip labelled `ask_user` should now appear
     above the input. Do NOT add any other tools.
5. Click the **Save** button (top-right). You should be returned to
   the Agents list. The "Research Agent" card should still be
   there.
6. Click the **app logo** (top-left) to return to chat.

### Act

1. Click **+ New chat** in the sidebar.
2. Click the text box at the bottom.
3. Type the `/` character. The slash popover should appear listing
   **/research**.
4. Click **/research** (or press Enter while it's highlighted). The
   composer should now show `/research ` (with a trailing space).
5. Press **Enter** WITHOUT typing anything after the slash. (We're
   not giving the agent a topic on purpose — it should ask for one
   via the form.)

### Assert

- [ ] Your message appears as a bubble on the right side, showing
  literally `/research`.
- [ ] The spinning logo + label **"Research Agent..."** appears
  briefly.
- [ ] Within a few seconds, a **form pops up** above the text box.
  It must contain exactly **two input fields**: one labelled
  **topic** (or "Topic") and one labelled **depth** (or "Depth").
- [ ] The spinning logo + "Research Agent..." text **disappears**
  while the form is showing (the form replaces it as the
  "what's-happening-now" indicator).
- [ ] A **Submit** button is visible at the bottom of the form
  (label may also be "Send" or "Continue").
- [ ] Fill in the fields with these exact values:
  - **topic:** `quantum computing`
  - **depth:** `short`
- [ ] Click **Submit**.
- [ ] The form **disappears**.
- [ ] The spinning logo + "Research Agent..." label **reappears**
  briefly.
- [ ] An AI reply streams in as a bubble on the left side. The
  reply must:
  - mention **quantum computing** (the topic you gave),
  - be approximately **2 sentences long** (because depth = short).
- [ ] When the reply finishes, the spinning logo disappears and the
  Stop button reverts to a Send arrow.

### If something looks off

- **No form appears — the AI just streams an answer directly.** The
  agent either lost its tool or its system prompt. Go back to
  Settings → Agents → edit "Research Agent" and confirm BOTH (a)
  the system prompt still contains the "you MUST call the ask_user
  tool" sentence, AND (b) there is an `ask_user` chip in the Tools
  field. Both are required — having only one will not work.
- **Form pops up but with only ONE field, or with extra fields.**
  The agent's system prompt drives the form shape. Re-open the
  agent and confirm the system prompt mentions BOTH "topic" AND
  "depth" by those exact names.
- **You see a red error mentioning "tool not found" or
  "ask_user".** The chip wasn't saved — re-edit the agent and add
  the `ask_user` chip again, then Save.
- **Form pops up correctly but clicking Submit throws an error.**
  Copy the exact error text and the failed field name, and report
  it — this is a real bug.
- **You click Cancel on the form.** A confirmation dialog should
  appear; confirming should add a small grey "You cancelled..."
  breadcrumb in the chat and the spinning logo should disappear.
  This is also a valid sub-check.

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

1. **Which scenario number** (1, 2, 3, or 4).
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
