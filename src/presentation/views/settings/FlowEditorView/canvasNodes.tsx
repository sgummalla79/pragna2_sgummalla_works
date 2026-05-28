/**
 * Custom React Flow node renderers for the visual flow editor.
 *
 * - `AgentNode` — a clickable card showing the node_id, its agent's
 *   display name, and the model it runs on. Clicking selects it (the
 *   side-panel opens to edit the inline agent).
 * - `BoundaryNode` — the non-deletable `__start__` / `__end__` markers.
 *
 * Both expose a `Handle` on ALL FOUR sides. Combined with
 * `ConnectionMode.Loose` on the canvas, a connector can be drawn out of
 * any side and into any side — so a back-edge (e.g. reviewer → drafter)
 * can leave one node's left and enter another's left, routing cleanly
 * instead of looping. Each handle has a stable per-side id (`top` /
 * `right` / `bottom` / `left`) so the chosen sides persist across saves.
 */

import { Handle, type NodeProps, Position } from 'reactflow';

import { type AgentNodeData, type BoundaryNodeData, NODE_START } from './editorTypes';

// Hidden until the node is hovered (the wrapper sets `group`), so four
// handles per node don't clutter the canvas at rest. opacity-0 elements
// stay interactive, so you can still grab a hidden handle the moment you
// hover. Visible too while a connection is being dragged.
const HANDLE_CLASS =
  '!h-2.5 !w-2.5 !bg-muted-foreground opacity-0 transition-opacity group-hover:opacity-100';

/** A source+target-capable handle on each side (Loose mode lets a
 *  `source` handle also receive connections, so one set covers both). */
function SideHandles() {
  return (
    <>
      <Handle id="top" type="source" position={Position.Top} className={HANDLE_CLASS} />
      <Handle id="right" type="source" position={Position.Right} className={HANDLE_CLASS} />
      <Handle id="bottom" type="source" position={Position.Bottom} className={HANDLE_CLASS} />
      <Handle id="left" type="source" position={Position.Left} className={HANDLE_CLASS} />
    </>
  );
}

export function AgentNode({ data, selected }: NodeProps<AgentNodeData>) {
  const agent = data.agent;
  const hasModel = Boolean(agent.userModel);
  const slotCount = (data.inputs?.length ?? 0) + (data.outputs?.length ?? 0);
  return (
    <div
      className={[
        'group min-w-[180px] max-w-[240px] rounded-[10px] border bg-card px-3 py-2 text-card-foreground shadow-sm transition',
        selected ? 'border-primary ring-2 ring-primary/40' : 'border-border',
      ].join(' ')}
    >
      <SideHandles />
      <div className="text-[12px] font-semibold leading-tight">{data.nodeId}</div>
      <div className="mt-0.5 truncate text-[11px] text-muted-foreground">
        {agent.displayName || agent.apiName || 'unnamed agent'}
      </div>
      <div className="mt-1.5 flex flex-wrap items-center gap-1">
        <span
          className={[
            'rounded px-1.5 py-0.5 text-[10px]',
            hasModel
              ? 'bg-muted text-muted-foreground'
              : 'bg-destructive/15 text-destructive',
          ].join(' ')}
        >
          {hasModel ? agent.userModel : 'no model'}
        </span>
        {agent.emits.length > 0 && (
          <span className="rounded bg-primary/15 px-1.5 py-0.5 text-[10px] text-primary">
            {agent.emits.length} emit{agent.emits.length > 1 ? 's' : ''}
          </span>
        )}
        {slotCount > 0 && (
          <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
            slots
          </span>
        )}
      </div>
    </div>
  );
}

export function BoundaryNode({ data }: NodeProps<BoundaryNodeData>) {
  const isStart = data.boundary === NODE_START;
  return (
    <div className="group rounded-lg border border-dashed border-border bg-muted px-3 py-1.5 text-[12px] text-muted-foreground">
      <SideHandles />
      {isStart ? '▶ Start' : '■ End'}
    </div>
  );
}
