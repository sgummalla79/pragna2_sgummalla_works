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

import { useFlowEditorStore } from './useFlowEditorStore';
import { PALETTE, type PaletteKey } from './paletteRegistry';

/** Cascading offset so successive adds don't stack on top of each other. */
const CASCADE_OFFSET = 32;

interface Props {
  /** Optional id-prefix scope for the panel — useful when more than one
   *  editor is rendered in tests. Defaults to a stable label. */
  ariaLabel?: string;
}

export function PalettePanel({ ariaLabel = 'Add node' }: Props) {
  const nodes = useFlowEditorStore((s) => s.nodes);
  const addAgent = useFlowEditorStore((s) => s.addAgentNode);
  const addIfElse = useFlowEditorStore((s) => s.addIfElseNode);
  const addEnd = useFlowEditorStore((s) => s.addEndNode);

  function dropPosition(): { x: number; y: number } {
    // Cascade off the count of non-boundary nodes so it grows with the
    // graph but doesn't double-count the auto-placed Start/End. y stays
    // around 200 (the horizontal centre-line for new flows).
    const agentCount = nodes.filter((n) => n.type === 'agent').length;
    return { x: 280 + (agentCount % 4) * 60, y: 160 + agentCount * CASCADE_OFFSET };
  }

  function onAdd(key: PaletteKey) {
    const pos = dropPosition();
    if (key === 'agent') addAgent(pos);
    else if (key === 'if_else') addIfElse(pos);
    else addEnd({ x: 720, y: 160 + nodes.filter((n) => n.type === 'boundary').length * CASCADE_OFFSET });
  }

  return (
    // Floating "tool tray" — sits inside the canvas area as a card with
    // its own elevation, NOT a flat sticky sidebar. m-3 keeps the
    // canvas grid visible around the tray; w-52 gives the rows breathing
    // room without dominating the canvas.
    <nav
      aria-label={ariaLabel}
      className="m-3 flex w-52 shrink-0 flex-col gap-0.5 self-start rounded-xl border border-border/60 bg-card/95 p-2 shadow-sm backdrop-blur-sm"
    >
      <h2 className="px-2 pb-1 pt-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/80">
        Nodes
      </h2>
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
            className="group flex items-center gap-2.5 rounded-lg px-2 py-1.5 text-left text-[13px] transition hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
          >
            <span
              className={[
                'inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md transition group-hover:scale-[1.04]',
                entry.iconTileClass,
              ].join(' ')}
              aria-hidden="true"
            >
              <Icon size={15} strokeWidth={2.2} className={entry.iconClass} />
            </span>
            <span className="font-medium leading-none">{entry.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
