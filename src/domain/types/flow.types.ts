import type { EdgeConditionValue } from '@/constants/edgeConditions';

export type EdgeCondition = EdgeConditionValue;

/** A node inside a flow (R3.5+: pure topology — behaviour lives on the
 *  referenced user_agent row). */
export interface FlowNode {
  id: string;
  /** Short label unique within the flow (e.g. 'researcher_1'). */
  nodeId: string;
  /** UUID of the user_agent this node executes. */
  userAgentId: string;
}

export interface FlowEdge {
  id: string;
  fromNode: string;
  toNode: string;
  condition: EdgeCondition;
}

export interface Flow {
  id: string;
  /** URL-safe identifier unique within the user's account. */
  apiName: string;
  /** Human-readable label rendered in the UI. */
  displayName: string;
  description: string | null;
  enabled: boolean;
  /** User-facing /slash command this flow answers to. NULL unless
   *  ``exposedAsSlash`` is true. */
  slashApiName: string | null;
  /** When true: (a) reachable via POST /pragna/flows/{slashApiName}
   *  AND (b) auto-bound as a LangChain tool on the default chat
   *  agent so the LLM may invoke it from natural-language intent. */
  exposedAsSlash: boolean;
  metadata: Record<string, unknown>;
  /** Verbatim YAML the flow was authored from, when present. */
  definition: string | null;
  nodes: FlowNode[];
  edges: FlowEdge[];
}

/** Payload for PATCH /api/flows/{id}/slash-exposure. All fields
 *  optional; ``undefined`` leaves the corresponding server field
 *  unchanged. ``clearSlashApiName`` forces it to NULL. */
export interface UpdateFlowSlashExposurePayload {
  slashApiName?: string;
  exposedAsSlash?: boolean;
  clearSlashApiName?: boolean;
}

export interface CreateFlowPayload {
  apiName: string;
  displayName: string;
  description?: string;
  metadata?: Record<string, unknown>;
  definition?: string;
}

export interface AddNodePayload {
  nodeId: string;
  userAgentId: string;
}

export interface AddEdgePayload {
  fromNode: string;
  toNode: string;
  condition?: EdgeCondition;
}
