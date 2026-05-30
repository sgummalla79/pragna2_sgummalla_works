import { memo, useMemo } from 'react';
import { Streamdown } from 'streamdown';
// KaTeX layout styles for Streamdown's rehype-katex math pass. Streamdown
// bundles `katex`, so we import its stylesheet directly (the package exposes
// no `./katex.css` entry of its own).
import 'katex/dist/katex.min.css';
import { normalizeMathDelimiters } from '@/presentation/views/chat/utils/markdownStreaming';
import { SHIKI_THEMES, STREAMDOWN_CONTROLS } from '@/constants/markdown';

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

  return (
    <Streamdown
      mode={isStreaming ? 'streaming' : 'static'}
      parseIncompleteMarkdown={isStreaming}
      shikiTheme={SHIKI_THEMES}
      controls={STREAMDOWN_CONTROLS}
      className="break-words"
    >
      {normalized}
    </Streamdown>
  );
}

export const MarkdownMessage = memo(MarkdownMessageImpl);
