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
