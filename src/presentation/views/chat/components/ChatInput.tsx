import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from 'react';
import { ArrowUp, Square } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useSkills } from '@/presentation/hooks/skills/useSkills';
import type { Skill } from '@/domain/types/skill.types';
import { SlashCommandPopover } from './SlashCommandPopover';

/** Max number of suggestions shown in the slash-command popover at once. */
const SLASH_MAX_ITEMS = 8;

interface ChatInputProps {
  /** Called when the user submits a non-empty turn. */
  onSend: (text: string) => void;
  /** Called when the user clicks Stop. Only rendered when ``disabled``. */
  onStop?: () => void;
  /** True while the parent run is in flight. */
  disabled?: boolean;
  /** Placeholder copy; injected so the view can localise per agent. */
  placeholder?: string;
  /**
   * Optional inline-attached content rendered ABOVE the textarea, inside
   * the rounded composer container. Use this for setup banners, file
   * chips, or any context that should visually belong to the composer
   * rather than sit on its own above. ChatLandingView passes its setup
   * banner here so the user reads "fix this first" without a separate
   * floating element above the input.
   */
  children?: ReactNode;
}

/**
 * Bottom chat composer — ChatGPT / Claude.ai style.
 *
 * A single rounded card that contains the optional banner slot, the
 * auto-growing textarea, and the send/stop button as a circular icon
 * nested at the bottom-right inside the container. No outer border
 * strip; the composer blends with the page surface in both themes via
 * semantic tokens.
 *
 * Behaviour:
 *   - ``Enter`` submits the current input; ``Shift+Enter`` inserts a newline.
 *   - Empty / whitespace-only submissions are silently ignored.
 *   - While ``disabled`` AND ``onStop`` is set (an in-flight run), the
 *     textarea stays editable so the user can draft the next turn while
 *     the current one streams; the send icon is replaced with a stop
 *     icon. When ``disabled`` is set without ``onStop`` (e.g. landing
 *     page without a connected provider), the textarea is truly disabled.
 *
 * The component is dumb — the parent owns ``disabled`` and ``onStop``.
 */
export function ChatInput({
  onSend,
  onStop,
  disabled = false,
  placeholder = 'Send a message…',
  children,
}: ChatInputProps) {
  const [value, setValue] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // ── R4 #2: slash-command discovery ──────────────────────────────────
  // Track an active `/` at the current cursor position (must be the
  // start of a word — start-of-string or preceded by whitespace).
  // The popover is rendered above the composer when active and there
  // are matching enabled skills; keyboard nav + Enter accept happen
  // inside the textarea's own keyDown handler so focus never moves.
  const { data: allSkills = [] } = useSkills();
  const [slashOpen, setSlashOpen] = useState(false);
  const [slashStart, setSlashStart] = useState(-1);
  const [slashQuery, setSlashQuery] = useState('');
  const [slashIndex, setSlashIndex] = useState(0);

  const filteredSkills = useMemo<Skill[]>(() => {
    if (!slashOpen) return [];
    const q = slashQuery.toLowerCase();
    return allSkills
      .filter((s) => s.enabled && s.name.toLowerCase().startsWith(q))
      .slice(0, SLASH_MAX_ITEMS);
  }, [allSkills, slashOpen, slashQuery]);

  // Detect / dismiss the popover whenever the value changes. The cursor
  // position is read off the live DOM element since the textarea owns
  // the selection — useState only tracks the text. Slash is "active"
  // when a `/` sits between the start of the current word and the
  // cursor, with no whitespace after it.
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    const cursor = el.selectionStart ?? value.length;
    // Walk backwards from the cursor: stop at the first whitespace
    // (word boundary) or the first `/`.
    let i = cursor - 1;
    while (i >= 0 && value[i] !== '/' && !/\s/.test(value[i])) i--;
    if (
      i >= 0 &&
      value[i] === '/' &&
      (i === 0 || /\s/.test(value[i - 1]))
    ) {
      const q = value.slice(i + 1, cursor);
      // The query must contain no whitespace — keeps the popover
      // closed for pasted text like "/foo bar".
      if (!/\s/.test(q)) {
        setSlashOpen(true);
        setSlashStart(i);
        setSlashQuery(q);
        setSlashIndex(0);
        return;
      }
    }
    setSlashOpen(false);
  }, [value]);

  const acceptSlash = useCallback(
    (skill: Skill) => {
      const before = value.slice(0, slashStart);
      const after = value.slice(slashStart + 1 + slashQuery.length);
      const next = `${before}/${skill.name} ${after}`;
      setValue(next);
      setSlashOpen(false);
      // Place cursor right after the inserted name (and trailing space)
      // so the user can keep typing the prompt without a manual click.
      const caret = before.length + 1 + skill.name.length + 1;
      requestAnimationFrame(() => {
        const el = textareaRef.current;
        if (!el) return;
        el.focus();
        el.setSelectionRange(caret, caret);
      });
    },
    [value, slashStart, slashQuery],
  );

  const submit = useCallback(() => {
    const trimmed = value.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setValue('');
  }, [value, disabled, onSend]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      // Popover-aware key handling. ArrowUp/Down navigate, Enter/Tab
      // accept the highlighted skill, Escape closes. All only when the
      // popover is actually showing something — otherwise these keys
      // get their normal textarea behaviour.
      if (slashOpen && filteredSkills.length > 0) {
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          setSlashIndex((i) => (i + 1) % filteredSkills.length);
          return;
        }
        if (e.key === 'ArrowUp') {
          e.preventDefault();
          setSlashIndex((i) =>
            i === 0 ? filteredSkills.length - 1 : i - 1,
          );
          return;
        }
        if ((e.key === 'Enter' || e.key === 'Tab') && !e.shiftKey) {
          e.preventDefault();
          acceptSlash(filteredSkills[slashIndex]);
          return;
        }
        if (e.key === 'Escape') {
          e.preventDefault();
          setSlashOpen(false);
          return;
        }
      }
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        submit();
      }
    },
    [slashOpen, filteredSkills, slashIndex, acceptSlash, submit],
  );

  // Re-focus the textarea on the falling edge of ``disabled`` — first
  // mount lands focused, and after each run finalises the next turn is
  // one keystroke away.
  useEffect(() => {
    if (!disabled) textareaRef.current?.focus();
  }, [disabled]);

  // Auto-grow the textarea up to a sensible cap. Reset to ``auto`` first
  // so the height shrinks when the user deletes lines.
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
  }, [value]);

  const hasText = value.trim().length > 0;
  const showStop = disabled && Boolean(onStop);
  const canSend = hasText && !disabled;

  // Vertical padding only; horizontal containment + screen-edge
  // padding are owned by the parent so the composer can be aligned
  // pixel-perfect with the message column above it. See ChatSessionView
  // for the wrapping ``<div className="px-4"><div max-w-3xl/>>`` pair
  // that mirrors the message scroll-area's structure.
  return (
    <div className="py-3">
      <div
        className={cn(
          // `relative` anchors the slash-command popover above the
          // composer (it uses `absolute bottom-full`).
          'relative rounded-3xl border border-border bg-card shadow-sm',
          'transition-colors',
          'focus-within:border-input',
        )}
      >
        {slashOpen && filteredSkills.length > 0 && (
          <SlashCommandPopover
            items={filteredSkills}
            selectedIndex={slashIndex}
            onSelect={acceptSlash}
            onHoverIndex={setSlashIndex}
          />
        )}
        {children && <div className="px-4 pt-3">{children}</div>}

        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          // Keep the textarea editable during a streaming run so users
          // can draft the next message; only truly disable when there's
          // no stop affordance (i.e. provider gating, not active run).
          disabled={disabled && !showStop}
          placeholder={placeholder}
          rows={1}
          aria-label="Chat input"
          className={cn(
            'block w-full resize-none border-0 bg-transparent outline-none',
            // Compact inner padding so the placeholder hugs the top
            // edge of the composer. pt-2 (8px) + line-height(24) +
            // pb-2 (8px) = 40px content; min-h-11 (44px) leaves a
            // sliver of breathing room above the button row without
            // floating the placeholder.
            'px-4 pt-2 pb-2 text-[15px] leading-6 text-card-foreground',
            '[&:not(:placeholder-shown)]:font-semibold',
            'placeholder:text-muted-foreground',
            'min-h-11',
            'disabled:cursor-not-allowed disabled:opacity-60',
          )}
        />

        <div className="flex items-center justify-end px-4 pb-3 pt-1">
          {showStop ? (
            <button
              type="button"
              onClick={onStop}
              aria-label="Stop generating"
              className={cn(
                'flex h-9 w-9 items-center justify-center rounded-full',
                'bg-foreground text-background transition-opacity',
                'hover:opacity-90',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)]',
              )}
            >
              <Square size={14} fill="currentColor" />
            </button>
          ) : (
            <button
              type="button"
              onClick={submit}
              disabled={!canSend}
              aria-label="Send message"
              className={cn(
                'flex h-9 w-9 items-center justify-center rounded-full',
                'transition-colors',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)]',
                canSend
                  ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                  : 'bg-muted text-muted-foreground cursor-not-allowed',
              )}
            >
              <ArrowUp size={18} strokeWidth={2.5} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
