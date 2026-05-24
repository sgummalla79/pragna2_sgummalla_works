import { BaseEdge, EdgeLabelRenderer, type EdgeProps } from 'reactflow';

/**
 * Custom reactflow edge that routes back-edges (loops) along a side
 * channel so they don't overlap forward edges (R10 #1).
 *
 * Why this exists: dagre packs nodes in a TB rank order. A loop edge
 * (e.g. ``review_1 → intake_1 on failed``) has a target above its
 * source in screen coords, but reactflow's default ``smoothstep``
 * renderer routes it along the same vertical channel as the forward
 * ``intake_1 → review_1`` edge — they literally trace the same line
 * and the user sees one stacked path with no visible distinction. We
 * detect the topology in :func:`yamlToGraph` and tag those edges
 * ``type: 'loopback'`` so this component takes over their rendering.
 *
 * Routing strategy: a single SVG bezier curve that exits the source's
 * right edge, bulges out to the right by a margin proportional to the
 * vertical distance the edge has to climb, and re-enters the target's
 * right edge. Self-loops (src === dst) get a small fixed bulge so
 * they show up as a visible round-trip arc instead of a zero-length
 * dot.
 *
 * Drag-to-edit waypoints are NOT included. The R10 #1 scope was
 * "make loops not stack on top of forward edges" — the auto-route
 * here solves that without the interactive-waypoint complexity (drag
 * handles, persistence of waypoints, undo/redo). If a future need
 * surfaces real bend-point editing, layer it on top of this.
 */

/** Pixels — minimum horizontal bulge for a self-loop or zero-rise edge. */
const MIN_BULGE_PX = 80;
/** Pixels — extra bulge per unit of vertical climb. Keeps wider loops
 *  from collapsing into the right edge of the canvas while small
 *  one-rank loops stay tight. */
const BULGE_PER_RISE_PX = 0.5;

export function LoopBackEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  label,
  labelStyle,
  labelBgStyle,
  style,
  markerEnd,
}: EdgeProps) {
  // Vertical climb the loop has to make. ``rise`` is positive when
  // the target sits above the source (the loopback case); zero for
  // self-loops.
  const rise = Math.max(0, sourceY - targetY);
  const bulge = MIN_BULGE_PX + rise * BULGE_PER_RISE_PX;
  // Anchor handles to the right edge of each node. The source/target
  // x/y reactflow hands us are the handle CENTERS — we route via the
  // right edge regardless of which handle dagre originally picked.
  const sx = sourceX + 4;
  const tx = targetX + 4;

  // Single cubic bezier — control points sit out to the right at the
  // midpoint y so the curve bulges symmetrically around the source /
  // target. For self-loops both endpoints coincide; offsetting the
  // bezier control points vertically too makes the loop visible.
  const midY = (sourceY + targetY) / 2;
  const controlOffsetY = sourceX === targetX && sourceY === targetY ? 30 : 0;
  const path = `M ${sx} ${sourceY} C ${sx + bulge} ${sourceY - controlOffsetY}, ${tx + bulge} ${targetY + controlOffsetY}, ${tx} ${targetY}`;

  // Position the label at the apex of the bulge.
  const labelX = Math.max(sx, tx) + bulge * 0.7;
  const labelY = midY;

  return (
    <>
      <BaseEdge id={id} path={path} markerEnd={markerEnd} style={style} />
      {label && (
        <EdgeLabelRenderer>
          <div
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
              padding: '1px 4px',
              borderRadius: 3,
              fontSize: 10,
              pointerEvents: 'all',
              // labelStyle / labelBgStyle on Edge are SVG-text shapes
              // (fill / stroke). Convert what we use here to CSS
              // equivalents so the HTML label reads from the same
              // palette tokens the rest of the canvas does.
              color:
                (labelStyle as { fill?: string } | undefined)?.fill ??
                'var(--color-muted-foreground)',
              background:
                (labelBgStyle as { fill?: string } | undefined)?.fill ??
                'var(--color-popover)',
            }}
            className="nodrag nopan"
          >
            {label}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
}
