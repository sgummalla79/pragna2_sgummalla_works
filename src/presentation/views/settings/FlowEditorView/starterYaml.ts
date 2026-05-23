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
 * R6a notes
 * ---------
 * * ``description`` is now load-bearing — the default chat agent reads
 *   it to decide *when* to propose this flow to the user. Treat it like
 *   a tool description: short, specific, outcome-oriented.
 * * The commented ``awaits_user`` block is a sneak-peek of R6b's HITL
 *   pause-for-input feature. It is parsed (no error) in R6a but has no
 *   runtime effect; the flow still runs one-shot end-to-end. Once R6b
 *   ships, uncomment to make a node ask the user a structured question
 *   mid-flow.
 */
export const STARTER_FLOW_YAML = `# Tip: create + edit agents at Settings → Agents,
# then reference them below by their api_name.
#
# The 'description' field below is what the default chat agent reads to
# decide WHEN to propose this flow to the user. Be specific and
# outcome-oriented (e.g. "Migration assessment for legacy Java systems",
# not "Helps with architecture").

api_name: my-flow
display_name: My Flow
description: A two-step intake → review pipeline.
metadata:
  max_revisions: 3

flow:
  nodes:
    - {node_id: intake_1, agent: REPLACE_WITH_AGENT_API_NAME}
    # R6b preview — uncomment to make a node pause and ask the user a
    # structured question (form + free text) before the flow continues:
    #
    # - node_id: intake_1
    #   agent: REPLACE_WITH_AGENT_API_NAME
    #   awaits_user:
    #     fields:
    #       - {name: stack, label: "Current tech stack", type: text, required: true}
    #       - {name: priority, label: "Priority", type: select, options: [high, medium, low]}
    #     allow_text_input: true
    #     submit_label: "Continue"
    - {node_id: review_1, agent: REPLACE_WITH_AGENT_API_NAME}
  edges:
    - {from: __start__, to: intake_1}
    - {from: intake_1, to: review_1}
    - {from: review_1, to: __end__, condition: passed}
    - {from: review_1, to: intake_1, condition: failed}
`;
