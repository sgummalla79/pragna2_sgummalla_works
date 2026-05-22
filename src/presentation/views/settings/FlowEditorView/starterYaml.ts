/** Default YAML loaded into the editor when creating a new flow.
 *
 * Intentionally minimal: references two agents by `api_name` and leaves
 * the inline `agents:` block out. Authoring agents lives at
 * Settings → Agents — the flow stays focused on topology.
 *
 * The inline `agents:` block in YAML still works (use it for one-off
 * agents specific to a single flow), it's just not the recommended
 * default.
 */
export const STARTER_FLOW_YAML = `# Tip: create + edit agents at Settings → Agents,
# then reference them below by their api_name.

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
