import { useQuery } from '@tanstack/react-query';
import { useServices } from '@/presentation/providers/ServiceContext';

const KEY = ['user-agents'] as const;

// Read-only hooks. Agents are flow-owned (BE migration 0024) and authored
// inline in the flow editor's node panel — created/updated/deleted only
// through the flow YAML save path. The standalone create/update/delete
// hooks were removed when the BE retired those routes (they would 405).
// These reads remain for resolving agent names (e.g. in conversation UI).

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
