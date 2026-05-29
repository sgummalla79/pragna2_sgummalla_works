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
import { type ConditionEdgeData } from './editorTypes';

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

  return (
    <>
      <BaseEdge
        id={id}
        path={edgePath}
        style={{
          stroke: color,
          strokeWidth: selected ? 2.5 : 1.5,
        }}
      />
      {hasLabel && (
        <EdgeLabelRenderer>
          {/* Pure read-only badge: name the branch this edge represents
              ("passed", "failed", custom emit). The author changes which
              branch by re-routing the edge to a different port on the
              source If/Else node — there is no dropdown here anymore. */}
          <div
            className="nodrag nopan absolute"
            style={{ transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)` }}
          >
            <span
              className="rounded border bg-card px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground shadow"
              style={{ borderColor: color, color }}
            >
              {condition}
            </span>
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
}
