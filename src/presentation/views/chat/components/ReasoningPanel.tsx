import { useMemo, useState } from 'react';
import { CheckCircle2, ChevronDown, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ReasoningPanelProps {
  /** The model's extended-thinking trace (BE migration 0026). */
  reasoning: string;
  /**
   * When true the panel mounts expanded. Defaults to collapsed so a
   * persisted conversation reads as the answers, not the scratchpad —
   * the reasoning is one click away. The streaming surface passes
   * ``true`` so the trace is visible live as it arrives.
   */
  defaultOpen?: boolean;
}

/** Max characters of the collapsed-header summary before we ellipsise. */
const SUMMARY_MAX_CHARS = 96;

/**
 * Collapsible reasoning timeline rendered beneath an assistant turn.
 *
 * Mirrors the claude.ai "thinking" disclosure: a faint summary header with
 * a chevron that expands into a vertical timeline — a Clock node carrying
 * the full reasoning trace, then a Done node. Collapsed by default so the
 * thinking stays out of the way until the user wants to inspect (or guide)
 * the model's reasoning.
 *
 * Why a bespoke component and not a shared Collapsible: the project has no
 * Radix Collapsible installed and the disclosure here is single-purpose
 * (one trigger, one region) — a local ``useState`` toggle keeps the
 * dependency surface narrow per the design-system "reuse first, add only
 * when needed" rule.
 */
export function ReasoningPanel({
  reasoning,
  defaultOpen = false,
}: ReasoningPanelProps) {
  const [open, setOpen] = useState(defaultOpen);

  // Collapsed-header preview: first non-empty line, whitespace-collapsed
  // and ellipsised. Derived (not stored) so it always tracks the trace.
  const summary = useMemo(() => {
    const firstLine =
      reasoning
        .split('\n')
        .map((l) => l.trim())
        .find((l) => l.length > 0) ?? reasoning.trim();
    const collapsed = firstLine.replace(/\s+/g, ' ');
    return collapsed.length > SUMMARY_MAX_CHARS
      ? `${collapsed.slice(0, SUMMARY_MAX_CHARS).trimEnd()}…`
      : collapsed;
  }, [reasoning]);

  return (
    <div className="w-full">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className={cn(
          'group flex w-full items-center gap-1.5 rounded-md py-1.5 text-left',
          'text-[13px] text-muted-foreground transition-colors hover:text-foreground',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40',
        )}
      >
        <span className="min-w-0 flex-1 truncate">
          {open ? 'Reasoning' : summary}
        </span>
        <ChevronDown
          className={cn(
            'h-4 w-4 shrink-0 transition-transform duration-200',
            open && 'rotate-180',
          )}
          aria-hidden="true"
        />
      </button>

      {open && (
        // Timeline: a vertical guide line with two nodes (thinking → done).
        // ``before`` draws the connector between the node icons.
        <ol className="relative mt-1 space-y-3 pl-1">
          <li className="relative flex gap-3 pb-1">
            <span
              className={cn(
                'absolute left-[9px] top-5 h-[calc(100%-4px)] w-px bg-border',
              )}
              aria-hidden="true"
            />
            <Clock
              className="relative z-10 mt-0.5 h-[18px] w-[18px] shrink-0 text-muted-foreground"
              aria-hidden="true"
            />
            <p className="whitespace-pre-wrap break-words text-[14px] leading-relaxed text-muted-foreground">
              {reasoning}
            </p>
          </li>
          <li className="flex items-center gap-3">
            <CheckCircle2
              className="relative z-10 h-[18px] w-[18px] shrink-0 text-muted-foreground"
              aria-hidden="true"
            />
            <span className="text-[14px] text-muted-foreground">Done</span>
          </li>
        </ol>
      )}
    </div>
  );
}
