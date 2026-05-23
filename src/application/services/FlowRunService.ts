import type {
  IFlowRunRepository,
  RunFlowOncePayload,
} from '@/application/ports/IFlowRunRepository';

/**
 * Application-layer service for one-shot flow invocation (R6a).
 *
 * Thin pass-through to :class:`IFlowRunRepository`. Exists for parity
 * with the rest of the service layer — every repository in this app
 * has a sibling service so route handlers / hooks have a stable
 * port-shaped target to import. R6b can grow this with episode
 * lifecycle helpers without touching call sites.
 */
export class FlowRunService {
  constructor(private readonly repo: IFlowRunRepository) {}

  /** Run a flow once inside an existing conversation. See
   *  :func:`IFlowRunRepository.runOnce` for the lifecycle. */
  runOnce(conversationId: string, payload: RunFlowOncePayload): Promise<void> {
    return this.repo.runOnce(conversationId, payload);
  }
}
