/**
 * The BE's structured conditional-edge routing tool (#25).
 *
 * A flow node that branches binds a ``set_route(target: ...)`` tool to
 * its LLM. The call is a TERMINAL ROUTING SIGNAL — the BE reads the
 * ``target`` to pick the next node and never executes the tool. It
 * carries no user-facing meaning, so its generic ``ToolCallBadge`` is
 * SUPPRESSED in ``ChatMessage`` (same treatment as the interrupt tools).
 *
 * Mirrors ``SET_ROUTE_TOOL_NAME`` in the BE ``src/constants.py``.
 */
export const SET_ROUTE_TOOL_NAME = 'set_route';
