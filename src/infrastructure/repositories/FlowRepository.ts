import type { AxiosInstance } from 'axios';
import type { IFlowRepository } from '@/application/ports/IFlowRepository';
import type {
  AddEdgePayload,
  AddNodePayload,
  CreateFlowPayload,
  EdgeCondition,
  Flow,
  FlowEdge,
  FlowNode,
} from '@/domain/types/flow.types';
import { EDGE_CONDITIONS } from '@/constants/edgeConditions';

interface ApiFlowNodeResponse {
  id: string;
  node_id: string;
  agent_type: string;
  user_model_id: string;
  config: Record<string, unknown>;
}

interface ApiFlowEdgeResponse {
  id: string;
  from_node: string;
  to_node: string;
  condition: string;
}

interface ApiFlowResponse {
  id: string;
  name: string;
  description: string | null;
  enabled: boolean;
  metadata: Record<string, unknown>;
  nodes: ApiFlowNodeResponse[];
  edges: ApiFlowEdgeResponse[];
}

function mapNode(raw: ApiFlowNodeResponse): FlowNode {
  return {
    id: raw.id,
    nodeId: raw.node_id,
    agentType: raw.agent_type,
    userModelId: raw.user_model_id,
    config: raw.config,
  };
}

function mapEdge(raw: ApiFlowEdgeResponse): FlowEdge {
  return {
    id: raw.id,
    fromNode: raw.from_node,
    toNode: raw.to_node,
    condition: (raw.condition as EdgeCondition) ?? EDGE_CONDITIONS.DEFAULT,
  };
}

function mapFlow(raw: ApiFlowResponse): Flow {
  return {
    id: raw.id,
    name: raw.name,
    description: raw.description,
    enabled: raw.enabled,
    metadata: raw.metadata,
    nodes: raw.nodes.map(mapNode),
    edges: raw.edges.map(mapEdge),
  };
}

export class FlowRepository implements IFlowRepository {
  constructor(private readonly http: AxiosInstance) {}

  async list(): Promise<Flow[]> {
    const { data } = await this.http.get<ApiFlowResponse[]>('/api/flows');
    return data.map(mapFlow);
  }

  async get(id: string): Promise<Flow> {
    const { data } = await this.http.get<ApiFlowResponse>(`/api/flows/${id}`);
    return mapFlow(data);
  }

  async create(payload: CreateFlowPayload): Promise<Flow> {
    const { data } = await this.http.post<ApiFlowResponse>('/api/flows', {
      name: payload.name,
      description: payload.description,
      metadata: payload.metadata ?? {},
    });
    return mapFlow(data);
  }

  async addNode(flowId: string, payload: AddNodePayload): Promise<Flow> {
    const { data } = await this.http.post<ApiFlowResponse>(`/api/flows/${flowId}/nodes`, {
      node_id: payload.nodeId,
      agent_type: payload.agentType,
      user_model_id: payload.userModelId,
      config: payload.config ?? {},
    });
    return mapFlow(data);
  }

  async addEdge(flowId: string, payload: AddEdgePayload): Promise<Flow> {
    const { data } = await this.http.post<ApiFlowResponse>(`/api/flows/${flowId}/edges`, {
      from_node: payload.fromNode,
      to_node: payload.toNode,
      condition: payload.condition ?? EDGE_CONDITIONS.DEFAULT,
    });
    return mapFlow(data);
  }

  async delete(id: string): Promise<void> {
    await this.http.delete(`/api/flows/${id}`);
  }
}
