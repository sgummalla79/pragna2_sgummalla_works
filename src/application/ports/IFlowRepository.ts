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

  /** R3.7+: persist a YAML-authored flow by **id**. Supports renaming the
   *  flow's `api_name` in place — the row identified by `flowId` is updated
   *  regardless of what `api_name` the YAML carries. Surfaces `409` when
   *  the new `api_name` collides with a different flow owned by the user. */
  saveFromYamlById(flowId: string, definition: string): Promise<SaveFromYamlResult>;

  /** R10 #2: persist the canvas-drag node positions onto
   *  ``flow.metadata.positions`` so they survive YAML keystrokes AND
   *  page reloads. The backend's existing ``PATCH /api/flows/{id}``
   *  merges ``metadata`` shallowly — sending ``{positions: {...}}``
   *  replaces the whole ``positions`` slot but leaves siblings
   *  (``max_revisions``, ``timeout_seconds``, …) untouched. Callers
   *  MUST send the FULL positions map (not a single-node delta) so
   *  previously-saved positions don't vanish on the next write. */
  updatePositions(
    flowId: string,
    positions: Record<string, { x: number; y: number }>,
  ): Promise<Flow>;
}
