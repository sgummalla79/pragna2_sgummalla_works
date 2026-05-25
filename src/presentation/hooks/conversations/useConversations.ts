import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import { useServices } from '@/presentation/providers/ServiceContext';
import { DEFAULT_PAGE_SIZE } from '@/constants/pagination';
import type { ConversationUsage } from '@/domain/types/conversation.types';

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
  return useQuery<ConversationUsage>({
    queryKey: USAGE_KEY(conversationId),
    queryFn: async () => {
      try {
        return await conversationService.getUsage(conversationId);
      } catch (e) {
        // Race-guard (NOT a lazy-create workaround). Eager creation
        // means a fresh conversation has its row before the chat
        // surface mounts. Remaining 404 cases: (1) active-delete
        // race (DELETE 204 → in-flight refetch → navigate), (2) cost
        // chip on a sidebar row that was just deleted in another tab,
        // (3) multi-tab delete. Zero-state is the right response —
        // no conversation means no usage.
        if (axios.isAxiosError(e) && e.response?.status === 404) {
          return {
            conversationId,
            records: [],
            totalInputTokens: 0,
            totalOutputTokens: 0,
            totalCostUsd: '0',
          };
        }
        throw e;
      }
    },
    staleTime: 60_000,
    enabled: Boolean(conversationId),
  });
}
