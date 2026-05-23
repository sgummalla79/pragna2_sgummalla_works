import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useServices } from '@/presentation/providers/ServiceContext';
import type { RunFlowOncePayload } from '@/application/ports/IFlowRunRepository';

/**
 * Mutation hook that runs a flow once inside a conversation (R6a).
 *
 * Backs the Confirm button on :class:`FlowProposalCard`. On success
 * the conversation's persisted message list is invalidated so the
 * chat refetches and the flow's output appears as new assistant
 * messages.
 *
 * R6a's MVP waits for the SSE stream to complete server-side before
 * resolving — there is no live event rendering. R6b will swap this
 * out for an HttpAgent-style subscriber that streams events into the
 * existing chat-message state as they arrive.
 */
export function useRunFlow(conversationId: string | undefined) {
  const { flowRunService } = useServices();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: RunFlowOncePayload) => {
      if (!conversationId) {
        throw new Error('useRunFlow: conversationId is required');
      }
      await flowRunService.runOnce(conversationId, payload);
    },
    onSuccess: () => {
      if (!conversationId) return;
      // Force the chat to refetch and show the flow's new assistant
      // messages. The persisted-message query key shape comes from
      // :func:`useConversationMessages`.
      queryClient.invalidateQueries({
        queryKey: ['conversations', conversationId, 'messages'],
      });
    },
  });
}
