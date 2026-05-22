import type { IFlowRepository, SaveFromYamlResult } from '@/application/ports/IFlowRepository';
import type {
  AddEdgePayload,
  AddNodePayload,
  CreateFlowPayload,
  Flow,
} from '@/domain/types/flow.types';
import type { YamlValidationResult } from '@/domain/types/flowYaml.types';

export class FlowService {
  constructor(private readonly flowRepository: IFlowRepository) {}

  list(): Promise<Flow[]> {
    return this.flowRepository.list();
  }

  get(id: string): Promise<Flow> {
    return this.flowRepository.get(id);
  }

  create(payload: CreateFlowPayload): Promise<Flow> {
    return this.flowRepository.create(payload);
  }

  addNode(flowId: string, payload: AddNodePayload): Promise<Flow> {
    return this.flowRepository.addNode(flowId, payload);
  }

  addEdge(flowId: string, payload: AddEdgePayload): Promise<Flow> {
    return this.flowRepository.addEdge(flowId, payload);
  }

  delete(id: string): Promise<void> {
    return this.flowRepository.delete(id);
  }

  validateYaml(definition: string): Promise<YamlValidationResult> {
    return this.flowRepository.validateYaml(definition);
  }

  saveFromYaml(definition: string): Promise<SaveFromYamlResult> {
    return this.flowRepository.saveFromYaml(definition);
  }
}
