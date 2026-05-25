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

## Scenario 3 — Run a slash command (skill)

### Goal
Create a custom slash command (e.g. `/research`) and prove that typing
it in the chat triggers a different code path than a normal message.

### Arrange (one-time setup for this scenario)

You need to create a skill first. Do this once and you can re-use it
for every Scenario 3 run.

1. Click the **gear icon** in the bottom-left (Settings).
2. In the settings sidebar, click **Skills** (under "Workflows").
3. Click the **New skill** button (top-right).
4. Fill in the form:
   - **Slash command name**: `research`
   - **Description**: `Run a short research summary on a topic.`
   - **Model (optional)**: pick the model you enabled in setup step E,
     or leave as "None" (the chat default will be used).
5. Click **Create skill**.
6. A new card appears showing **/research** in the skill list.
7. Click the **app logo** (top-left) to return to chat.

### Act

1. Click **+ New chat** in the sidebar.
2. Click the text box at the bottom.
3. Type exactly (with the slash at the start): `/research what is
   retrieval-augmented generation?`
4. Press **Enter**.

### Assert

- [ ] Your message appears on the right side, **including the literal
  `/research` part** (the slash is not stripped).
- [ ] The spinning logo appears with a label — it might say
  **"Researching..."** or something else specific to the skill, not
  the generic "Drafting response..." (this proves the skill's flow
  is running, not the default chat).
- [ ] An AI reply streams in answering the research question.
- [ ] When done, the spinning logo disappears.

### If something looks off

- **Nothing happens / you get an error "Skill not found".** Go back to
  Settings → Skills and double-check that `/research` is in the list
  AND the toggle next to it is **on**.
- **The reply ignores your question and gives a generic answer about
  research.** That's still a pass for this scenario — we're testing
  that the slash command routes correctly, not the quality of the
  reply.
- **Spinning logo says "Drafting response..." instead of something
  research-specific.** This may mean the slash didn't route — the app
  sent your message to the default chat path. Make sure you typed
  `/research` (starting with `/`, no space before it).

---

## Scenario 4 — Slash command that opens a form

### Goal
Combine Scenarios 2 and 3 — prove that a slash command can also pop
up the form.

### Arrange (one-time setup for this scenario)

This scenario reuses the `/research` skill from Scenario 3, but we
need to teach the skill's underlying agent to use the form. This is
the trickiest setup in the doc — follow carefully.

1. Click the **gear icon** in the bottom-left (Settings).
2. Click **Skills**. You should see the `/research` skill in the list.
3. Each skill has an underlying **agent** that controls its behaviour.
   Click **Agents** in the settings sidebar (just above Skills).
4. Find the agent named **research** (or with the same name as your
   skill). Click the **pencil icon** to edit it.
5. In the agent editor:
   - Find the **System prompt** text area. Add this line at the end:
     ```
     Before answering any question, you MUST call the ask_user tool to
     ask the user for two things: the topic to research, and the
     desired depth (short, medium, long). Then incorporate their
     answers into your reply.
     ```
   - Find the **Tools** field (lower down on the page). Add
     `ask_user` to the list (type it and press Enter, or pick from
     the dropdown if it appears).
6. Click **Save**.
7. Click the **app logo** to return to chat.

### Act

1. Click **+ New chat** in the sidebar.
2. Click the text box at the bottom.
3. Type: `/research`
4. Press **Enter**.

### Assert

- [ ] Your message (`/research`) appears on the right side.
- [ ] The spinning logo appears briefly with a research-specific label.
- [ ] A **form pops up** above the text box with two fields — one for
  topic, one for depth.
- [ ] Fill in: topic = `quantum computing` (or anything), depth =
  `short`. Click **Submit**.
- [ ] The form disappears.
- [ ] The spinning logo reappears.
- [ ] An AI reply streams in that's about your chosen topic at roughly
  your chosen depth.

### If something looks off

- **No form appears, AI just answers.** Edit the agent again
  (Settings → Agents → edit) and make sure the system-prompt
  instruction about ask_user is there, AND `ask_user` is in the
  Tools list. Both are needed.
- **Form appears but only has one field.** The AI is choosing what
  fields to show based on the system prompt — re-read the prompt
  text in step 5 and make sure it mentions BOTH "topic" AND "depth".
- **Form pops up correctly but submitting throws an error.** Note the
  error text exactly and report it — this is a real bug.

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
