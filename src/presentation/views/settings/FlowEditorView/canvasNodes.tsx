/**
 * Custom React Flow node renderers for the visual flow editor.
 *
 * Post-#33 the visual model is:
 *   - Every node card shares the SAME neutral dark body (no per-type
 *     background tint) — uniform black on the dark canvas. The role is
 *     read off the colored icon-tile chip at the top-left, not off the
 *     card colour.
 *   - Selected nodes get a SOLID WHITE border highlight (no dashed
 *     boundary border, no orange ring). One visual language for
 *     "selected" across boundaries and agents.
 *   - Icon tiles are vivid (full-saturation) brand-colour squares with
 *     a white icon inside — same hue as the matching palette entry, so
 *     dropping an "Agent" gives you a card with a sky-blue chip; "If/Else"
 *     amber; "End" rose; "Start" emerald.
 *
 * Three concrete node shapes:
 *   - **Agent** (`AgentNode`) — when `agent.emits` is empty: chat agent,
 *     4 omni handles (back-edge routing preserved). When non-empty: If/Else
 *     router, 1 left target + N+1 right `port:<emit>` + `port:else`.
 *   - **Start** (singleton boundary) — single right-side `source` id 'out'.
 *   - **End** (multi-instance boundary) — single left-side `target` id 'in'.
 */

import { Handle, type NodeProps, Position } from 'reactflow';

import { EDGE_CONDITIONS } from '@/constants/edgeConditions';

import {
  type AgentNodeData,
  type BoundaryNodeData,
  NODE_START,
  PORT_HANDLE_ELSE,
  portHandleFor,
} from './editorTypes';
import {
  END_ICON_TILE_CLASS,
  START_ICON,
  START_ICON_TILE_CLASS,
  paletteEntryFor,
} from './paletteRegistry';

// Faint dots that bump to full opacity on the parent's group-hover.
const HANDLE_CLASS =
  '!h-1 !w-1 !min-h-0 !min-w-0 !bg-muted-foreground opacity-30 transition-opacity group-hover:opacity-100';

// Slightly larger + label-friendly variant for Decision's named ports.
const PORT_HANDLE_CLASS =
  '!h-1.5 !w-1.5 !min-h-0 !min-w-0 !bg-primary opacity-70 transition-opacity group-hover:opacity-100';

// Uniform card body + selected-state highlight. `border-foreground` is
// white in dark mode (theme-token-aware), matching the user-locked
// "white border highlight, not dashed" spec across both modes.
const CARD_BASE = 'bg-card text-card-foreground border border-border';
const CARD_SELECTED = 'border-foreground ring-2 ring-foreground/40';

/** 4 omni-directional source+target handles (Loose-mode source can also
 *  receive). Each handle has a stable per-side id so the chosen sides
 *  persist across save/reload via `metadata.edge_handles`. */
function OmniHandles() {
  return (
    <>
      <Handle id="top" type="source" position={Position.Top} className={HANDLE_CLASS} />
      <Handle id="right" type="source" position={Position.Right} className={HANDLE_CLASS} />
      <Handle id="bottom" type="source" position={Position.Bottom} className={HANDLE_CLASS} />
      <Handle id="left" type="source" position={Position.Left} className={HANDLE_CLASS} />
    </>
  );
}

/** A minimal card: vivid icon tile + type label + optional display name. */
function MinimalCard({
  label,
  displayName,
  Icon,
  iconTileClass,
  iconClass,
  selected,
  compact = false,
}: {
  label: string;
  displayName?: string;
  Icon: React.ComponentType<{ size?: number; strokeWidth?: number; className?: string }>;
  iconTileClass: string;
  /** Optional transform on the icon glyph (e.g. `-rotate-90`). */
  iconClass?: string;
  selected: boolean;
  /** Boundary nodes (Start / End) skip the display-name row so they
   *  stay compact — there's no agent identity to show. */
  compact?: boolean;
}) {
  return (
    <div
      className={[
        'rounded-[6px] shadow-sm transition',
        compact ? 'min-w-[72px] max-w-[96px] px-1 py-0.5' : 'min-w-[104px] max-w-[140px] px-1.5 py-0.5',
        CARD_BASE,
        selected ? CARD_SELECTED : '',
      ].join(' ')}
    >
      <div className="flex items-center gap-1">
        <span
          className={[
            'inline-flex h-4 w-4 shrink-0 items-center justify-center rounded',
            iconTileClass,
          ].join(' ')}
          aria-hidden="true"
        >
          <Icon size={9} strokeWidth={2.2} className={iconClass} />
        </span>
        <span className="text-[9px] font-semibold leading-tight">{label}</span>
      </div>
      {!compact && (
        <div className="mt-0.5 truncate text-[8px] text-muted-foreground">
          {displayName || 'unnamed'}
        </div>
      )}
    </div>
  );
}

export function AgentNode({ data, selected }: NodeProps<AgentNodeData>) {
  const agent = data.agent;
  // Branching is driven by emits, not a stored kind — emits.length > 0
  // means this node owns a set_route binding (BE behaviour post-#25).
  const branching = agent.emits.length > 0;
  const paletteKey = branching ? 'if_else' : 'agent';
  const entry = paletteEntryFor(paletteKey);

  // `group` wrapper is the hover target for the handle dots'
  // `group-hover:opacity-100` rule. Must enclose BOTH the card and the
  // <Handle> elements (which are siblings, not children of MinimalCard).
  return (
    <div className="group">
      <MinimalCard
        label={entry.label}
        displayName={agent.displayName || agent.apiName || data.nodeId}
        Icon={entry.icon}
        iconTileClass={entry.iconTileClass}
        iconClass={entry.iconClass}
        selected={!!selected}
      />
      {branching ? (
        <>
          {/* If/Else: single inbound target on the left, N+1 outbound
              source ports on the right — one per declared emit + a
              permanent `else` port that serializes to EDGE_DEFAULT. The
              edge's condition is DERIVED from which port it leaves. */}
          <Handle
            id="in"
            type="target"
            position={Position.Left}
            className={PORT_HANDLE_CLASS}
          />
          {[...agent.emits, EDGE_CONDITIONS.DEFAULT].map((emit, idx, arr) => {
            const isElse = emit === EDGE_CONDITIONS.DEFAULT;
            const handleId = isElse ? PORT_HANDLE_ELSE : portHandleFor(emit);
            // Distribute the ports vertically along the right edge.
            const top = `${((idx + 1) / (arr.length + 1)) * 100}%`;
            return (
              <Handle
                key={handleId}
                id={handleId}
                type="source"
                position={Position.Right}
                className={PORT_HANDLE_CLASS}
                style={{ top }}
                title={isElse ? 'else (default — fires when no declared emit matched)' : emit}
              />
            );
          })}
        </>
      ) : (
        // Content-producing Agent: 4 omni handles preserve back-edge
        // routing flexibility (loops can leave one side and enter the
        // other without an awkward bottom→top arc).
        <OmniHandles />
      )}
    </div>
  );
}

/** Boundary node renderer — handles both Start (singleton, right source)
 *  and End (multi-instance, left target). Same minimal-card body as
 *  agents; the icon-tile colour signals the role. */
export function BoundaryNode({ data, selected }: NodeProps<BoundaryNodeData>) {
  const isStart = data.boundary === NODE_START;
  const Icon = isStart ? START_ICON : paletteEntryFor('end').icon;
  const iconTileClass = isStart ? START_ICON_TILE_CLASS : END_ICON_TILE_CLASS;
  const label = isStart ? 'Start' : 'End';
  // `group` wrapper anchors the handle dots' `group-hover:opacity-100`
  // rule — see AgentNode above for the same pattern + reasoning.
  return (
    <div className="group">
      <MinimalCard
        label={label}
        Icon={Icon}
        iconTileClass={iconTileClass}
        selected={!!selected}
        compact
      />
      {isStart ? (
        <Handle
          id="out"
          type="source"
          position={Position.Right}
          className={HANDLE_CLASS}
        />
      ) : (
        <Handle
          id="in"
          type="target"
          position={Position.Left}
          className={HANDLE_CLASS}
        />
      )}
    </div>
  );
}
