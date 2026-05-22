import { useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';
import type { Skill } from '@/domain/types/skill.types';

interface Props {
  /** Filtered skills to show (already capped). */
  items: Skill[];
  /** Currently highlighted index. Parent owns navigation state so the
   *  textarea's keyDown handler can drive ArrowUp/Down/Enter. */
  selectedIndex: number;
  /** Called when the user clicks (or keyboard-confirms) an item. */
  onSelect: (skill: Skill) => void;
  /** Hover synchronisation — clicking would auto-select the hovered item
   *  but we also want keyboard navigation to follow mouse position when
   *  the user wiggles the cursor. */
  onHoverIndex: (index: number) => void;
}

/**
 * R4 #2 slash-command discovery popover.
 *
 * Floats just above the chat composer when the user types `/` at the
 * start of a word. Lists the user's enabled skills filtered by prefix
 * match against the text after the slash. Selection inserts
 * ``/<skill.name> `` at the cursor; the LLM recognises its own tool
 * names and dispatches to the right skill mid-turn.
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
        {items.map((skill, idx) => {
          const active = idx === selectedIndex;
          return (
            <li
              key={skill.id}
              ref={active ? selectedRef : null}
              role="option"
              aria-selected={active}
              onMouseDown={(e) => {
                // mousedown (not click) so the textarea doesn't lose
                // focus + close the popover before the select fires.
                e.preventDefault();
                onSelect(skill);
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
                /{skill.name}
              </span>
              {skill.description && (
                <span className="text-[11px] text-muted-foreground line-clamp-2">
                  {skill.description}
                </span>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
