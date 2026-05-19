import { useQuery } from '@tanstack/react-query';
import { useServices } from '@/presentation/providers/ServiceContext';
import { DEFAULT_PAGE_SIZE } from '@/constants/pagination';

const CONVERSATIONS_KEY = (page: number) => ['conversations', page] as const;
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

export function useConversationUsage(conversationId: string) {
  const { conversationService } = useServices();
  return useQuery({
    queryKey: USAGE_KEY(conversationId),
    queryFn: () => conversationService.getUsage(conversationId),
    staleTime: 60_000,
    enabled: Boolean(conversationId),
  });
}
