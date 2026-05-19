import { useQuery } from '@tanstack/react-query';
import { axiosClient } from '@/infrastructure/http/axiosClient';
import { AgentTypeRepository } from '@/infrastructure/repositories/AgentTypeRepository';

const repo = new AgentTypeRepository(axiosClient);
const AGENT_TYPES_KEY = ['agent-types'] as const;

export function useAgentTypes() {
  return useQuery({
    queryKey: AGENT_TYPES_KEY,
    queryFn: () => repo.list(),
    staleTime: Infinity,
  });
}
