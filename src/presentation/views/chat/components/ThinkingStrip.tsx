import { useEffect, useState } from 'react';
import PragnaLogo from '@/assets/logo.svg?react';
import { cn } from '@/lib/utils';

/**
 * Persistent "Pragna indicator" rendered at the bottom of the chat
 * messages column. Two visual states:
 *
 * - **Idle** (``label === null``): static logo, no text. Signals
 *   "ready for your next question" — same role as claude.ai's
 *   in-pane logo when no agent is currently working.
 * - **Thinking** (``label`` set): logo rotates slowly + the live
 *   label text renders next to it with a soft fade-in.
 *
 * Sourcing:
 * - Label comes from the BE's ``on_progress`` LangChain custom event,
 *   plumbed through ``ag_ui_langgraph`` and captured by
 *   :func:`useChatSession` into ``chatSession.progressLabel``.
 * - Last-wins across parallel agents (the most recent emit overwrites
 *   previous labels — design call locked during R7.1#3 follow-up).
 * - The strip itself stays mounted regardless of run state; only the
 *   label fades and the spin animation toggles. Parent hides the
 *   strip entirely only during ``awaiting_user`` (the ``HITLFormCard``
 *   is the focal indicator in that state).
 *
 * Visual:
 * - App logo, slow rotation (3s linear) while a label is present —
 *   slower than the typical 1s spinner so it reads contemplative,
 *   not urgent / loading. Static (no animation) when idle.
 * - Label text fades in/out on change (200ms opacity transition) so a
 *   rapid label burst doesn't read as flicker, and a clean
 *   end-of-run leaves only the static logo behind.
 */
interface Props {
  /** Latest progress label, or ``null`` to hide the strip. */
  label: string | null;
}

export function ThinkingStrip({ label }: Props) {
  // ``displayed`` lags ``label`` by one frame on transition-to-null so
  // the label can fade OUT before unmounting from the DOM (otherwise
  // the text would snap away). When ``label`` is non-null, ``visible``
  // flips on after a rAF tick so the opacity transition runs from 0→1
  // on initial paint.
  const [displayed, setDisplayed] = useState<string | null>(label);
  const [visible, setVisible] = useState<boolean>(label !== null);

  useEffect(() => {
    if (label !== null) {
      setDisplayed(label);
      const raf = requestAnimationFrame(() => setVisible(true));
      return () => cancelAnimationFrame(raf);
    }
    // Fade-out path. After the transition window, drop the displayed
    // text so the strip collapses cleanly back to the idle (logo-only)
    // state. The strip itself stays mounted across runs.
    setVisible(false);
    const t = window.setTimeout(() => setDisplayed(null), 220);
    return () => window.clearTimeout(t);
  }, [label]);

  const isThinking = visible && displayed !== null;

  return (
    <div
      data-testid="thinking-strip"
      className="flex w-full items-center gap-2 px-1 py-1"
      role="status"
      aria-live="polite"
      aria-label={
        isThinking ? `Agent status: ${displayed}` : 'Ready for your next message'
      }
    >
      <PragnaLogo
        className={cn(
          'h-8 w-8 shrink-0 text-foreground',
          // Spin only while a label is present. Idle = static logo —
          // signals "ready" without burning attention on motion.
          isThinking && '[animation:thinking-strip-spin_3s_linear_infinite]',
        )}
        aria-hidden="true"
      />
      {displayed !== null && (
        <span
          className={cn(
            'text-sm text-muted-foreground transition-opacity duration-200',
            visible ? 'opacity-100' : 'opacity-0',
          )}
        >
          {displayed}
        </span>
      )}
    </div>
  );
}
