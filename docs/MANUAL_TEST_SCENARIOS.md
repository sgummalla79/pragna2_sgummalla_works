# Manual Test Scenarios (not automatable)

Companion to [`FRONTEND_TEST_SCENARIOS.md`](FRONTEND_TEST_SCENARIOS.md).
The scenarios here verify behaviours that **cannot** be covered by the
Playwright suite — either because they depend on a runtime capability the
app doesn't expose yet, or because the thing under test is a *visual /
timing* quality (animation smoothness, concurrent reveals) that an
assertion can't meaningfully judge.

Each scenario lists **why it's manual**, the **prerequisites**, the
**steps**, and the **checks**. Tick the checks; if one fails, note what
you saw and report it. When a missing runtime primitive ships, promote
the scenario to a Playwright spec and delete it from here.

> Style + setup mirror `FRONTEND_TEST_SCENARIOS.md` — do that doc's
> "first-time setup" once before running anything below.

---

## M1 — Smooth streaming reveal (single reply)

**Why manual:** the *feel* of a steady typewriter reveal is a visual/timing
quality. The e2e suite (`scenario-01-plain-chat`) only asserts the
mechanism engaged (the `chat-markdown--animate` wrapper appears while
streaming); it cannot judge whether the motion looks smooth.

**Prerequisites:** a working chat model (real provider key configured).

**Steps**
1. Open a new chat.
2. Send: `Explain how a hash map works, with a short example.`
3. Watch the assistant reply as it generates.

**Checks**
- [ ] Text appears as a **steady, continuous reveal** (like typing), not
      in sudden chunks/jumps ("dumping").
- [ ] Each paragraph / heading / list / code block **fades in** as it
      starts, rather than snapping in fully-formed.
- [ ] The pace reads as deliberate (~25 characters/second), not a flash.
- [ ] When the reply finishes, the full text is shown with no leftover
      half-revealed line.

**Tuning reference:** the cadence is produced **server-side** by the
Response Gateway pacer — `pragna2-api/src/constants.py`
(`STREAM_PACE_FLOOR_CPS`, `STREAM_PACE_CEILING_CPS`,
`STREAM_PACE_MAX_LAG_SECONDS`). The FE only renders + fades. This is what
makes the smoothness **model-agnostic** (Claude and Gemini look the same);
verify M1 with **both** a Claude-class and a fast model (e.g. Gemini Flash)
— both should type in calmly, neither should "dump."

---

## M2 — Reduced-motion preference is respected

**Why manual:** requires toggling an OS-level accessibility setting, which
the browser-tier suite doesn't control.

**Prerequisites:** chat model configured; ability to set the OS
"Reduce motion" preference (macOS: System Settings → Accessibility →
Display → Reduce motion; Windows: Settings → Accessibility → Visual
effects → Animation effects off).

**Steps**
1. Turn **Reduce motion ON** at the OS level.
2. Reload the app, open a chat, and send any question.

**Checks**
- [ ] The reply still streams in (text appears progressively).
- [ ] There is **no fade/slide animation** on the blocks — they appear
      without the entrance motion.
- [ ] Turn Reduce motion back OFF, reload, send again → the fade returns.

---

## M3 — Reasoning timeline (extended thinking)

**Why manual:** requires a thinking-capable model with thinking enabled
*and* a real provider emitting reasoning blocks — the trace cannot be
produced deterministically in e2e (it's model-dependent), so there's
nothing stable for Playwright to assert.

**Prerequisites:** a thinking-capable model (e.g. an Anthropic model with
extended thinking) selected for the conversation, with **Extended
thinking enabled** for the conversation.

**Steps**
1. Confirm Extended thinking is ON for the conversation.
2. Send a question that invites reasoning, e.g.
   `What are the mandatory tools for a hallucination-free research agent
   with a human in the loop? Think it through.`
3. Watch the reply, then reload the page and reopen the same conversation.

**Checks**
- [ ] A collapsible **Reasoning** disclosure appears with the assistant
      turn (a summary line + chevron).
- [ ] Expanding it shows the reasoning trace on a timeline (a thinking
      node with the trace, then a **Done** node).
- [ ] After **reload**, the reasoning is **still there** (it was
      persisted) — collapsed by default.
- [ ] A reply produced **without** thinking enabled shows **no**
      reasoning disclosure.

---

## M4 — Concurrent smooth reveal during a parallel fan-out  ⛔ BLOCKED

**Why manual:** verifies that **every** sub-agent reply animates its
smooth reveal *at the same time* during a parallel (per-item) fan-out.
Playwright can't drive this because the runtime fan-out that produces
multiple concurrent assistant bubbles **does not exist yet** — see
`scenario-16` / `scenario-17` (authoring-only) and BE
`future-discussions.md` #35: today's `LLMAgentNode` writes a reply
*string*, so a dispatching edge degrades to a single-instance scalar wrap
instead of N parallel instances.

The per-turn streaming detection that powers this is unit-tested
(`useChatSession.attach.test.tsx` → "tracks EVERY concurrently-streaming
turn"), so the FE is **ready**; this scenario becomes runnable only once
the BE can write a real list to a slot and dispatch N instances.

**Prerequisites (not yet satisfiable):**
- A flow with a **per-item dispatch** edge (author it via the steps in
  `scenario-16`).
- An upstream node that writes a real **list** to the `items_slot` (the
  missing primitive — #35).
- A chat model configured.

**Steps (for when it's unblocked)**
1. Run the per-item dispatch flow via its slash command so it fans out to
   several sub-agent instances at once.
2. Watch the moment the parallel instances begin replying.

**Checks (for when it's unblocked)**
- [ ] **More than one** assistant bubble is revealing text **at the same
      time** (each typing smoothly), not just the most recent one.
- [ ] Each bubble's blocks fade in independently as that instance streams.
- [ ] As each instance finishes, its bubble settles to full text while the
      others keep animating.
- [ ] When all instances finish, every bubble shows its complete reply.

> When this ships: add `scenario-18-dispatch-runtime.spec.ts` asserting
> `>= 2` elements match `.chat-markdown--animate` concurrently during the
> run, then remove this scenario.
