import type { AddEdgePayload, AddNodePayload, CreateFlowPayload, Flow } from '@/domain/types/flow.types';

export interface IFlowRepository {
  list(): Promise<Flow[]>;
  get(id: string): Promise<Flow>;
  create(payload: CreateFlowPayload): Promise<Flow>;
  addNode(flowId: string, payload: AddNodePayload): Promise<Flow>;
  addEdge(flowId: string, payload: AddEdgePayload): Promise<Flow>;
  delete(id: string): Promise<void>;
}
