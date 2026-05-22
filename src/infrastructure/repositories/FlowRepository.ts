import type { AxiosInstance } from 'axios';
import type { IFlowRepository, SaveFromYamlResult } from '@/application/ports/IFlowRepository';
import type {
  AddEdgePayload,
  AddNodePayload,
  CreateFlowPayload,
  EdgeCondition,
  Flow,
  FlowEdge,
  FlowNode,
} from '@/domain/types/flow.types';
import type { YamlValidationResult } from '@/domain/types/flowYaml.types';
import { EDGE_CONDITIONS } from '@/constants/edgeConditions';

/** R3.5+ wire shape — flow_nodes are pure topology (node_id + user_agent_id);
 *  behaviour lives on the referenced user_agent row. */
interface ApiFlowNodeResponse {
  id: string;
  node_id: string;
  user_agent_id: string;
}

interface ApiFlowEdgeResponse {
  id: string;
  from_node: string;
  to_node: string;
  condition: string;
}

interface ApiFlowResponse {
  id: string;
  api_name: string;
  display_name: string;
  description: string | null;
  enabled: boolean;
  metadata: Record<string, unknown>;
  definition: string | null;
  nodes: ApiFlowNodeResponse[];
  edges: ApiFlowEdgeResponse[];
}

function mapNode(raw: ApiFlowNodeResponse): FlowNode {
  return {
    id: raw.id,
    nodeId: raw.node_id,
    userAgentId: raw.user_agent_id,
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
    apiName: raw.api_name,
    displayName: raw.display_name,
    description: raw.description,
    enabled: raw.enabled,
    metadata: raw.metadata,
    definition: raw.definition,
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
      api_name: payload.apiName,
      display_name: payload.displayName,
      description: payload.description,
      metadata: payload.metadata ?? {},
      ...(payload.definition !== undefined ? { definition: payload.definition } : {}),
    });
    return mapFlow(data);
  }

  async addNode(flowId: string, payload: AddNodePayload): Promise<Flow> {
    const { data } = await this.http.post<ApiFlowResponse>(`/api/flows/${flowId}/nodes`, {
      node_id: payload.nodeId,
      user_agent_id: payload.userAgentId,
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

  // ── YAML-authored flows (R3.6+) ──────────────────────────────────────

  async validateYaml(definition: string): Promise<YamlValidationResult> {
    const { data } = await this.http.post<YamlValidationResult>(
      '/api/flows/validate-yaml',
      { definition },
    );
    return data;
  }

  async saveFromYaml(definition: string): Promise<SaveFromYamlResult> {
    const response = await this.http.post<ApiFlowResponse>(
      '/api/flows/from-yaml',
      { definition },
    );
    return {
      flow: mapFlow(response.data),
      created: response.status === 201,
    };
  }

  async saveFromYamlById(
    flowId: string,
    definition: string,
  ): Promise<SaveFromYamlResult> {
    const response = await this.http.put<ApiFlowResponse>(
      `/api/flows/${flowId}/from-yaml`,
      { definition },
    );
    // By-id save is always an update — 200 OK, never 201.
    return { flow: mapFlow(response.data), created: false };
  }
}
