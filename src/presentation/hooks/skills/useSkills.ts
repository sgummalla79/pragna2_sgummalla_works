import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useServices } from '@/presentation/providers/ServiceContext';
import type { CreateSkillPayload } from '@/domain/types/skill.types';

const SKILLS_KEY = ['skills'] as const;

export function useSkills() {
  const { skillService } = useServices();
  return useQuery({
    queryKey: SKILLS_KEY,
    queryFn: () => skillService.list(),
    staleTime: 30_000,
  });
}

export function useCreateSkill() {
  const { skillService } = useServices();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateSkillPayload) => skillService.create(payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: SKILLS_KEY }),
  });
}

export function useDeleteSkill() {
  const { skillService } = useServices();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => skillService.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: SKILLS_KEY }),
  });
}
