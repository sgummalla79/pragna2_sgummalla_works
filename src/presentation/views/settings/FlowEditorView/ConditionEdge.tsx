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
import { type AgentNodeData, type ConditionEdgeData, NODE_TYPE_AGENT } from './editorTypes';
import { useFlowEditorStore } from './useFlowEditorStore';

const STANDARD = Object.values(EDGE_CONDITIONS);

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
    return n?.type === NODE_TYPE_AGENT ? (n.data as AgentNodeData).agent.emits : [];
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
      <EdgeLabelRenderer>
        <div
          className="nodrag nopan absolute"
          style={{ transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)` }}
        >
          <select
            aria-label="Edge condition"
            title={
              unknownEmit
                ? `The source agent doesn't declare "${condition}" in its emit labels — this edge won't fire at runtime. Add it to the agent's emits, or pick a declared outcome.`
                : undefined
            }
            value={condition}
            onChange={(e) =>
              setEdgeCondition(id, e.target.value as EdgeConditionValue)
            }
            className={[
              'cursor-pointer rounded border bg-popover px-1 py-0.5 text-[10px] shadow-sm',
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
      </EdgeLabelRenderer>
    </>
  );
}
