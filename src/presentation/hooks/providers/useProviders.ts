import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useServices } from '@/presentation/providers/ServiceContext';
import type { CreateProviderPayload } from '@/domain/types/provider.types';

const PROVIDERS_KEY = ['providers'] as const;

export function useProviders() {
  const { providerService } = useServices();
  return useQuery({
    queryKey: PROVIDERS_KEY,
    queryFn: () => providerService.list(),
    staleTime: 30_000,
  });
}

export function useCreateProvider() {
  const { providerService } = useServices();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateProviderPayload) => providerService.create(payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: PROVIDERS_KEY }),
  });
}

export function useDeleteProvider() {
  const { providerService } = useServices();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => providerService.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: PROVIDERS_KEY }),
  });
}
