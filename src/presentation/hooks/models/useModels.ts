import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useServices } from '@/presentation/providers/ServiceContext';
import type { RegisterModelPayload } from '@/domain/types/model.types';

const MODELS_KEY = ['models'] as const;

export function useModels() {
  const { modelService } = useServices();
  return useQuery({
    queryKey: MODELS_KEY,
    queryFn: () => modelService.list(),
    staleTime: 30_000,
  });
}

export function useRegisterModel() {
  const { modelService } = useServices();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: RegisterModelPayload) => modelService.register(payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: MODELS_KEY }),
  });
}

export function useDeleteModel() {
  const { modelService } = useServices();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => modelService.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: MODELS_KEY }),
  });
}
