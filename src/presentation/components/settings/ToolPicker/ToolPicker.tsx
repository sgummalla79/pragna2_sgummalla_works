/**
 * Hybrid tools picker (Wedge B.2).
 *
 * Wraps ChipInput with an autocomplete dropdown sourced from
 * `GET /api/tools`. Hybrid by design:
 *
 * - Typing surfaces matching tools (filtered against `apiName` AND
 *   `displayName`). Click / ↓+Enter to insert a known chip.
 * - Pressing Enter (or comma) when no suggestion is highlighted commits
 *   the freeform text — same as ChipInput's behaviour. Lets flow
 *   authors pre-author tools that don't exist yet, and preserves
 *   chips for previously-known tools whose MCP server got archived.
 * - Chips whose api_name isn't in the current tool list render with a
 *   ⚠️ "unknown" badge. The chip still works — the resolver decides
 *   at runtime; we just surface the state.
 *
 * Drop-in API-compatible with the existing ChipInput, plus optional
 * tool metadata accessed implicitly via `useTools()`.
 */

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from 'react';
import { AlertTriangle, X } from 'lucide-react';
import { Input } from '@/presentation/components/ui/Input';
import { Badge } from '@/presentation/components/ui/Badge';
import { useTools } from '@/presentation/hooks/tools/useTools';
import type { Tool } from '@/domain/types/tool.types';

interface Props {
  id?: string;
  /** Selected tool api_names. */
  values: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
  /** Friendly accessible label e.g. "tool". Used in remove buttons. */
  label: string;
}

/** Max suggestions shown in the dropdown at once. */
const MAX_SUGGESTIONS = 8;

export function ToolPicker({
  id,
  values,
  onChange,
  placeholder,
  label,
}: Props) {
  const [draft, setDraft] = useState('');
  const [open, setOpen] = useState(false);
  const [highlightIndex, setHighlightIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement | null>(null);

  // Tools list is the source of truth for autocomplete + unknown badge.
  // Failure / loading states fall back gracefully to "no suggestions" —
  // the picker still works in freeform mode.
  const { data: tools = [] } = useTools();

  const knownApiNames = useMemo(
    () => new Set<string>(tools.map((t) => t.apiName)),
    [tools],
  );

  // Suggestions: case-insensitive startsWith match against apiName OR
  // displayName. Already-selected api_names are excluded so the picker
  // doesn't suggest re-adding what's already a chip.
  const suggestions = useMemo<Tool[]>(() => {
    if (!open || draft.trim() === '') return [];
    const needle = draft.toLowerCase().trim();
    const selected = new Set(values);
    return tools
      .filter((t) => !selected.has(t.apiName))
      .filter(
        (t) =>
          t.apiName.toLowerCase().startsWith(needle) ||
          t.displayName.toLowerCase().startsWith(needle),
      )
      .slice(0, MAX_SUGGESTIONS);
  }, [tools, draft, open, values]);

  // Keep the highlight index in bounds when the suggestion list shrinks.
  useEffect(() => {
    if (highlightIndex >= suggestions.length) {
      setHighlightIndex(0);
    }
  }, [suggestions.length, highlightIndex]);

  function commit(raw: string) {
    const next = raw.trim();
    if (!next || values.includes(next)) {
      setDraft('');
      return;
    }
    onChange([...values, next]);
    setDraft('');
    setOpen(false);
  }

  function commitSuggestion(t: Tool) {
    if (values.includes(t.apiName)) {
      setDraft('');
      return;
    }
    onChange([...values, t.apiName]);
    setDraft('');
    setOpen(false);
    // Refocus so the user can keep typing more chips.
    requestAnimationFrame(() => inputRef.current?.focus());
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    // Popover-aware keys: ↑↓ navigate, Enter accepts the highlighted
    // suggestion (or commits freeform when no suggestion exists),
    // Escape closes the popover without committing.
    if (open && suggestions.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setHighlightIndex((i) => (i + 1) % suggestions.length);
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setHighlightIndex(
          (i) => (i - 1 + suggestions.length) % suggestions.length,
        );
        return;
      }
      if (e.key === 'Enter') {
        e.preventDefault();
        commitSuggestion(suggestions[highlightIndex]);
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        setOpen(false);
        return;
      }
    }

    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      commit(draft);
    } else if (e.key === 'Backspace' && draft === '' && values.length > 0) {
      // Quick-remove the last chip when the input is empty.
      onChange(values.slice(0, -1));
    }
  }

  return (
    <div className="relative">
      <div className="flex flex-wrap items-center gap-1.5 rounded-md border border-border bg-input px-2 py-1.5 min-h-[2.75rem]">
        {values.map((v) => {
          const isUnknown = !knownApiNames.has(v);
          return (
            <Badge
              key={v}
              variant="secondary"
              className={
                isUnknown
                  ? 'gap-1 pr-1 border border-yellow-500/50 bg-yellow-500/10 text-yellow-700 dark:text-yellow-300'
                  : 'gap-1 pr-1'
              }
              title={isUnknown ? 'No matching tool found' : v}
            >
              {isUnknown && (
                <AlertTriangle
                  size={10}
                  aria-hidden="true"
                  className="text-yellow-600 dark:text-yellow-400"
                />
              )}
              <span className="font-mono text-[11px]">{v}</span>
              <button
                type="button"
                onClick={() => onChange(values.filter((x) => x !== v))}
                aria-label={`Remove ${label} ${v}`}
                className="rounded p-0.5 hover:bg-muted"
              >
                <X size={10} aria-hidden="true" />
              </button>
            </Badge>
          );
        })}
        <Input
          id={id}
          ref={inputRef}
          value={draft}
          onChange={(e) => {
            setDraft(e.target.value);
            setOpen(true);
            setHighlightIndex(0);
          }}
          onKeyDown={handleKeyDown}
          // Delay blur so dropdown clicks register before the popover
          // disappears. 100ms is enough for the mousedown→click pair.
          onBlur={() => {
            setTimeout(() => {
              commit(draft);
              setOpen(false);
            }, 100);
          }}
          onFocus={() => {
            if (draft.trim() !== '') setOpen(true);
          }}
          placeholder={values.length === 0 ? placeholder : undefined}
          className="flex-1 min-w-[120px] h-7 border-0 bg-transparent px-1 py-0 shadow-none focus-visible:ring-0 focus-visible:ring-offset-0"
        />
      </div>
      {open && suggestions.length > 0 && (
        <ul
          role="listbox"
          className="absolute left-0 right-0 top-full z-20 mt-1 max-h-64 overflow-y-auto rounded-md border border-border bg-popover shadow-md"
        >
          {suggestions.map((t, i) => (
            <li
              key={t.id}
              role="option"
              aria-selected={i === highlightIndex}
              // mousedown (not click) so the input's onBlur doesn't
              // close the popover before this fires.
              onMouseDown={(e) => {
                e.preventDefault();
                commitSuggestion(t);
              }}
              onMouseEnter={() => setHighlightIndex(i)}
              className={
                'flex cursor-pointer flex-col gap-0.5 px-3 py-2 text-xs ' +
                (i === highlightIndex ? 'bg-accent' : 'bg-transparent')
              }
            >
              <span className="font-mono text-[11px] font-medium">{t.apiName}</span>
              {t.description && (
                <span className="line-clamp-1 text-[10px] text-muted-foreground">
                  {t.description}
                </span>
              )}
              {!t.enabled && (
                <span className="text-[10px] text-yellow-600 dark:text-yellow-400">
                  (currently disabled — enable on its MCP server card)
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
