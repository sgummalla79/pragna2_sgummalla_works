import type { EdgeConditionValue } from '@/constants/edgeConditions';

export type EdgeCondition = EdgeConditionValue;

export interface FlowNode {
  id: string;
  nodeId: string;
  agentType: string;
  userModelId: string;
  config: Record<string, unknown>;
}

export interface FlowEdge {
  id: string;
  fromNode: string;
  toNode: string;
  condition: EdgeCondition;
}

export interface Flow {
  id: string;
  name: string;
  description: string | null;
  enabled: boolean;
  metadata: Record<string, unknown>;
  nodes: FlowNode[];
  edges: FlowEdge[];
}

export interface CreateFlowPayload {
  name: string;
  description?: string;
  metadata?: Record<string, unknown>;
}

export interface AddNodePayload {
  nodeId: string;
  agentType: string;
  userModelId: string;
  config?: Record<string, unknown>;
}

export interface AddEdgePayload {
  fromNode: string;
  toNode: string;
  condition?: EdgeCondition;
}
