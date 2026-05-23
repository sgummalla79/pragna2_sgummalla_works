import { useQuery } from '@tanstack/react-query';
import { useServices } from '@/presentation/providers/ServiceContext';
import { DEFAULT_PAGE_SIZE } from '@/constants/pagination';

const CONVERSATIONS_KEY = (page: number) => ['conversations', page] as const;
const PINNED_KEY = ['conversations', 'pinned'] as const;
const USAGE_KEY = (id: string) => ['conversations', id, 'usage'] as const;

export function useConversations(page = 0) {
  const { conversationService } = useServices();
  return useQuery({
    queryKey: CONVERSATIONS_KEY(page),
    queryFn: () =>
      conversationService.list({
        limit: DEFAULT_PAGE_SIZE,
        offset: page * DEFAULT_PAGE_SIZE,
      }),
    staleTime: 0,
  });
}

/**
 * Pinned conversations only — used by the sidebar's "Pinned" group.
 * Loaded as a single request (no pagination); typical pin counts are
 * small enough that a hard cap isn't needed. Ordered by ``pinned_at``
 * desc server-side.
 */
export function usePinnedConversations() {
  const { conversationService } = useServices();
  return useQuery({
    queryKey: PINNED_KEY,
    queryFn: () =>
      conversationService.list({
        limit: DEFAULT_PAGE_SIZE,
        offset: 0,
        pinned: true,
      }),
    staleTime: 0,
  });
}

export function useConversationUsage(conversationId: string) {
  const { conversationService } = useServices();
  return useQuery({
    queryKey: USAGE_KEY(conversationId),
    queryFn: () => conversationService.getUsage(conversationId),
    staleTime: 60_000,
    enabled: Boolean(conversationId),
  });
}
