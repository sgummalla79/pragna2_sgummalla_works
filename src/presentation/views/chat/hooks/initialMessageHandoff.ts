/**
 * SessionStorage helpers for the landing → session handoff.
 *
 * When the user sends a message from :class:`ChatLandingView`, the page
 * navigates to ``/chat/{uuid}`` and TWO pieces of state need to travel
 * with the navigation so :class:`ChatSessionView` can fire the run on
 * mount with the right agent:
 *
 *   1. The user's message text.
 *   2. The agent name selected on the landing (via ``?agent=`` query
 *      param or the ``AgentPicker``). For free chat this is
 *      ``"default"``; for flow-backed agents it's the flow name.
 *
 * Both are bundled into a single JSON-encoded ``PendingInitialMessage``
 * record keyed by the conversation id, written by the landing and
 * read+removed by the session view's send-firing effect.
 *
 * Why sessionStorage instead of React Router state:
 *
 *   - Tab-scoped: a duplicate tab opening ``/chat/{uuid}`` won't see
 *     the seed.
 *   - Survives the immediate redirect cleanly (Router state behaves
 *     oddly under ``replace: true``).
 *   - Read-once removal makes refresh of ``/chat/{uuid}`` safe — the
 *     second mount finds nothing and renders the persisted history.
 */
export const INITIAL_MESSAGE_STORAGE_KEY = (conversationId: string): string =>
  `pragna:initial-message:${conversationId}`;

const DEFAULT_AGENT = 'default';

/** Payload threaded from the landing to the session view on first send. */
export interface PendingInitialMessage {
  /** The user's typed turn. */
  text: string;
  /** Agent name to invoke. ``"default"`` for free chat. */
  agent: string;
}

/**
 * Parse a stored handoff payload.
 *
 * The payload is JSON-encoded ``{text, agent}``. We also accept a bare
 * string for backward-compatibility with anything stashed before the
 * agent field existed — those default to the ``"default"`` agent.
 */
function parseStored(raw: string): PendingInitialMessage {
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object' && typeof parsed.text === 'string') {
      return {
        text: parsed.text,
        agent:
          typeof parsed.agent === 'string' && parsed.agent.length > 0
            ? parsed.agent
            : DEFAULT_AGENT,
      };
    }
  } catch {
    /* fall through to legacy string handling */
  }
  return { text: raw, agent: DEFAULT_AGENT };
}

/**
 * Write a pending handoff for a conversation.
 *
 * Called by the landing on first send. Encapsulates the JSON encoding
 * so the storage shape stays an implementation detail.
 *
 * @param conversationId The freshly-generated UUID for the conversation.
 * @param payload ``{text, agent}`` to stash.
 */
export function writePendingInitialMessage(
  conversationId: string,
  payload: PendingInitialMessage,
): void {
  try {
    sessionStorage.setItem(
      INITIAL_MESSAGE_STORAGE_KEY(conversationId),
      JSON.stringify(payload),
    );
  } catch {
    // sessionStorage can throw in privacy modes / SSR / out-of-quota;
    // we silently drop the handoff. The user will need to retype but
    // the chat surface is reachable.
  }
}

/**
 * Consume the pending handoff for a conversation, if any.
 *
 * One-shot: reads and immediately removes the key so a refresh on the
 * same URL doesn't replay the message. Returns ``null`` when no handoff
 * is in flight (the common case for resumed conversations).
 */
export function consumePendingInitialMessage(
  conversationId: string | undefined,
): PendingInitialMessage | null {
  if (!conversationId) return null;
  try {
    const key = INITIAL_MESSAGE_STORAGE_KEY(conversationId);
    const value = sessionStorage.getItem(key);
    if (value === null) return null;
    sessionStorage.removeItem(key);
    return parseStored(value);
  } catch {
    return null;
  }
}

/**
 * Non-destructively read the pending handoff for a conversation.
 *
 * Used at render time by the session view to decide which agent to
 * instantiate BEFORE the consume + send timer fires. Leaves the storage
 * key intact so the send-firing effect can still consume it.
 */
export function peekPendingInitialMessage(
  conversationId: string | undefined,
): PendingInitialMessage | null {
  if (!conversationId) return null;
  try {
    const value = sessionStorage.getItem(INITIAL_MESSAGE_STORAGE_KEY(conversationId));
    if (value === null) return null;
    return parseStored(value);
  } catch {
    return null;
  }
}

/**
 * Cheap presence check for a pending handoff.
 *
 * Used by the session view to skip the ``GET .../messages`` fetch for
 * brand-new conversations whose row hasn't been persisted yet — the
 * 404 would otherwise pollute the browser's network panel.
 */
export function hasPendingInitialMessage(
  conversationId: string | undefined,
): boolean {
  return peekPendingInitialMessage(conversationId) !== null;
}
