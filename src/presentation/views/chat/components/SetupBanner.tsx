import type { ReactNode } from 'react';

/**
 * Inline error-tinted banner rendered above the composer when a setup
 * step is missing (no provider connected, no chat-available model,
 * unknown agent in URL, …). Visual matches the "Chat unavailable"
 * surface so the user reads it as "blocking but recoverable."
 *
 * Used by both :class:`ChatLandingView` and :class:`ChatSessionView`
 * via :class:`ChatInput`'s ``children`` slot. Multiple stacked banners
 * inherit ``space-y-2`` from that slot's wrapper.
 */
export function SetupBanner({ children }: { children: ReactNode }) {
  return (
    <div
      role="alert"
      className="rounded-lg border border-[var(--color-error-border)] bg-[var(--color-error-bg)] px-4 py-2.5 text-[13px] text-[var(--color-error-text)]"
    >
      {children}
    </div>
  );
}
