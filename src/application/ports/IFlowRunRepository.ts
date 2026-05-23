/**
 * Port for one-shot flow invocation (R6a).
 *
 * Backs the user clicking Confirm on a :class:`FlowProposalCard`. The
 * call streams AG-UI events as the flow's compiled LangGraph runs;
 * R6a's MVP simply waits for stream completion and lets the chat UI
 * refetch the persisted message list. R6b will subscribe to events
 * live so partial progress shows up as it streams.
 */
export interface RunFlowOncePayload {
  /** ``flows.api_name`` to invoke (must be owned + enabled by user). */
  flowApiName: string;
  /** Seed message text. Concatenated from the ``propose_flow`` tool
   *  call's ``summary`` argument and the user's optional
   *  additional-context input. May be empty. */
  seedText: string;
}

export interface IFlowRunRepository {
  /** POST ``/api/conversations/{conversationId}/run-flow`` and wait for
   *  the SSE stream to complete. Persistence happens server-side in the
   *  endpoint's ``finally`` block, so after this promise resolves the
   *  chat's ``messages`` query is safe to invalidate. */
  runOnce(conversationId: string, payload: RunFlowOncePayload): Promise<void>;
}
