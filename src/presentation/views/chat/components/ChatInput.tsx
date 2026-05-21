import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from 'react';
import { ArrowUp, Square } from 'lucide-react';
import { cn } from '@/lib/utils';

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

  const submit = useCallback(() => {
    const trimmed = value.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setValue('');
  }, [value, disabled, onSend]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        submit();
      }
    },
    [submit],
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
          'rounded-3xl border border-border bg-card shadow-sm',
          'transition-colors',
          'focus-within:border-input',
        )}
      >
        {children && <div className="px-3 pt-3">{children}</div>}

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
            'px-5 pt-4 pb-2 text-[15px] leading-6 text-foreground',
            'placeholder:text-muted-foreground',
            'min-h-[56px]',
            'disabled:cursor-not-allowed disabled:opacity-60',
          )}
        />

        <div className="flex items-center justify-end px-3 pb-3 pt-1">
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
                  ? 'bg-primary text-white hover:bg-primary/90'
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
