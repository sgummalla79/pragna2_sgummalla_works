/**
 * A connector that carries a routing condition. Post-#33 the edge is a
 * plain non-interactive line — the routing condition derives from which
 * port on the source If/Else node the edge leaves, not from an
 * inline-dropdown on the edge midpoint. The old midpoint `<select>` was
 * deleted along with the per-edge `setEdgeCondition` action; the visible
 * edge shape only encodes a colour cue + a small label when the
 * condition is non-default.
 */

import { type EdgeProps, EdgeLabelRenderer, BaseEdge, getBezierPath } from 'reactflow';

import {
  EDGE_CONDITIONS,
  EDGE_CONDITION_COLORS,
} from '@/constants/edgeConditions';
import { type ConditionEdgeData, DISPATCH_MODE_PER_ITEM } from './editorTypes';

export function ConditionEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
  selected,
}: EdgeProps<ConditionEdgeData>) {
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
  const hasLabel = condition !== EDGE_CONDITIONS.DEFAULT;
  // #35: visual marker for dynamic fan-out. A small `↴ per-item` chip
  // sits alongside the condition badge (or alone, on a default-condition
  // edge that's only dispatching). The chip is read-only — toggling
  // dispatch on/off happens in the EdgePanel inspector.
  const isDispatch = data?.dispatchMode === DISPATCH_MODE_PER_ITEM;

  return (
    <>
      <BaseEdge
        id={id}
        path={edgePath}
        style={{
          stroke: color,
          // Dispatching edges get a slightly thicker stroke + a dashed
          // pattern so the parallel-fanout shape is visible at a glance
          // even without zooming in to read the chip.
          strokeWidth: selected ? 2.5 : isDispatch ? 2 : 1.5,
          strokeDasharray: isDispatch ? '6 3' : undefined,
        }}
      />
      {(hasLabel || isDispatch) && (
        <EdgeLabelRenderer>
          {/* Pure read-only badges: condition (when non-default) +
              dispatch chip (when fan-out is on). Stacked horizontally
              to keep the inline annotation tight. The author changes
              either by routing to a different port (condition) or
              opening the EdgePanel (dispatch). */}
          <div
            className="nodrag nopan absolute flex items-center gap-1"
            style={{ transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)` }}
          >
            {hasLabel && (
              <span
                className="rounded border bg-card px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground shadow"
                style={{ borderColor: color, color }}
              >
                {condition}
              </span>
            )}
            {isDispatch && (
              <span
                className="rounded border border-blue-500 bg-blue-50 px-1.5 py-0.5 text-[10px] font-medium text-blue-700 shadow"
                title={`Dynamic fan-out: one parallel target invocation per item in "${data?.itemsSlot ?? '?'}".`}
                data-testid="dispatch-badge"
              >
                ↴ per-item
              </span>
            )}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
}
