import { memo, useEffect, useMemo, useRef } from 'react';
import { Streamdown } from 'streamdown';
// KaTeX layout styles for Streamdown's rehype-katex math pass. Streamdown
// bundles `katex`, so we import its stylesheet directly (the package exposes
// no `./katex.css` entry of its own).
import 'katex/dist/katex.min.css';
import { normalizeMathDelimiters } from '@/presentation/views/chat/utils/markdownStreaming';
import { SHIKI_THEMES, STREAMDOWN_CONTROLS } from '@/constants/markdown';

// Only every Nth wheel tick over a Mermaid diagram reaches Streamdown's
// zoom handler — the rest are dropped. Streamdown zooms a fixed 0.1 step per
// wheel event with no speed prop, so a single scroll gesture (many ticks)
// zooms wildly; throttling makes it gradual. Higher = slower zoom.
const MERMAID_ZOOM_WHEEL_THROTTLE = 6;

interface MarkdownMessageProps {
  /** Raw assistant markdown to render. */
  content: string;
  /**
   * True only while this turn is the in-flight streaming assistant
   * message. Switches Streamdown to ``streaming`` mode (per-block
   * memoisation + incomplete-markdown repair for unterminated code
   * fences / half-written tables) so the bubble stays stable as tokens
   * arrive; once the turn completes we render the exact final markdown
   * in ``static`` mode.
   */
  isStreaming?: boolean;
}

/**
 * Render assistant markdown the Claude.ai way: GFM (tables, task lists,
 * footnotes), fenced code with Shiki highlighting + copy buttons, KaTeX
 * math, and images — all provider-agnostic.
 *
 * Every major model emits Markdown, so there is no per-provider branching;
 * the only normalisation is math-delimiter alignment (``\(…\)`` → ``$…$``)
 * via :func:`normalizeMathDelimiters`. Streamdown owns the streaming-safe
 * parsing and is hardened/sanitised by default (rehype-harden strips unsafe
 * link/image URLs), so no explicit allow-list is needed here.
 */
function MarkdownMessageImpl({ content, isStreaming = false }: MarkdownMessageProps) {
  const normalized = useMemo(() => normalizeMathDelimiters(content), [content]);
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Throttle Mermaid wheel-zoom. Streamdown attaches a non-passive ``wheel``
  // listener that zooms a fixed 0.1 step per event, with no speed prop — so a
  // single scroll gesture (many ticks) zooms far too fast. We intercept
  // ``wheel`` in the CAPTURE phase over a mermaid block and let only every
  // Nth tick through to Streamdown's handler; the rest are stopped (and their
  // default suppressed) so they neither zoom nor scroll the page off the
  // diagram. Net effect: zoom still works, but gradually. Non-mermaid wheel
  // events are untouched.
  const wheelTickRef = useRef(0);
  useEffect(() => {
    const el = wrapperRef.current;
    if (!el) return;
    const onWheelCapture = (e: WheelEvent) => {
      const target = e.target as Element | null;
      if (!target?.closest('[data-streamdown="mermaid-block"]')) return;
      wheelTickRef.current += 1;
      if (wheelTickRef.current % MERMAID_ZOOM_WHEEL_THROTTLE !== 0) {
        // Drop this tick: stop it reaching Streamdown's zoom handler, and
        // prevent the page from scrolling while the cursor is over the diagram.
        e.preventDefault();
        e.stopPropagation();
      }
      // Otherwise let it bubble to Streamdown's listener → one zoom step.
    };
    el.addEventListener('wheel', onWheelCapture, { capture: true, passive: false });
    return () =>
      el.removeEventListener('wheel', onWheelCapture, { capture: true });
  }, []);

  return (
    <div ref={wrapperRef}>
      <Streamdown
        mode={isStreaming ? 'streaming' : 'static'}
        parseIncompleteMarkdown={isStreaming}
        shikiTheme={SHIKI_THEMES}
        controls={STREAMDOWN_CONTROLS}
        className="break-words"
      >
        {normalized}
      </Streamdown>
    </div>
  );
}

export const MarkdownMessage = memo(MarkdownMessageImpl);
