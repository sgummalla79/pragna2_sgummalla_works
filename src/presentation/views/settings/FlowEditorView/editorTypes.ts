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

/** Reserved graph-boundary node ids, shared with the backend YAML schema. */
export const NODE_START = '__start__';
export const NODE_END = '__end__';

/** React Flow node `type` discriminators registered on the canvas. */
export const NODE_TYPE_AGENT = 'agent';
export const NODE_TYPE_BOUNDARY = 'boundary';

/** React Flow edge `type` for the click-to-edit conditioned connector. */
export const EDGE_TYPE_CONDITION = 'condition';

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

/** A blank agent for a freshly-added node. */
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
    nodes: [
      { id: NODE_START, type: NODE_TYPE_BOUNDARY, position: { x: 250, y: 40 }, data: { boundary: NODE_START } },
      { id: NODE_END, type: NODE_TYPE_BOUNDARY, position: { x: 250, y: 400 }, data: { boundary: NODE_END } },
    ],
    edges: [],
  };
}
