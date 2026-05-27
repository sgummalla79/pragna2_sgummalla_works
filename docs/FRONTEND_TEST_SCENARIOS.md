# Frontend Test Scenarios

A manual test script for the chat feature, written for someone seeing
the app for the first time. No coding, no developer tools, no command
line — just clicks and reads.

> **Companion doc:** [FRONTEND_TEST_SCENARIOS_GAPS.md](FRONTEND_TEST_SCENARIOS_GAPS.md) lists agentic-flow patterns (e.g. Tree of Thought, Multi-Agent Debate, Event-Driven triggers, cross-conversation memory) that aren't currently testable, what primitive is missing, and what would need to ship to enable them.

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
   indentation — YAML is whitespace-sensitive). Note the
   `slash_api_name:` + `exposed_as_slash: true` lines — those make
   the flow slash-invocable on save, no separate toggle needed:
   ```yaml
   api_name: research-flow
   display_name: Research Flow
   description: Quick research answers on any topic.
   slash_api_name: research
   exposed_as_slash: true

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

## Scenario 5 — Sequential pipeline (research → summarize)

### Goal
Prove that a flow can chain two agents in sequence — the first
researches a topic, the second condenses the result into one sentence.
You should see TWO assistant bubbles back-to-back, one per node.

### Arrange (one-time setup for this scenario)

Requires Scenario 3 Part 1 (model enabled for flows). You do NOT need
the `research-agent` or `research-flow` from Scenario 3 — this
scenario inlines its own agents inside the flow YAML.

#### Find your model api_name

The YAML below references your model by its `api_name`. To find it:

1. Click **gear icon** → **Providers** in settings.
2. Click the tile for the provider you connected (e.g. Anthropic).
3. Hover over the model you enabled for flows. The small grey text
   under the display name is the `api_name` (e.g.
   `claude-sonnet-4-5`).
4. Copy it. You'll paste it into the YAML below wherever you see
   `<YOUR_MODEL_API_NAME>`.

#### Create the flow

1. Click **gear icon** → **Flows** → **+ New flow**.
2. Select-all and delete the starter template.
3. Paste this YAML exactly. Replace **both** occurrences of
   `<YOUR_MODEL_API_NAME>` with the value you copied above.
   ```yaml
   api_name: research-pipeline
   display_name: Research Pipeline
   description: Researches a topic, then condenses to one sentence.
   slash_api_name: research-pipeline
   exposed_as_slash: true

   agents:
     - api_name: pipeline-researcher
       display_name: Pipeline Researcher
       user_model: <YOUR_MODEL_API_NAME>
       system_prompt: |
         You are a researcher. Write 3 to 5 sentences explaining the user's topic in plain English. Do NOT add a summary or conclusion line — output ONLY the explanation paragraph.
     - api_name: pipeline-summarizer
       display_name: Pipeline Summarizer
       user_model: <YOUR_MODEL_API_NAME>
       system_prompt: |
         The previous assistant turn contains a research passage. Condense it into EXACTLY ONE sentence (max 25 words) that captures the most important fact. Output ONLY the one-sentence summary — no preface, no list, no quote of the original.
   flow:
     nodes:
       - {node_id: research_1, agent: pipeline-researcher}
       - {node_id: summarize_1, agent: pipeline-summarizer}
     edges:
       - {from: __start__, to: research_1}
       - {from: research_1, to: summarize_1}
       - {from: summarize_1, to: __end__}
   ```
4. Click **Validate** — green "Looks good — ready to save."
5. Click **Save** — banner says "Created 'Research Pipeline'."
6. Click the **back arrow** to return to the Flows list.
7. **Confirm the `/research-pipeline` badge is visible at the top
   of the Research Pipeline card** — the YAML's `slash_api_name` +
   `exposed_as_slash: true` lines configured it inline (2026-05-27
   — A+D), no separate toggle step needed.
8. Click the **app logo** to return to chat.
9. **Hard-refresh** the page (Cmd+Shift+R / Ctrl+Shift+R).

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

- **Validation fails on `user_model: <YOUR_MODEL_API_NAME>`.** The
  literal `<YOUR_MODEL_API_NAME>` placeholder is still in the YAML —
  replace both occurrences with your actual model api_name (Part 1
  of Arrange above).
- **Validation says "Unknown user_model".** The string you pasted
  isn't an api_name on one of your enabled, available-for-flows
  models. Re-check the Providers page — look at the grey text below
  the model display name.
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

Requires Scenario 3 Part 1 (model enabled for flows). Find your model
api_name as in Scenario 5's Arrange.

#### Create the flow

1. Click **gear icon** → **Flows** → **+ New flow**.
2. Select-all + delete the starter template.
3. Paste this YAML, replacing both `<YOUR_MODEL_API_NAME>`
   occurrences. Note the `slash_api_name:` + `exposed_as_slash:
   true` lines — those make the flow slash-invocable on save, no
   separate toggle needed (2026-05-27 — A+D):
   ```yaml
   api_name: revise-loop
   display_name: Revise Loop
   description: Drafts a haiku and revises until a reviewer approves.
   slash_api_name: revise
   exposed_as_slash: true

   agents:
     - api_name: haiku-drafter
       display_name: Haiku Drafter
       user_model: <YOUR_MODEL_API_NAME>
       system_prompt: |
         Write a haiku (3 lines, roughly 5/7/5 syllables) on the user's topic. If a reviewer has previously critiqued an earlier draft, address every concern in your revision. Output ONLY the haiku — no preface, no commentary.
     - api_name: haiku-reviewer
       display_name: Haiku Reviewer
       user_model: <YOUR_MODEL_API_NAME>
       system_prompt: |
         The previous turn contains a haiku. Verify (a) exactly 3 lines, (b) roughly 5/7/5 syllables. If BOTH pass, write the single word "Approved." then end your reply with <<emit:passed>>. If either fails, write ONE short sentence stating what's wrong, then end with <<emit:failed>>.
       emits: [passed, failed]
   flow:
     nodes:
       - {node_id: draft_1, agent: haiku-drafter}
       - {node_id: review_1, agent: haiku-reviewer}
     edges:
       - {from: __start__, to: draft_1}
       - {from: draft_1, to: review_1}
       - {from: review_1, to: __end__, condition: passed}
       - {from: review_1, to: draft_1, condition: failed}
   ```
4. **Validate** → **Save** → back-arrow. **Confirm the `/revise`
   badge is visible at the top of the Revise Loop card.** If
   missing, re-open the flow and confirm both `slash_api_name:
   revise` and `exposed_as_slash: true` are present in the YAML.
5. App logo → hard-refresh.

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
  - says exactly **"Approved."** (one word, possibly with
    `<<emit:passed>>` visible in the text), OR
  - states one short critique sentence (possibly with
    `<<emit:failed>>` visible).
- [ ] If the reviewer **approved**, the flow ends — spinning logo
  disappears, Stop reverts to Send. Done.
- [ ] If the reviewer **rejected**, the spinning logo flips back
  to **"Haiku Drafter..."** within a beat and a NEW draft bubble
  streams in (a revision). Followed by another reviewer bubble.
- [ ] The loop continues until reviewer **approves** (usually
  within 1–3 revisions for this prompt). Final state: an
  "Approved." bubble, spinning logo gone.

### If something looks off

- **The reviewer NEVER approves and the flow keeps looping.**
  LangGraph's default recursion limit (25 steps) eventually halts
  the run. If you see >5 draft/review cycles, the reviewer is too
  strict for this topic — try a different topic (e.g.
  `cherry blossoms`) which haiku models tend to handle cleanly.
- **The reviewer's reply contains `<<emit:passed>>` or
  `<<emit:failed>>` visibly in the bubble.** That's expected —
  the emit token is part of the reply text today. It's the
  routing signal; the bubble itself isn't hiding it.
- **Only one draft + one reviewer bubble appear, then the flow
  ends WITHOUT either an Approved or a revision.** The reviewer
  forgot to include the emit token. The flow then takes the
  `default` (unmatched) edge — but neither edge above is marked
  `default`, so the run terminates. Retry; LLMs occasionally drop
  the token.
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

Requires Scenario 3 Part 1. Find your model api_name as in
Scenario 5.

#### Create the flow

1. Settings → Flows → **+ New flow**.
2. Select-all + delete starter template.
3. Paste this YAML, replacing every `<YOUR_MODEL_API_NAME>`:
   ```yaml
   api_name: triage
   display_name: Triage Router
   description: Classifies the user's question into code, math, or general and routes to a specialist.
   slash_api_name: triage
   exposed_as_slash: true

   agents:
     - api_name: triage-router
       display_name: Triage Router
       user_model: <YOUR_MODEL_API_NAME>
       system_prompt: |
         Classify the user's question into EXACTLY ONE of: "code" (anything about programming), "math" (numbers, equations, formulas), or "general" (everything else). Reply with one short sentence stating your classification — e.g. "Classified as code." — then end with <<emit:code>>, <<emit:math>>, or <<emit:general>>. Do NOT answer the question yourself.
       emits: [code, math, general]
     - api_name: triage-coder
       display_name: Coder Specialist
       user_model: <YOUR_MODEL_API_NAME>
       system_prompt: |
         You are a programming specialist. Answer the user's question with concise code or a 1-2 sentence explanation. Begin your reply with the literal text "[CODE]".
     - api_name: triage-mathematician
       display_name: Math Specialist
       user_model: <YOUR_MODEL_API_NAME>
       system_prompt: |
         You are a math specialist. Answer with the relevant formula or short calculation. Begin your reply with the literal text "[MATH]".
     - api_name: triage-generalist
       display_name: Generalist
       user_model: <YOUR_MODEL_API_NAME>
       system_prompt: |
         Answer the user's question in 1-2 plain sentences. Begin your reply with the literal text "[GENERAL]".
   flow:
     nodes:
       - {node_id: router_1, agent: triage-router}
       - {node_id: coder_1, agent: triage-coder}
       - {node_id: math_1, agent: triage-mathematician}
       - {node_id: general_1, agent: triage-generalist}
     edges:
       - {from: __start__, to: router_1}
       - {from: router_1, to: coder_1, condition: code}
       - {from: router_1, to: math_1, condition: math}
       - {from: router_1, to: general_1, condition: general}
       - {from: coder_1, to: __end__}
       - {from: math_1, to: __end__}
       - {from: general_1, to: __end__}
   ```
4. **Validate** → **Save** → back-arrow. **Confirm the `/triage`
   badge is visible at the top of the card** (configured inline
   via the YAML's `slash_api_name` + `exposed_as_slash: true`
   lines, 2026-05-27 — A+D).
5. App logo → hard-refresh.

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
  The router's emit token didn't match any conditional edge. Most
  likely the router forgot to include `<<emit:...>>`. Retry the
  run with a fresh chat.
- **All three runs end up in the Generalist branch regardless of
  question.** Either (a) the router is always emitting `general`
  (model can't distinguish — try a stronger model), or (b) the
  `general` edge was somehow marked the default and is matching
  every fall-through. Check the YAML.

---

## Scenario 8 — Plan & Execute (planner → executor)

### Goal
Prove that one agent can produce a structured plan as text and a
downstream agent can read it from conversation history and act on
it. The two agents are distinct nodes with different roles.

### Arrange (one-time setup for this scenario)

Requires Scenario 3 Part 1. Find your model api_name as in
Scenario 5.

#### Create the flow

1. Settings → Flows → **+ New flow**.
2. Select-all + delete starter template.
3. Paste, replacing every `<YOUR_MODEL_API_NAME>`:
   ```yaml
   api_name: plan-and-do
   display_name: Plan & Do
   description: A planner outlines steps, then an executor performs them.
   slash_api_name: plan-and-do
   exposed_as_slash: true

   agents:
     - api_name: plan-planner
       display_name: Planner
       user_model: <YOUR_MODEL_API_NAME>
       system_prompt: |
         The user asks you to perform a task. Do NOT perform it yourself. Output a numbered list of 3 to 5 concrete steps that an executor would follow. Begin with the literal line "Plan:" then list each step on its own line ("1. ...", "2. ...", etc.). No commentary after the list.
     - api_name: plan-executor
       display_name: Executor
       user_model: <YOUR_MODEL_API_NAME>
       system_prompt: |
         The previous assistant turn contains a "Plan:" with numbered steps. Execute each step by writing exactly one line per step that begins with "Step N:" and describes what you did in 5-10 words (you have no real tools — narrate plausibly). End your reply with the single word "Done." on its own line.
   flow:
     nodes:
       - {node_id: plan_1, agent: plan-planner}
       - {node_id: exec_1, agent: plan-executor}
     edges:
       - {from: __start__, to: plan_1}
       - {from: plan_1, to: exec_1}
       - {from: exec_1, to: __end__}
   ```
4. **Validate** → **Save** → back-arrow. **Confirm the
   `/plan-and-do` badge is visible at the top of the card**
   (configured inline via the YAML's `slash_api_name` +
   `exposed_as_slash: true` lines, 2026-05-27 — A+D).
5. App logo → hard-refresh.

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

Requires Scenario 3 Part 1. Find your model api_name as in
Scenario 5.

#### Create the flow

1. Settings → Flows → **+ New flow**.
2. Select-all + delete starter template.
3. Paste, replacing every `<YOUR_MODEL_API_NAME>`:
   ```yaml
   api_name: two-stage-form
   display_name: Two-Stage Form
   description: Collect identity, then preferences, then summarise.
   slash_api_name: two-stage-form
   exposed_as_slash: true

   agents:
     - api_name: stage-1-collector
       display_name: Stage 1 Collector
       user_model: <YOUR_MODEL_API_NAME>
       system_prompt: |
         You collect basic identity. You MUST call the ask_user tool EXACTLY ONCE to collect: (1) "name" — first name (text, required); (2) "city" — city the user lives in (text, required). After the user submits the form, write ONE short line: "Got it: <name> in <city>." then stop. Do NOT call ask_user a second time.
       tools: [ask_user]
     - api_name: stage-2-collector
       display_name: Stage 2 Collector
       user_model: <YOUR_MODEL_API_NAME>
       system_prompt: |
         You collect an activity preference. You MUST call the ask_user tool EXACTLY ONCE to collect: (1) "activity" — favourite weekend activity (text, required). After the user submits, write one summary sentence that mentions the activity AND repeats the earlier name + city from the conversation. End with "All done." Do NOT call ask_user a second time.
       tools: [ask_user]
   flow:
     nodes:
       - {node_id: stage1_1, agent: stage-1-collector}
       - {node_id: stage2_1, agent: stage-2-collector}
     edges:
       - {from: __start__, to: stage1_1}
       - {from: stage1_1, to: stage2_1}
       - {from: stage2_1, to: __end__}
   ```
4. **Validate** → **Save** → back-arrow. **Confirm the
   `/two-stage-form` badge is visible at the top of the card**
   (configured inline via the YAML's `slash_api_name` +
   `exposed_as_slash: true` lines, 2026-05-27 — A+D).
5. App logo → hard-refresh.

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
  Re-open the agent in settings, verify the prompt matches what
  you pasted exactly.

---

## Scenario 10 — Aggregator (parallel fan-out + synthesis)

### Goal
Prove that a flow can fan-out the user's question to three agents
running in PARALLEL, each producing its own perspective, then fan-in
to a synthesizer agent that reads all three and writes a unified
answer. Tests the comma-separated `from` / `to` fan-out + fan-in
syntax end-to-end.

### Arrange (one-time setup for this scenario)

Requires Scenario 3 Part 1 (model enabled for flows). Find your model
api_name as in Scenario 5.

#### Create the flow

1. Settings → Flows → **+ New flow**.
2. Select-all + delete starter template.
3. Paste, replacing every `<YOUR_MODEL_API_NAME>`:
   ```yaml
   api_name: aggregate
   display_name: Multi-Perspective Aggregator
   description: Gets three perspectives in parallel, then synthesises them.
   slash_api_name: aggregate
   exposed_as_slash: true

   agents:
     - api_name: agg-technical
       display_name: Technical Perspective
       user_model: <YOUR_MODEL_API_NAME>
       system_prompt: |
         Answer the user's question from a TECHNICAL perspective in 1-2 sentences. Begin your reply with the literal text "[TECHNICAL]".
     - api_name: agg-practical
       display_name: Practical Perspective
       user_model: <YOUR_MODEL_API_NAME>
       system_prompt: |
         Answer the user's question from a PRACTICAL / everyday perspective in 1-2 sentences. Begin your reply with the literal text "[PRACTICAL]".
     - api_name: agg-historical
       display_name: Historical Perspective
       user_model: <YOUR_MODEL_API_NAME>
       system_prompt: |
         Answer the user's question from a HISTORICAL perspective in 1-2 sentences. Begin your reply with the literal text "[HISTORICAL]".
     - api_name: agg-synthesizer
       display_name: Synthesizer
       user_model: <YOUR_MODEL_API_NAME>
       system_prompt: |
         The previous assistant turns contain three perspectives on the user's question, each prefixed with [TECHNICAL], [PRACTICAL], or [HISTORICAL]. Write a single 2-3 sentence synthesis that EXPLICITLY weaves together insights from ALL THREE perspectives — name each perspective by its label at least once. Begin your reply with the literal text "[SYNTHESIS]".
   flow:
     nodes:
       - {node_id: tech_1, agent: agg-technical}
       - {node_id: prac_1, agent: agg-practical}
       - {node_id: hist_1, agent: agg-historical}
       - {node_id: synth_1, agent: agg-synthesizer}
     edges:
       - {from: __start__, to: "tech_1,prac_1,hist_1"}
       - {from: "tech_1,prac_1,hist_1", to: synth_1}
       - {from: synth_1, to: __end__}
   ```
4. **Validate** → **Save** → back-arrow. **Confirm the `/aggregate`
   badge is visible at the top of the card** (configured inline
   via the YAML's `slash_api_name` + `exposed_as_slash: true`
   lines, 2026-05-27 — A+D).
5. App logo → hard-refresh.

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
  runs.** The fan-out didn't fire — either the comma list in
  `from: __start__, to: "tech_1,prac_1,hist_1"` is mis-quoted in
  the YAML (must be a single string, not a YAML list), or the
  validator rejected it silently. Re-check by clicking **Validate**
  on the flow — it should show "Looks good".
- **The synthesizer's bubble doesn't mention all three labels.**
  The synthesizer didn't see all three perspective turns in
  conversation history, OR it ignored the instruction. Re-read its
  bubble — if it summarises broadly without naming the labels, it's
  a content miss but a structural pass (the four bubbles did
  appear in order). Mark partial.
- **Bubbles appear in the wrong order — e.g. synthesizer streams
  BEFORE all three perspectives have finished.** This is a real
  bug. The fan-in edge `"tech_1,prac_1,hist_1" → synth_1` should
  block until ALL three branches complete. Capture screenshots and
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

## Scenario 15 — Agent card shows which flows use it (reverse-reference pills)

### Goal
Prove that the Agents page lists, on each agent card, the flows that
currently reference that agent — so you can answer "what breaks if I
edit this agent?" without scanning every flow's YAML.

### Arrange (one-time setup for this scenario)
Requires Scenarios 3, 5, and 6 to have been run (those create
`research-agent`, `pipeline-researcher`, `pipeline-summarizer`,
`haiku-drafter`, `haiku-reviewer` and the flows that reference them).

### Act
1. Click the **gear icon** in the bottom-left.
2. Click **Agents** in the settings sidebar.

### Assert
- [ ] Each agent card now has a third info row that begins with
  **"Used by:"**.
- [ ] The **Research Agent** card's "Used by:" row contains a single
  pill labelled `research-flow`. Clicking the pill navigates to the
  Research Flow editor.
- [ ] The **Pipeline Researcher** card's "Used by:" row contains a
  single pill labelled `research-pipeline`.
- [ ] The **Pipeline Summarizer** card's "Used by:" row contains a
  single pill labelled `research-pipeline` (same flow as above).
- [ ] The **Haiku Drafter** and **Haiku Reviewer** cards' "Used by:"
  rows each contain a single pill labelled `revise-loop`.
- [ ] Any agent that is NOT referenced by any flow shows
  **"Used by: no flows"** in italic grey text.
- [ ] Clicking any flow pill navigates to that flow's editor and
  does NOT trigger the agent editor (the pill is its own link, not
  part of the card-wide click target).

### If something looks off
- **"Used by:" row is missing entirely on every card.** The Agents
  view didn't render the new row at all — pull the FE branch and
  rebuild, or refresh hard.
- **"Used by: no flows" on a card you know is referenced.** The
  flow list cache hasn't refreshed since you added the flow. Hard
  refresh (Cmd+Shift+R / Ctrl+Shift+R) the page.
- **Clicking the pill opens the agent editor instead of the flow
  editor.** Bug — the pill's link is being shadowed by the
  card-wide click target. Report with a screenshot.

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
