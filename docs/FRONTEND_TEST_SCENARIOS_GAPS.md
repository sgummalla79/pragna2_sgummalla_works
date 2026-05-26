# Frontend Test Scenarios — Pattern Gaps

Companion doc to [FRONTEND_TEST_SCENARIOS.md](FRONTEND_TEST_SCENARIOS.md).

The 12 agentic-flow patterns commonly discussed in the literature (Sequential, Orchestrator → Subagent, ReAct, Plan & Execute, Reflection, Multi-Agent Debate, Tree of Thought, Tool-Use, Routing, Event-Driven, Memory-Augmented, HITL) don't all map cleanly onto the current product. This doc records which patterns are NOT currently testable as user-facing manual scenarios, what's missing in the agentic-flow feature, and the closest approximation a tester could reach today.

When a missing primitive ships, move the pattern out of this doc into a new scenario in FRONTEND_TEST_SCENARIOS.md.

---

## Patterns already covered by existing scenarios

These two patterns ARE doable but don't get their own scenarios — they're exercised by the existing scenarios listed below.

| Pattern | Why no standalone scenario | Existing coverage |
|---|---|---|
| **3. ReAct (Reason + Act)** | The `ReactFlowAgentNode` runtime IS the ReAct loop — when an agent has `tools: [...]` bound, every invocation runs through `langgraph.prebuilt.create_react_agent`, which does chat → reason-about-tool-need → tool-call → tool-result → continue, until the LLM emits a final answer. There is no separate "ReAct mode" to toggle; it's whatever the agent does when it has tools. | Scenario 4 (slash flow with `ask_user`) is a single-tool ReAct loop. Scenario 9 (multi-pause HITL) is the same loop running across two flow nodes. |
| **8. Tool-Use / Function Calling** | This is a subset of ReAct — same runtime path. The only built-in tool the product ships today is `ask_user`. MCP tools (the user-BYO path) require registering an MCP server, which is dev-style setup outside the QA scope of these scenarios. | Scenarios 2 (default chat with `ask_user`) and 4 (slash flow with `ask_user`) cover the tool-use surface a manual tester can reach without dev setup. |

A standalone "ReAct multi-tool" scenario would require ≥2 distinct tools the tester could trigger via natural-language prompt. Today the only second tool is MCP-discovered — adding that to QA needs an MCP server registration step, which is out of scope for a non-technical tester. When more built-in tools (`http_get`, `read_file`, `write_file`, etc.) are seeded, write a dedicated multi-tool ReAct scenario.

Note: the **Aggregator** pattern (parallel fan-out + synthesis) is doable today via comma-separated `from`/`to` edges and is covered by Scenario 10 (`/aggregate`). The harder ToT / Debate variants below remain not testable for the reasons listed.

---

## Patterns NOT currently testable

For each pattern below: a one-paragraph definition, what the pattern requires as a runtime primitive, what's missing in the product, the closest approximation today, and the prerequisites for shipping a real test scenario.

### 2. Orchestrator → Subagent Pattern

**Pattern definition.** One "orchestrator" agent decomposes a user request into sub-tasks, then DYNAMICALLY dispatches each sub-task to a specialist "subagent" of its choosing. The orchestrator may spawn subagents in parallel, wait for their results, and synthesize a final answer. Critically, the orchestrator decides AT RUNTIME which subagents to invoke and in what configuration — not the flow author at design time.

**What this needs as a primitive.**
- A runtime call like `spawn_subagent(agent_api_name, prompt)` that the orchestrator's LLM can invoke as a tool (returning the subagent's reply as the tool result), OR
- A "subagent" node type whose target agent is selected dynamically from a state variable the orchestrator wrote.

**What's missing in the product today.**
- Flow edges are STATIC, declared in YAML. The set of downstream nodes from any given node is fixed at design time.
- There is no `spawn_subagent` built-in tool. The only built-in is `ask_user`.
- An agent CAN have other tools bound (via MCP), but those return tool results, not agent invocations. Wrapping an agent as a tool is not a supported primitive.

**Closest approximation today.** Static routing — author a flow where the orchestrator agent uses emit-labels (`emits: [researcher, summarizer, translator]`) and each label has a conditional edge to a fixed downstream node. This is exactly Scenario 7 (`/triage`). The trade-off: the SET of subagents is fixed at flow-author time, and the orchestrator can dispatch to only ONE subagent per turn (not in parallel). For most "router-style" use-cases this is sufficient; for true dynamic orchestration where the LLM picks N subagents on the fly, it isn't.

**Prerequisites for a real scenario.** Either (a) a `spawn_subagent` built-in tool whose `config` lists the agent api_names it may dispatch to, plus a wiring in `BuiltinHandlerRegistry`; OR (b) a new `flow_nodes.dispatch_kind = 'dynamic'` mode where the target node is read from a state key. Either change touches the schema (new tool or new node kind), the runtime (FlowBuilder + new handler), and the YAML schema doc.

---

### 6. Multi-Agent Debate Pattern

**Pattern definition.** Two or more agents (e.g. "Pro" and "Con", or "Proposer", "Critic", "Judge") iteratively exchange arguments on a question. A debate orchestrator (often a separate "judge" agent) decides when consensus is reached or when to stop. The defining features: structured turn-taking, a shared argumentation transcript distinct from the user-facing chat, and a stop condition that depends on the debate's state (not just a hard turn limit).

**What this needs as a primitive.**
- A "debate" or "loop-with-condition" topology primitive — repeat node A then node B until a separate node C signals stop.
- A shared scratchpad / blackboard channel that agents write to and read from, distinct from the conversation history the user sees. Without this, every debate round appears as user-visible bubbles and the chat becomes unreadable.
- A clean way to bound iterations dynamically based on agent output (not just the recursion limit).

**What's missing in the product today.**
- No shared-state primitive beyond `conversation.messages`. Every agent reply is a user-visible assistant bubble.
- The reflection-loop topology (Scenario 6) supports loop-back-on-emit, but the loop counter is implicit (LangGraph's recursion limit, default 25) and there's no way for a separate "judge" node to terminate the loop early without joining the loop topology itself.
- No notion of "internal turns" vs "external turns" — every agent turn is a message in the visible transcript.

**Closest approximation today.** A FIXED-ROUND ping-pong: author a flow `__start__ → Pro → Con → Pro → Con → Judge → __end__` with each arrow explicit. This works for a debate of a known fixed number of rounds, but: (a) every agent turn shows as a chat bubble, cluttering the UI; (b) you can't "debate until consensus" — only "debate for exactly N rounds, then judge"; (c) the agents don't see a debate scratchpad, only the prior assistant turns mixed in with the original user prompt.

**Prerequisites for a real scenario.** Either (a) a `loop_until` edge construct with a separate evaluator node (`{from: con_1, to: judge_1}`, `{from: judge_1, to: pro_1, condition: continue}`, `{from: judge_1, to: __end__, condition: stop}`) — currently NOT expressible because Scenario 6's loop works only when the EMITTER itself decides to loop, not a third party; OR (b) a hidden-scratchpad state channel + a way to mark certain nodes' outputs as "internal" so they don't surface as user-visible bubbles.

---

### 7. Tree of Thought (ToT) Pattern

**Pattern definition.** From one prompt, spawn N parallel candidate thoughts (often by sampling the same agent N times with different random seeds, or with N variations of the prompt). Each candidate is scored — either by the same agent in a self-critique pass or by a separate evaluator. Top-K candidates are kept; the rest are pruned. The kept candidates may themselves spawn more candidates, building a search tree. The final answer is read off the best leaf.

**What this needs as a primitive.**
- A "spawn N copies" fan-out (not the current fan-out, which spawns one of each of N DIFFERENT downstream nodes — here all N copies are the SAME node, run with different sampling parameters).
- A scoring function — either a built-in (BLEU, perplexity) or a separate evaluator agent — that produces a numeric or rank score per candidate.
- A top-K selection / pruning step.
- Iterative deepening — pruned candidates' state must be reapable so the search can re-enter from the top-K.

**What's missing in the product today.**
- Fan-out edges (`{from: a, to: b,c}`) only spawn DISTINCT downstream nodes. There's no "spawn N copies of the same node" syntax.
- No built-in scoring or ranking primitive.
- No iterative search topology — once a node's outputs propagate, there's no way to "go back" to that node with the top-K subset and continue.
- The PostgresSaver checkpoints state, but not in a way that supports branching the search tree from a saved point.

**Closest approximation today.** Hand-author a 2-branch fan-out with two slightly different prompts (e.g. "give a creative answer" + "give a conservative answer"), then fan-in to an evaluator agent that picks the better one. This is a tiny ToT — N=2, depth=1 — and it works structurally with current edges, but it requires every branch to be a separate node in the YAML (no programmatic spawning) and the "selection" is done by an LLM in plain text rather than as a structured top-K operation.

**Prerequisites for a real scenario.** A "spawn_n" node primitive that takes `count: N` and runs the same agent N times in parallel with sampling variation; a `select_top_k: K` primitive on the fan-in edge; a state shape that holds the list of candidates so the selector can rank them. Substantial new feature work — not on any current roadmap entry.

---

### 10. Event-Driven / Trigger Pattern

**Pattern definition.** A flow run is initiated by an external event — a cron schedule (every day at 9am), a webhook (Slack message arrives), a database trigger (new row inserted), a file-system event (file dropped in a watched folder), or a cross-flow signal (another flow's output). The user doesn't have to type a message in chat for the flow to run.

**What this needs as a primitive.**
- A "trigger" entity registered against a flow with a config (cron expression, webhook URL, event topic).
- A scheduler / event-bus that watches for triggers and starts flow runs against a synthetic conversation (or no conversation).
- Persistent worker process that survives without a connected web session.
- A way to surface the results — either by writing into a designated conversation, posting back to a webhook URL, or sending a notification.

**What's missing in the product today.**
- Every flow run today is initiated by a `POST /pragna/chat` or `POST /pragna/flows/{name}` from the FE, in the context of a logged-in user's open conversation.
- There is no scheduler component, no cron table, no webhook intake route, no event bus.
- There is no concept of a "service-account" or "non-user" execution context — flow runs are scoped to the requesting user.

**Closest approximation today.** None at the user-facing layer. A developer COULD `curl POST /pragna/chat` from a shell cron job using a service-account-style bearer token to simulate a scheduled run, but this isn't a tested or supported feature, and there's no UI to author / monitor such triggers.

**Prerequisites for a real scenario.** A `flow_triggers` table (flow_id, trigger_type, config), a worker process (separate from the API process) that consumes triggers, a UI to create / list / disable triggers, a webhook intake route. The trigger model is a substantial product addition; the test scenario would also need a way for the QA tester to FIRE the trigger (e.g. an "Invoke now" button) since waiting for a real cron tick is impractical.

---

### 11. Memory-Augmented Pattern

**Pattern definition.** An agent has access to a memory store that survives across conversations. Common forms: (a) episodic memory — "the user told me their name is Alex last week"; (b) semantic memory — "the user prefers concise replies"; (c) vector / RAG memory — "I have these 200 documents and I can search them by similarity"; (d) procedural memory — "I've learned how to handle this kind of request from prior attempts". The agent retrieves relevant memory before each turn and writes new memory on terminal events.

**What this needs as a primitive.**
- A persistent store with retrieval — at minimum a `user_memories` table keyed by `(user_id, scope)` with text + embeddings; ideally a pluggable vector store interface.
- A `recall(query)` / `remember(fact)` tool pair that agents can invoke.
- An indexing / embedding pipeline (and the operational cost of running it).
- A UI to inspect, edit, and clear stored memory (privacy + correctness).

**What's missing in the product today.**
- Conversation history IS persistent and IS available to every agent in a flow (via LangChain message history), but its scope is ONE conversation. Cross-conversation memory does not exist.
- The PostgresSaver checkpoints LangGraph STATE for in-flight episodes — that's a LangGraph runtime concern, NOT a user-fact store. It's keyed by `thread_id`, not by user; it's compacted opportunistically; and it's not surfaced as a retrieval primitive.
- There is no `vector_store` table, no embedding column on any existing table, no `recall` / `remember` built-in tool.
- The project's own future-discussions doc has flagged pgvector as eager-NOT-add (R8 settled decisions) — explicit choice to defer until a use-case warrants it.

**Closest approximation today.** None at the cross-conversation level. WITHIN one conversation, agents can implicitly "remember" earlier turns because the full message history is sent on every LLM call — that's what Scenarios 8 and 9 exercise (executor reads planner's plan; stage-2 form recalls stage-1 values). But once the conversation ends, the memory is gone from the agent's perspective on the next conversation.

**Prerequisites for a real scenario.** A `user_memories` table or `vector_store` extension (pgvector), a `recall` / `remember` built-in tool pair seeded into the `tools` table, a UI page under Settings to view and clear memory, and a defined privacy model (when does the user's memory get purged? what's encrypted at rest?). The scenario would be: "Run a chat in Conversation A where you tell the agent 'my name is Alex'. Open a new conversation B. Ask 'what's my name?'. The agent should answer 'Alex' via the recall tool." Cannot be written today.

---

## How to update this doc

When a pattern moves from "not testable" to "testable":

1. Author a real scenario in `FRONTEND_TEST_SCENARIOS.md` following the same shape as Scenarios 1-9.
2. Delete the corresponding section here.
3. Link the new scenario from the "Patterns already covered" table at the top with a one-line note describing how it maps.

When a pattern's prerequisites change (e.g. the product partially ships a primitive but not the full piece):

1. Update the "What's missing" section in-place — don't append; rewrite so the doc stays a current snapshot.
2. If the closest approximation is now substantially closer than before, refresh it too.
