/**
 * Types for the visual flow editor (React Flow authoring).
 *
 * The editor's source of truth is a graph of React Flow nodes + edges
 * held in a Zustand store. Each agent node carries its flow-owned agent
 * definition INLINE (agents are flow-local since BE migration 0024 — no
 * cross-flow sharing). On Save the graph is serialised to YAML by
 * `graphToYaml` and persisted through the existing
 * `POST/PUT /api/flows[/{id}]/from-yaml` endpoint; YAML is never
 * hand-edited, only shown read-only via the "view source" dialog.
 */

import type { EdgeConditionValue } from '@/constants/edgeConditions';

/** Reserved graph-boundary node ids, shared with the backend YAML schema.
 *  Start is singleton (LangGraph has exactly one entry). End is the YAML
 *  sentinel; on the canvas multiple FE End instances may coexist
 *  (see endInstanceId() below) but all serialize to `to: __end__`. */
export const NODE_START = '__start__';
export const NODE_END = '__end__';

/** Multi-End: every End beyond the first carries a `::n` suffix on its FE
 *  node id (e.g. `__end__::2`). graphToYaml collapses suffixes back to
 *  `__end__`; buildEditorGraph rebuilds them from `metadata.end_routing`. */
const END_INSTANCE_SEPARATOR = '::';

/** Mint the next available End id given the End ids already on the canvas. */
export function nextEndInstanceId(existing: ReadonlySet<string>): string {
  if (!existing.has(NODE_END)) return NODE_END;
  let i = 2;
  while (existing.has(`${NODE_END}${END_INSTANCE_SEPARATOR}${i}`)) i += 1;
  return `${NODE_END}${END_INSTANCE_SEPARATOR}${i}`;
}

/** Whether a React-Flow node id refers to an End instance (any suffix). */
export function isEndInstanceId(id: string): boolean {
  return id === NODE_END || id.startsWith(`${NODE_END}${END_INSTANCE_SEPARATOR}`);
}

/** React Flow node `type` discriminators registered on the canvas. */
export const NODE_TYPE_AGENT = 'agent';
export const NODE_TYPE_BOUNDARY = 'boundary';

/** React Flow edge `type` for the connector (no inline picker post #33;
 *  edge condition derives from the source handle id for If/Else nodes). */
export const EDGE_TYPE_CONDITION = 'condition';

/** Source-handle id prefix on a branching agent's right-side ports. The
 *  segment after the prefix is the emit label, except `port:else` which
 *  maps to EDGE_CONDITIONS.DEFAULT (the always-fires else branch). */
export const PORT_HANDLE_PREFIX = 'port:';
export const PORT_HANDLE_ELSE = `${PORT_HANDLE_PREFIX}else`;
/** Build the source-handle id for a declared emit. */
export function portHandleFor(emit: string): string {
  return `${PORT_HANDLE_PREFIX}${emit}`;
}

/**
 * A flow-owned agent definition authored inline with its node. Mirrors
 * the YAML `agents:` entry. `userModel` is the model's api_name (the FE
 * `Model.modelName`), which is what the YAML references.
 */
export interface EditorAgent {
  apiName: string;
  displayName: string;
  description: string | null;
  /** The user_model api_name (= `Model.modelName`) this agent runs on. */
  userModel: string;
  systemPrompt: string;
  tools: string[];
  emits: string[];
}

/** Data carried by an agent node on the canvas. */
export interface AgentNodeData {
  /** Short label unique within the flow (the YAML `node_id`). */
  nodeId: string;
  /** The inline, flow-owned agent definition this node runs. */
  agent: EditorAgent;
  /** #26 per-node context-shaping slots (optional). */
  inputs?: string[];
  outputs?: string[];
  reducers?: Record<string, string>;
}

/** Data carried by a `__start__` / `__end__` boundary node. */
export interface BoundaryNodeData {
  boundary: typeof NODE_START | typeof NODE_END;
}

/** Data carried by a conditioned edge. */
export interface ConditionEdgeData {
  condition: EdgeConditionValue;
}

/** Flow-level metadata edited outside the canvas (header form). */
export interface FlowMeta {
  apiName: string;
  displayName: string;
  description: string | null;
  slashApiName: string | null;
  exposedAsSlash: boolean;
  /** Extra flow-level knobs (e.g. max_revisions). `positions` is added
   *  by the serialiser and should not be set here. */
  metadata: Record<string, unknown>;
}

/** A blank Agent (content-producing). */
export function blankAgent(apiName: string): EditorAgent {
  return {
    apiName,
    displayName: '',
    description: null,
    userModel: '',
    systemPrompt: '',
    tools: [],
    emits: [],
  };
}

/** Default classify-style system prompt used as the placeholder for a
 *  newly-dropped If/Else node. The `{emits}` token is interpolated against
 *  the agent's current emits at create time; the user may edit freely. */
const IF_ELSE_PROMPT_TEMPLATE = `You are a classifier. Read the input and call set_route with the branch label that best fits. Allowed labels: {emits}. If none clearly applies, call set_route(target="default") to route through the else branch.`;

/** A blank If/Else node — a UserAgent preset with emits + classify prompt. */
export function blankIfElseAgent(apiName: string): EditorAgent {
  const emits = ['passed', 'failed'];
  return {
    apiName,
    displayName: 'If/Else',
    description: null,
    userModel: '',
    systemPrompt: IF_ELSE_PROMPT_TEMPLATE.replace('{emits}', emits.join(', ')),
    tools: [],
    emits,
  };
}

/** The seed graph for a brand-new flow: just the Start/End boundary
 *  markers (so the author can wire to them). All four text-meta fields
 *  (apiName / displayName / description / slashApiName) start EMPTY so
 *  the author types real values into the placeholder-only inputs;
 *  required-ness is validated server-side on Save (the BE's
 *  POST /api/flows/from-yaml returns a 422 with structured errors which
 *  `handleSave` renders inline). `exposedAsSlash` stays default-on so
 *  the slash-name input is visible immediately. */
export function newFlowGraph(): {
  meta: FlowMeta;
  nodes: import('reactflow').Node<AgentNodeData | BoundaryNodeData>[];
  edges: import('reactflow').Edge<ConditionEdgeData>[];
} {
  return {
    meta: {
      apiName: '',
      displayName: '',
      description: null,
      slashApiName: null,
      exposedAsSlash: true,
      metadata: {},
    },
    // Horizontal layout: Start on the left (source on its right), End on
    // the right (target on its left). Matches the OpenAI agent-builder
    // pattern and the per-node handle spec (start = right source, end =
    // left target, agent = 4 omni handles, if/else = left target + N+1
    // right ports).
    nodes: [
      { id: NODE_START, type: NODE_TYPE_BOUNDARY, position: { x: 80,  y: 200 }, data: { boundary: NODE_START } },
      { id: NODE_END,   type: NODE_TYPE_BOUNDARY, position: { x: 720, y: 200 }, data: { boundary: NODE_END   } },
    ],
    edges: [],
  };
}
