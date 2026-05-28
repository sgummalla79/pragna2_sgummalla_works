/**
 * A connector that carries a routing condition ("the rules"). Renders a
 * curved path plus an inline `<select>` badge at its midpoint so the
 * author can set the condition without leaving the canvas.
 *
 * The options are the standard edge conditions UNION the source node
 * agent's declared `emits` — so an author can always pick the five
 * built-ins, and any custom outcome the agent emits shows up too. A
 * `default` (always) edge shows no label until clicked.
 */

import { type EdgeProps, EdgeLabelRenderer, BaseEdge, getBezierPath } from 'reactflow';

import {
  EDGE_CONDITIONS,
  EDGE_CONDITION_COLORS,
  type EdgeConditionValue,
} from '@/constants/edgeConditions';
import {
  type AgentNodeData,
  type ConditionEdgeData,
  NODE_START,
  NODE_TYPE_AGENT,
} from './editorTypes';
import { useFlowEditorStore } from './useFlowEditorStore';

const STANDARD = Object.values(EDGE_CONDITIONS);
// Stable empty-array reference for the "source is not an agent" branch of
// the sourceEmits selector. Returning a fresh `[]` from a Zustand selector
// makes useSyncExternalStore see a new snapshot every render (Object.is
// is the default equality, and Object.is([], []) is false) → infinite
// re-render loop. This sentinel keeps the fallback referentially stable.
const EMPTY_EMITS: readonly string[] = Object.freeze([]);

export function ConditionEdge({
  id,
  source,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
  selected,
}: EdgeProps<ConditionEdgeData>) {
  const setEdgeCondition = useFlowEditorStore((s) => s.setEdgeCondition);
  const sourceEmits = useFlowEditorStore((s) => {
    const n = s.nodes.find((x) => x.id === source);
    return n?.type === NODE_TYPE_AGENT
      ? (n.data as AgentNodeData).agent.emits
      : EMPTY_EMITS;
  });

  const condition = data?.condition ?? EDGE_CONDITIONS.DEFAULT;
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
  });

  const color = EDGE_CONDITION_COLORS[condition] ?? 'var(--color-border)';
  // Standard set + the source agent's emits, de-duplicated, order-stable.
  const options = Array.from(new Set<string>([...STANDARD, ...sourceEmits]));

  // Warn (don't block) when a conditioned edge leaves a node whose agent
  // doesn't declare that outcome in `emits` — at runtime the edge would
  // never fire. `default` is the always-route and never warns.
  const unknownEmit =
    condition !== EDGE_CONDITIONS.DEFAULT && !sourceEmits.includes(condition);

  // __start__ has no upstream agent, so it can never emit anything — the
  // edge out of it is unconditionally the flow's entry. Hide the picker
  // there so the canvas isn't cluttered with a non-choice. Edges TO
  // __end__ keep their picker (a branching node still routes some
  // outcomes to the end and others to a loop, etc.).
  const fromStart = source === NODE_START;

  return (
    <>
      <BaseEdge
        id={id}
        path={edgePath}
        style={{
          stroke: unknownEmit ? 'var(--color-destructive)' : color,
          strokeWidth: selected ? 2.5 : 1.5,
          strokeDasharray: unknownEmit ? '4 3' : undefined,
        }}
      />
      {!fromStart && <EdgeLabelRenderer>
        {/* pointer-events-auto is REQUIRED: React Flow's
            EdgeLabelRenderer mounts a wrapper with `pointer-events: none`
            so labels float over the canvas without blocking pan/zoom.
            Without explicitly re-enabling pointer events on this child,
            the <select> below never receives the click that would open
            its dropdown. nodrag / nopan keep canvas gestures unaffected
            while the user is interacting with the select itself. */}
        <div
          className="nodrag nopan absolute pointer-events-auto"
          style={{ transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)` }}
        >
          <select
            aria-label="Edge condition"
            title={
              unknownEmit
                ? `The source agent doesn't declare "${condition}" in its emit labels — this edge won't fire at runtime. Add it to the agent's emits, or pick a declared outcome.`
                : 'Edge condition — pick the outcome this edge fires on'
            }
            value={condition}
            onChange={(e) =>
              setEdgeCondition(id, e.target.value as EdgeConditionValue)
            }
            className={[
              // Sized + contrasted to be discoverable at default zoom:
              // bg-card (more solid than bg-popover), bumped text, a
              // touch of font-weight + min-width so a tiny "default"
              // chip doesn't collapse to a few pixels in the middle of
              // a short edge.
              'cursor-pointer rounded border bg-card px-1.5 py-0.5 text-[11px] font-medium shadow min-w-[3.5rem] text-center',
              unknownEmit
                ? 'border-destructive text-destructive'
                : condition === EDGE_CONDITIONS.DEFAULT
                  ? 'border-border text-muted-foreground'
                  : 'border-current',
            ].join(' ')}
            style={unknownEmit || condition === EDGE_CONDITIONS.DEFAULT ? undefined : { color }}
          >
            {options.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
            {/* Keep an unknown persisted value selectable so it shows. */}
            {unknownEmit && !options.includes(condition) && (
              <option value={condition}>{condition} (not emitted)</option>
            )}
          </select>
        </div>
      </EdgeLabelRenderer>}
    </>
  );
}
