import { useQuery } from '@tanstack/react-query';
import { useServices } from '@/presentation/providers/ServiceContext';

const PRAGNA_FLOWS_KEY = ['pragna', 'flows'] as const;

/**
 * Fetch the user's slash-exposed flows for the chat input's
 * slash-command popover.
 *
 * Backed by ``GET /pragna/flows``. The list is small (typically a
 * handful of entries) and resolved per-request server-side; cache for
 * 30 s so the popover doesn't re-fetch on every keystroke but still
 * picks up newly slash-exposed flows quickly.
 */
export function usePragnaSlashFlows() {
  const { pragnaFlowsService } = useServices();
  return useQuery({
    queryKey: PRAGNA_FLOWS_KEY,
    queryFn: () => pragnaFlowsService.list(),
    staleTime: 30_000,
  });
}
