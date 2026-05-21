import { useQuery } from '@tanstack/react-query';
import { useServices } from '@/presentation/providers/ServiceContext';

const AGENTS_KEY = ['pragna', 'agents'] as const;

/**
 * Fetch the AG-UI agents the authenticated user can run.
 *
 * Backed by ``GET /pragna/agents``. The list is small (typically 1–5
 * entries) and resolved per-request server-side; cache for 30 s so that
 * the agent picker doesn't re-fetch on every navigation but still picks
 * up newly enabled models / flows quickly.
 */
export function useAgents() {
  const { agentService } = useServices();
  return useQuery({
    queryKey: AGENTS_KEY,
    queryFn: () => agentService.list(),
    staleTime: 30_000,
  });
}
