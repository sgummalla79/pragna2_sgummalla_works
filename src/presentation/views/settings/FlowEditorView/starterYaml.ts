/** Default YAML loaded into the editor when creating a new flow.
 *
 * Intentionally minimal: references two agents by `api_name` and leaves
 * the inline `agents:` block out. Authoring agents lives at
 * Settings → Agents — the flow stays focused on topology.
 *
 * The inline `agents:` block in YAML still works (use it for one-off
 * agents specific to a single flow), it's just not the recommended
 * default.
 *
 * R6b notes
 * ---------
 * * ``description`` is load-bearing — the default chat agent reads it
 *   to decide *when* to propose this flow to the user. Treat it like a
 *   tool description: short, specific, outcome-oriented.
 * * Human-in-the-loop pauses are driven by the universal ``ask_user``
 *   tool. Bind it to an agent via the agent's ``tools:`` list at
 *   Settings → Agents, then steer it from the system prompt:
 *
 *       tools: [ask_user]
 *       system_prompt: |
 *         Before producing your summary, use ask_user to collect:
 *         - stack (text, required): "Current tech stack"
 *         - priority (select, options=[high, medium, low]): "Priority"
 *         allow_text_input=true.
 *
 *   At runtime the LLM emits an ``ask_user`` tool call with that
 *   schema, the flow pauses, the user fills the rendered form, and
 *   the run resumes with the structured response. See the Flow
 *   Authoring Guide for the full pattern.
 */
export const STARTER_FLOW_YAML = `# Tip: create + edit agents at Settings → Agents,
# then reference them below by their api_name.
#
# The 'description' field below is what the default chat agent reads to
# decide WHEN to propose this flow to the user. Be specific and
# outcome-oriented (e.g. "Migration assessment for legacy Java systems",
# not "Helps with architecture").
#
# Human-in-the-loop: give an agent the 'ask_user' tool (via Settings →
# Agents → Tools) and instruct it in the agent's system prompt to call
# ask_user with the form fields you want. The flow will pause at that
# tool call and resume once the user submits the form.

api_name: my-flow
display_name: My Flow
description: A two-step intake → review pipeline.
metadata:
  max_revisions: 3

flow:
  nodes:
    - {node_id: intake_1, agent: REPLACE_WITH_AGENT_API_NAME}
    - {node_id: review_1, agent: REPLACE_WITH_AGENT_API_NAME}
  edges:
    - {from: __start__, to: intake_1}
    - {from: intake_1, to: review_1}
    - {from: review_1, to: __end__, condition: passed}
    - {from: review_1, to: intake_1, condition: failed}
`;
