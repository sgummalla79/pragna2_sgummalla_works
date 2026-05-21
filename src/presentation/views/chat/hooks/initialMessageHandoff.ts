/**
 * SessionStorage key helpers for the landing → session handoff.
 *
 * When the user sends a message from :class:`ChatLandingView`, the page
 * navigates to ``/chat/{uuid}`` and the message needs to travel with the
 * navigation so :class:`ChatSessionView` can fire it on mount. We use
 * sessionStorage instead of React Router state because:
 *
 *   - It's automatically scoped to the tab — a duplicate tab opening
 *     ``/chat/{uuid}`` won't see the seed.
 *   - It survives a refresh of the *landing* page (rare, but: closing
 *     and re-opening the tab clears it cleanly).
 *   - We can deliberately consume + remove it on first read in
 *     ``ChatSessionView``, so a refresh of ``/chat/{uuid}`` does NOT
 *     replay the message — the second mount finds nothing and renders
 *     the persisted history instead.
 *
 * Keep the key shape stable; the two consumers (landing writer, session
 * reader) import from this module so they can't drift.
 */
export const INITIAL_MESSAGE_STORAGE_KEY = (conversationId: string): string =>
  `pragna:initial-message:${conversationId}`;

/**
 * Consume the pending initial message for a conversation, if any.
 *
 * One-shot: reads then immediately removes the key so a refresh on the
 * same URL doesn't see a stale message. Returns ``null`` when no
 * handoff is in flight (the common case for resumed conversations).
 *
 * @param conversationId The ``:id`` from the route. Caller passes
 *   ``undefined`` for ``/chat/new``-style routes (this function returns
 *   ``null`` in that case).
 */
export function consumePendingInitialMessage(
  conversationId: string | undefined,
): string | null {
  if (!conversationId) return null;
  try {
    const key = INITIAL_MESSAGE_STORAGE_KEY(conversationId);
    const value = sessionStorage.getItem(key);
    if (value !== null) sessionStorage.removeItem(key);
    return value;
  } catch {
    // sessionStorage may be unavailable in private-mode contexts; treat
    // as "no pending message" and let the session view render normally.
    return null;
  }
}

/**
 * Non-destructively check whether a landing handoff is pending for a
 * conversation id.
 *
 * Used as a render-time hint by the session view so that we can SKIP
 * fetching persisted messages for a brand-new conversation — the row
 * doesn't exist on the backend yet (it's about to be auto-created by the
 * first ``/pragna`` run), so a ``GET /api/conversations/{id}/messages``
 * would 404 and log noisy red errors in the browser's network panel.
 *
 * Unlike :func:`consumePendingInitialMessage`, this function leaves the
 * storage key intact — only the session view's send-firing effect is
 * allowed to consume it.
 */
export function hasPendingInitialMessage(
  conversationId: string | undefined,
): boolean {
  if (!conversationId) return false;
  try {
    return sessionStorage.getItem(INITIAL_MESSAGE_STORAGE_KEY(conversationId)) !== null;
  } catch {
    return false;
  }
}
