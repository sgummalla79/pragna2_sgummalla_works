import { useMemo } from 'react';
import { useAuthStore } from '@/presentation/store/authStore';

interface Greeting {
  /** Full greeting line, e.g. "Good morning, Suman" or "Hello". */
  text: string;
  /** Time-of-day phrase only, e.g. "Good morning". Useful for layouts that split the line. */
  phrase: string;
  /** First name, when one was resolvable. Empty string otherwise. */
  firstName: string;
}

/**
 * Picks a time-of-day phrase based on the user's local clock.
 *
 * Boundaries match the conventions used by ChatGPT / Claude.ai:
 *   - 05:00 – 11:59  → "Good morning"
 *   - 12:00 – 16:59  → "Good afternoon"
 *   - 17:00 – 20:59  → "Good evening"
 *   - elsewhere      → "Hello" (avoids "Good night" — too sleepy for a work tool)
 */
function pickPhrase(hour: number): string {
  if (hour >= 5 && hour < 12) return 'Good morning';
  if (hour >= 12 && hour < 17) return 'Good afternoon';
  if (hour >= 17 && hour < 21) return 'Good evening';
  return 'Hello';
}

/**
 * Derives the first name from a :class:`User` row.
 *
 * Strategy:
 *   1. If ``user.name`` is set, take the first whitespace-separated token.
 *      Handles "Suman Gummalla" → "Suman", "Anne-Marie Slaughter" →
 *      "Anne-Marie", and single-word names → themselves.
 *   2. Otherwise fall back to the local part of the email, with any
 *      separators (``.``, ``_``, ``+``) stripped and the first letter
 *      uppercased. ``suman.gummalla@example.com`` → "Suman".
 *   3. If neither is available (logged-out / pre-bootstrap), return "".
 *      The greeting drops the comma in that case.
 */
function pickFirstName(name: string | null, email: string | undefined): string {
  if (name && name.trim()) {
    return name.trim().split(/\s+/)[0];
  }
  if (email) {
    const local = email.split('@')[0] ?? '';
    const root = local.split(/[._+]/)[0];
    if (root) return root[0].toUpperCase() + root.slice(1);
  }
  return '';
}

/**
 * Build a personalised greeting based on the local time of day + user name.
 *
 * Returns a stable :class:`Greeting` object across re-renders within the
 * same minute — ``useMemo`` keyed on hour + user lets the component avoid
 * re-rendering the greeting text on every state change.
 *
 * Used by :class:`ChatLandingView` to render the centred welcome message.
 */
export function useGreeting(): Greeting {
  const user = useAuthStore((s) => s.user);

  return useMemo(() => {
    const now = new Date();
    const phrase = pickPhrase(now.getHours());
    const firstName = pickFirstName(user?.name ?? null, user?.email);
    const text = firstName ? `${phrase}, ${firstName}` : phrase;
    return { text, phrase, firstName };
  }, [user?.name, user?.email]);
}
