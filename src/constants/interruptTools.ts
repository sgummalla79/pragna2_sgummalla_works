/**
 * Tool names that are "interrupt-driven" — when the LLM calls them, the
 * BE pauses execution via ``langgraph.types.interrupt(...)`` and the FE
 * surfaces the pause as a dedicated UI (currently ``HITLFormCard`` for
 * the ``ask_user`` tool).
 *
 * Tools in this list are SUPPRESSED from the generic ``ToolCallBadge``
 * renderer in ``ChatMessage`` — the dedicated UI for the pause is the
 * intended surface, so showing the raw tool call JSON alongside it is
 * just noise. The BE side enumerates these via
 * ``handler_family='system_interrupt'`` on the ``tools`` table; we
 * don't have an API to fetch that list yet, so mirror it here.
 *
 * If you add a new built-in interrupt-driven tool on the BE
 * (``handler_family='system_interrupt'``), add its ``api_name`` here.
 */
export const INTERRUPT_TOOL_NAMES = new Set<string>([
  'ask_user',
]);
