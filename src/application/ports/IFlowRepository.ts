import type { AddEdgePayload, AddNodePayload, CreateFlowPayload, Flow } from '@/domain/types/flow.types';
import type { YamlValidationResult } from '@/domain/types/flowYaml.types';

/** Save-from-YAML result the route returns alongside its HTTP status. */
export interface SaveFromYamlResult {
  flow: Flow;
  /** True when the call CREATED a new flow row; false when it updated
   *  an existing row keyed by `flow.api_name`. */
  created: boolean;
}

export interface IFlowRepository {
  list(): Promise<Flow[]>;
  get(id: string): Promise<Flow>;
  create(payload: CreateFlowPayload): Promise<Flow>;
  addNode(flowId: string, payload: AddNodePayload): Promise<Flow>;
  addEdge(flowId: string, payload: AddEdgePayload): Promise<Flow>;
  delete(id: string): Promise<void>;

  /** R3.6+: parse + cross-check a YAML flow document. Always succeeds at
   *  the HTTP layer — errors render inline. */
  validateYaml(definition: string): Promise<YamlValidationResult>;

  /** R3.6+: persist a YAML-authored flow. Idempotent by `flow.api_name`. */
  saveFromYaml(definition: string): Promise<SaveFromYamlResult>;
}
