/**
 * Left-sidebar palette inside the flow editor canvas area. Lists the
 * draggable node entries (Agent, If/Else, End) — Start is auto-placed by
 * `newFlowGraph()` and intentionally absent here (LangGraph has exactly
 * one entry; a draggable Start would create a dead state on the second
 * drop).
 *
 * Today the entries are click-to-add at a cascading default position
 * (matches today's "Add node" button affordance, just with three kinds).
 * True drag-from-palette is a follow-up — it adds DOM dragstart + a
 * canvas drop target, which is more code than this branch's scope.
 */

import { useEffect, useRef, useState } from 'react';
import { GripVertical } from 'lucide-react';
import { useReactFlow } from 'reactflow';

import { useFlowEditorStore } from './useFlowEditorStore';
import { PALETTE, type PaletteKey } from './paletteRegistry';

interface Props {
  /** Optional id-prefix scope for the panel — useful when more than one
   *  editor is rendered in tests. Defaults to a stable label. */
  ariaLabel?: string;
}

export function PalettePanel({ ariaLabel = 'Add node' }: Props) {
  const addAgent = useFlowEditorStore((s) => s.addAgentNode);
  const addIfElse = useFlowEditorStore((s) => s.addIfElseNode);
  const addEnd = useFlowEditorStore((s) => s.addEndNode);
  // React Flow viewport handle. Used for two things:
  //  1. screenToFlowPosition — convert screen px → flow coords so the
  //     initial drop sits where the user expects.
  //  2. setCenter (called post-drop) — pan the viewport so the new
  //     node is at the visible centre AFTER any state cascade
  //     (NodePanel opening, canvas resizing) has settled. This is the
  //     reliable way to guarantee the node is visible regardless of
  //     pre-existing pan/zoom or whether the side panel was open.
  const reactFlow = useReactFlow();

  // Drag-to-reposition state. `position` is null until the user moves
  // the palette for the first time — that keeps the initial CSS-driven
  // top-3/left-3 placement working without race-prone measurements on
  // mount. Once set, it's an absolute offset (px) inside the canvas
  // column (the `relative` parent set up by FlowEditorView).
  const navRef = useRef<HTMLElement | null>(null);
  const [position, setPosition] = useState<{ x: number; y: number } | null>(null);
  const dragStateRef = useRef<{
    parentRect: DOMRect;
    pointerOffsetX: number;
    pointerOffsetY: number;
    navWidth: number;
    navHeight: number;
  } | null>(null);
  const [dragging, setDragging] = useState(false);

  function onHandlePointerDown(e: React.PointerEvent<HTMLDivElement>) {
    // Left-button only; ignore right-click / middle-click.
    if (e.button !== 0) return;
    const nav = navRef.current;
    const parent = nav?.offsetParent as HTMLElement | null;
    if (!nav || !parent) return;
    const navRect = nav.getBoundingClientRect();
    const parentRect = parent.getBoundingClientRect();
    dragStateRef.current = {
      parentRect,
      pointerOffsetX: e.clientX - navRect.left,
      pointerOffsetY: e.clientY - navRect.top,
      navWidth: navRect.width,
      navHeight: navRect.height,
    };
    setDragging(true);
    e.preventDefault();
  }

  useEffect(() => {
    if (!dragging) return;
    function onMove(e: PointerEvent) {
      const s = dragStateRef.current;
      if (!s) return;
      // Translate cursor → palette top-left relative to its positioning
      // parent. Clamp inside the parent so the palette can't be dragged
      // entirely off-canvas (leave 24px of palette visible on each edge).
      const minVisible = 24;
      let x = e.clientX - s.parentRect.left - s.pointerOffsetX;
      let y = e.clientY - s.parentRect.top - s.pointerOffsetY;
      x = Math.max(minVisible - s.navWidth, Math.min(s.parentRect.width - minVisible, x));
      y = Math.max(0, Math.min(s.parentRect.height - minVisible, y));
      setPosition({ x, y });
    }
    function onUp() {
      setDragging(false);
      dragStateRef.current = null;
    }
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
  }, [dragging]);

  /** Approximate rendered box (in flow units at zoom 1) used to offset
   *  the drop position so the node's CENTRE lands at the requested
   *  point (React Flow positions a node by its top-left corner).
   *  Boundary cards are about half the width of agent cards per the
   *  `MinimalCard` Tailwind utilities. */
  function nodeHalfSize(kind: PaletteKey) {
    return kind === 'end'
      ? { halfW: 48, halfH: 12 }
      : { halfW: 70, halfH: 18 };
  }

  /** Initial drop position in flow coords — the current viewport centre,
   *  offset by half the node so the node's centre lands there. The
   *  post-drop `setCenter` below pans the viewport to make the node
   *  reliably visible regardless of how the rest of the layout reacts. */
  function dropPosition(kind: PaletteKey): { x: number; y: number } {
    const { halfW, halfH } = nodeHalfSize(kind);
    const reactFlowEl = navRef.current?.closest('.react-flow') as HTMLElement | null;
    const rect = reactFlowEl?.getBoundingClientRect();
    if (!rect) return { x: 400 - halfW, y: 200 - halfH };
    const centre = reactFlow.screenToFlowPosition({
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2,
    });
    return { x: centre.x - halfW, y: centre.y - halfH };
  }

  function onAdd(key: PaletteKey) {
    const pos = dropPosition(key);
    if (key === 'agent') addAgent(pos);
    else if (key === 'if_else') addIfElse(pos);
    else addEnd(pos);
    // Pan the viewport so the new node is at the visible centre AFTER
    // the React state cascade settles — for agent/decision drops the
    // NodePanel side drawer mounts and the canvas shrinks by 360px on
    // the right, so a "centre" computed pre-drop would land under (or
    // right of the centre of) the just-opened panel. Two RAFs let
    // React commit + layout flush before we pan, so setCenter measures
    // the post-resize viewport. Preserving the user's current zoom
    // keeps the pan smooth (no surprise zoom-in/out).
    const { halfW, halfH } = nodeHalfSize(key);
    const nodeCentreX = pos.x + halfW;
    const nodeCentreY = pos.y + halfH;
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const { zoom } = reactFlow.getViewport();
        reactFlow.setCenter(nodeCentreX, nodeCentreY, { duration: 250, zoom });
      });
    });
  }

  return (
    // Floating "tool tray" — overlays the canvas at the top-left
    // corner rather than taking a fixed column. `absolute` lifts it
    // out of the flex row so React Flow gets the full canvas width;
    // `z-10` keeps it above the React Flow background grid + edges
    // but below modals. `w-fit` sizes the panel to its widest row
    // (the longest label — currently "Decision") instead of a fixed
    // px width that wastes space. The user can drag the header to
    // move the tray out of the way when it covers a node.
    <nav
      ref={navRef}
      aria-label={ariaLabel}
      className={[
        'absolute z-10 flex w-fit flex-col gap-1 rounded-xl border border-border/60 bg-card/95 p-2.5 shadow-sm backdrop-blur-sm',
        position ? '' : 'left-3 top-3',
        dragging ? 'select-none' : '',
      ].join(' ')}
      style={position ? { left: position.x, top: position.y } : undefined}
    >
      {/* Drag handle. Only this strip starts a reposition — the
          buttons below stay clickable and don't get hijacked by a
          stray pointerdown. The grip icon + cursor-move signal that
          the strip is grabbable. */}
      <div
        onPointerDown={onHandlePointerDown}
        className={[
          'flex items-center gap-1.5 px-2 pb-1 pt-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground/80',
          dragging ? 'cursor-grabbing' : 'cursor-grab',
        ].join(' ')}
        title="Drag to move the palette"
      >
        <GripVertical size={12} aria-hidden="true" className="opacity-60" />
        <h2 className="leading-none">Nodes</h2>
      </div>
      {PALETTE.map((entry) => {
        const Icon = entry.icon;
        return (
          <button
            key={entry.key}
            type="button"
            onClick={() => onAdd(entry.key)}
            title={entry.description}
            // Row layout: colored icon tile + label. Hover gives a soft
            // background bump on the whole row so it reads as a single
            // clickable target, and the icon tile saturates slightly via
            // the parent's group-hover.
            className="group flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left text-sm transition hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
          >
            <span
              className={[
                'inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md transition group-hover:scale-[1.04]',
                entry.iconTileClass,
              ].join(' ')}
              aria-hidden="true"
            >
              <Icon size={18} strokeWidth={2.2} className={entry.iconClass} />
            </span>
            <span className="font-medium leading-none">{entry.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
