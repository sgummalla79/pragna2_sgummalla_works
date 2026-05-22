/** Default YAML loaded into the editor when creating a new flow. */
export const STARTER_FLOW_YAML = `api_name: my-flow
display_name: My Flow
description: A two-step intake → review pipeline.
metadata:
  max_revisions: 3

agents:
  - api_name: intake
    display_name: Intake
    user_model: REPLACE_WITH_YOUR_MODEL_API_NAME
    system_prompt: |
      You are an intake agent. Produce a structured brief from the
      user's request.
    emits: [default]

  - api_name: reviewer
    display_name: Reviewer
    user_model: REPLACE_WITH_YOUR_MODEL_API_NAME
    system_prompt: |
      Quality-check the brief.
      End your reply with <<emit:passed>> or <<emit:failed>>.
    emits: [passed, failed]

flow:
  nodes:
    - {node_id: intake_1, agent: intake}
    - {node_id: review_1, agent: reviewer}
  edges:
    - {from: __start__, to: intake_1}
    - {from: intake_1, to: review_1}
    - {from: review_1, to: __end__, condition: passed}
    - {from: review_1, to: intake_1, condition: failed}
`;
