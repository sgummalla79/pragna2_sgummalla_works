import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useServices } from '@/presentation/providers/ServiceContext';
import type { AddEdgePayload, AddNodePayload, CreateFlowPayload } from '@/domain/types/flow.types';

const FLOWS_KEY = ['flows'] as const;
const flowKey = (id: string) => ['flows', id] as const;

export function useFlows() {
  const { flowService } = useServices();
  return useQuery({
    queryKey: FLOWS_KEY,
    queryFn: () => flowService.list(),
    staleTime: 30_000,
  });
}

export function useFlow(id: string) {
  const { flowService } = useServices();
  return useQuery({
    queryKey: flowKey(id),
    queryFn: () => flowService.get(id),
    staleTime: 30_000,
    enabled: Boolean(id),
  });
}

export function useCreateFlow() {
  const { flowService } = useServices();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateFlowPayload) => flowService.create(payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: FLOWS_KEY }),
  });
}

export function useAddFlowNode() {
  const { flowService } = useServices();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ flowId, payload }: { flowId: string; payload: AddNodePayload }) =>
      flowService.addNode(flowId, payload),
    onSuccess: (flow) => {
      queryClient.invalidateQueries({ queryKey: FLOWS_KEY });
      queryClient.invalidateQueries({ queryKey: flowKey(flow.id) });
    },
  });
}

export function useAddFlowEdge() {
  const { flowService } = useServices();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ flowId, payload }: { flowId: string; payload: AddEdgePayload }) =>
      flowService.addEdge(flowId, payload),
    onSuccess: (flow) => {
      queryClient.invalidateQueries({ queryKey: FLOWS_KEY });
      queryClient.invalidateQueries({ queryKey: flowKey(flow.id) });
    },
  });
}

export function useDeleteFlow() {
  const { flowService } = useServices();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => flowService.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: FLOWS_KEY }),
  });
}

/** R3.6+: validate a YAML flow document. Server always returns 200; the
 *  body carries `valid` + structured `errors[]` for inline rendering. */
export function useValidateFlowYaml() {
  const { flowService } = useServices();
  return useMutation({
    mutationFn: (definition: string) => flowService.validateYaml(definition),
  });
}

/** R3.6+: persist a YAML-authored flow. 201 on create, 200 on update,
 *  422 with structured errors on validation failure (caller unwraps via
 *  AxiosError.response.data.detail). */
export function useSaveFlowFromYaml() {
  const { flowService } = useServices();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (definition: string) => flowService.saveFromYaml(definition),
    onSuccess: ({ flow }) => {
      queryClient.invalidateQueries({ queryKey: FLOWS_KEY });
      queryClient.invalidateQueries({ queryKey: flowKey(flow.id) });
    },
  });
}

/** R3.7+: persist a YAML-authored flow by **id**. Supports renaming the
 *  flow's `api_name` in place. 404 if the id isn't owned, 409 on rename
 *  collision, 422 with structured errors on validation failure. */
export function useSaveFlowFromYamlById() {
  const { flowService } = useServices();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ flowId, definition }: { flowId: string; definition: string }) =>
      flowService.saveFromYamlById(flowId, definition),
    onSuccess: ({ flow }) => {
      queryClient.invalidateQueries({ queryKey: FLOWS_KEY });
      queryClient.invalidateQueries({ queryKey: flowKey(flow.id) });
    },
  });
}

/** R10 #2: persist canvas-drag positions on ``flow.metadata.positions``.
 *
 *  The mutation fires AFTER the user finishes a drag (reactflow's
 *  ``onNodeDragStop`` hook). The caller is responsible for sending the
 *  FULL positions map — the backend's metadata-merge is shallow, so a
 *  single-node delta would clobber previously-saved siblings.
 *
 *  Cache invalidation re-fetches the flow so a subsequent visit lands
 *  with the persisted positions. We deliberately do NOT invalidate the
 *  flows list — positions don't surface in the list endpoint.
 */
export function useUpdateFlowPositions() {
  const { flowService } = useServices();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      flowId,
      positions,
    }: {
      flowId: string;
      positions: Record<string, { x: number; y: number }>;
    }) => flowService.updatePositions(flowId, positions),
    onSuccess: (flow) => {
      queryClient.invalidateQueries({ queryKey: flowKey(flow.id) });
    },
  });
}
