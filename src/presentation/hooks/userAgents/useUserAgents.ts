import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useServices } from '@/presentation/providers/ServiceContext';
import type {
  CreateUserAgentPayload,
  UpdateUserAgentPayload,
} from '@/domain/types/userAgent.types';

const KEY = ['user-agents'] as const;

export function useUserAgents() {
  const { userAgentService } = useServices();
  return useQuery({
    queryKey: KEY,
    queryFn: () => userAgentService.list(),
    staleTime: 30_000,
  });
}

export function useUserAgent(id: string | undefined) {
  const { userAgentService } = useServices();
  return useQuery({
    queryKey: ['user-agents', id ?? '__none__'] as const,
    queryFn: () => userAgentService.get(id!),
    enabled: Boolean(id),
    staleTime: 30_000,
  });
}

export function useCreateUserAgent() {
  const { userAgentService } = useServices();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateUserAgentPayload) => userAgentService.create(payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useUpdateUserAgent() {
  const { userAgentService } = useServices();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: UpdateUserAgentPayload }) =>
      userAgentService.update(id, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useDeleteUserAgent() {
  const { userAgentService } = useServices();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => userAgentService.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}
