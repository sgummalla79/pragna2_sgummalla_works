import { useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';
import type { PragnaSlashFlow } from '@/domain/types/pragnaSlashFlow.types';

interface Props {
  /** Filtered slash flows to show (already capped). */
  items: PragnaSlashFlow[];
  /** Currently highlighted index. Parent owns navigation state so the
   *  textarea's keyDown handler can drive ArrowUp/Down/Enter. */
  selectedIndex: number;
  /** Called when the user clicks (or keyboard-confirms) an item. */
  onSelect: (flow: PragnaSlashFlow) => void;
  /** Hover synchronisation — clicking would auto-select the hovered item
   *  but we also want keyboard navigation to follow mouse position when
   *  the user wiggles the cursor. */
  onHoverIndex: (index: number) => void;
}

/**
 * Slash-command discovery popover.
 *
 * Floats just above the chat composer when the user types `/` at the
 * start of a word. Lists the user's slash-exposed flows filtered by
 * prefix match against the text after the slash. Selection inserts
 * ``/<flow.slash_api_name> `` at the cursor; the chat send hook routes
 * the run to ``POST /pragna/flows/{slash_api_name}``.
 *
 * Stateless: navigation + selection state lives in the parent so the
 * textarea's keyDown handler stays single-sourced.
 */
export function SlashCommandPopover({
  items,
  selectedIndex,
  onSelect,
  onHoverIndex,
}: Props) {
  // Scroll the selected item into view when keyboard navigation moves
  // it off-screen — only matters when the filtered list overflows the
  // popover's max height.
  const selectedRef = useRef<HTMLLIElement>(null);
  useEffect(() => {
    selectedRef.current?.scrollIntoView({ block: 'nearest' });
  }, [selectedIndex]);

  if (items.length === 0) return null;

  return (
    <div
      role="listbox"
      aria-label="Slash command suggestions"
      className={cn(
        'absolute left-0 right-0 bottom-full mb-2 z-30',
        'rounded-lg border border-border bg-popover text-popover-foreground shadow-xl',
        'overflow-hidden',
      )}
    >
      <ul className="max-h-[16rem] overflow-y-auto p-1 m-0 list-none">
        {items.map((flow, idx) => {
          const active = idx === selectedIndex;
          return (
            <li
              key={flow.slash_api_name}
              ref={active ? selectedRef : null}
              role="option"
              aria-selected={active}
              onMouseDown={(e) => {
                // mousedown (not click) so the textarea doesn't lose
                // focus + close the popover before the select fires.
                e.preventDefault();
                onSelect(flow);
              }}
              onMouseEnter={() => onHoverIndex(idx)}
              className={cn(
                'flex flex-col gap-0.5 px-2.5 py-1.5 rounded-md cursor-pointer',
                active
                  ? 'bg-accent text-accent-foreground'
                  : 'text-foreground',
              )}
            >
              <span className="font-mono text-[13px] font-semibold">
                /{flow.slash_api_name}
              </span>
              {flow.description && (
                <span className="text-[11px] text-muted-foreground line-clamp-2">
                  {flow.description}
                </span>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
