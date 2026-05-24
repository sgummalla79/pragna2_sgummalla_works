import { useEffect, useState } from 'react';
import PragnaLogo from '@/assets/logo.svg?react';
import { cn } from '@/lib/utils';

/**
 * Live progress indicator rendered inline above the streaming assistant
 * bubble while an agent is working (R7.1#3 follow-up).
 *
 * Replaces the placeholder ``EpisodeBadge`` — matches the ChatGPT /
 * Claude.ai / Gemini / Cursor pattern of "animated logo + one-line
 * live label" so the user feels oriented during long flow runs
 * instead of staring at dead waiting time.
 *
 * Sourcing:
 * - Label comes from the BE's ``on_progress`` LangChain custom event,
 *   plumbed through ``ag_ui_langgraph`` and captured by
 *   :func:`useChatSession` into ``chatSession.progressLabel``.
 * - Last-wins across parallel agents (the most recent emit overwrites
 *   previous labels — design call locked during R7.1#3 follow-up).
 * - Parent passes ``null`` to hide the strip entirely. That happens
 *   on three boundaries — episode pauses (``awaiting_user``: the
 *   ``HITLFormCard`` becomes the focal point), run completes (the
 *   assistant's final message IS the completion signal), and user
 *   cancels (the cancel transcript message provides the audit trail).
 *   No "Stopping..." / "Done" beats — matches industry standard.
 *
 * Visual:
 * - Animated app logo, slow rotation (3s linear) — slower than the
 *   typical 1s spinner so it reads contemplative, not urgent /
 *   loading.
 * - Label text with a left-to-right shimmer mask animation (modern,
 *   calm, signals "active work" without being noisy).
 * - Labels fade in/out on change (200ms opacity transition) so a
 *   rapid label burst doesn't read as flicker.
 */
interface Props {
  /** Latest progress label, or ``null`` to hide the strip. */
  label: string | null;
}

export function ThinkingStrip({ label }: Props) {
  // Track the last non-null label so a transient null doesn't flash
  // an empty strip during the fade-out frame. When the parent flips
  // to null, we render the previous label for one tick at zero
  // opacity, then unmount on the next render.
  const [displayed, setDisplayed] = useState<string | null>(label);
  const [visible, setVisible] = useState<boolean>(label !== null);

  useEffect(() => {
    if (label !== null) {
      // New label or transition to visible: swap the text first, then
      // fade in. Two requestAnimationFrames here are intentional —
      // gives React a chance to commit the new text before the
      // opacity transition kicks off, otherwise some browsers
      // shortcut the transition for the initial paint.
      setDisplayed(label);
      const raf = requestAnimationFrame(() => setVisible(true));
      return () => cancelAnimationFrame(raf);
    }
    // Hide path: fade out, then unmount on transitionend. Falling
    // back to a timeout in case the transitionend doesn't fire
    // (display:none parent, prefers-reduced-motion, etc.).
    setVisible(false);
    const t = window.setTimeout(() => setDisplayed(null), 220);
    return () => window.clearTimeout(t);
  }, [label]);

  if (displayed === null) return null;

  return (
    <div
      data-testid="thinking-strip"
      className={cn(
        'flex w-full items-center gap-2 px-1 py-1',
        'transition-opacity duration-200',
        visible ? 'opacity-100' : 'opacity-0',
      )}
      role="status"
      aria-live="polite"
      aria-label={`Agent status: ${displayed}`}
    >
      <PragnaLogo
        className="h-4 w-4 shrink-0 [animation:thinking-strip-spin_3s_linear_infinite] text-muted-foreground"
        aria-hidden="true"
      />
      <span
        className={cn(
          'text-[12px] text-muted-foreground',
          // Shimmer: a horizontal linear-gradient masked by the text
          // creates the left-to-right sweep. Keyframes defined in
          // index.css so we don't ship per-component <style> blocks.
          '[background:linear-gradient(90deg,currentColor_0%,currentColor_40%,rgba(255,255,255,0.85)_50%,currentColor_60%,currentColor_100%)]',
          '[background-size:200%_100%]',
          '[-webkit-background-clip:text] [background-clip:text]',
          '[-webkit-text-fill-color:transparent]',
          '[animation:thinking-strip-shimmer_2.5s_linear_infinite]',
        )}
      >
        {displayed}
      </span>
    </div>
  );
}
