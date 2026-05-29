/**
 * Scenario 13 — Multi-tab consistency.
 *
 * From `docs/FRONTEND_TEST_SCENARIOS.md`. Two tabs on the same chat
 * should both eventually reflect the same DB state. There's no
 * real-time push between tabs today (ChatGPT and Claude.ai also
 * don't do this) — Tab B catches up only on navigation or manual
 * refresh.
 *
 * The spec opens Tab A, submits a prompt, opens Tab B on the same
 * conversation URL while the response is still streaming in Tab A,
 * waits for Tab A's stream to complete, refreshes Tab B, then
 * asserts both tabs see the same assistant reply.
 *
 * Real-LLM-required.
 */
import { expect, test } from '@playwright/test';

import { login } from '../helpers/auth';

const HAS_REAL_KEY = Boolean(process.env.E2E_ANTHROPIC_API_KEY);
const PROMPT = `Explain the photoelectric effect in 3 paragraphs covering Einstein's 1905 paper, the role of photons, and one modern application.`;

test.describe('Scenario 13 — Multi-tab consistency', () => {
  test.describe.configure({ timeout: 180_000 });

  test.skip(
    !HAS_REAL_KEY,
    'requires E2E_ANTHROPIC_API_KEY to be set when running `npm run setup`',
  );

  test('Tab A submits + completes, Tab B refreshes and sees the same reply', async ({
    browser,
  }) => {
    // Two pages SHARING a single browser context so the auth cookie /
    // localStorage applies to both — matches a real user who clicked
    // "open in new tab" rather than spawning a fresh window.
    const context = await browser.newContext();
    const tabA = await context.newPage();
    const tabB = await context.newPage();
    try {
      // The FE stores auth in `sessionStorage` (per-page in
      // Chromium — `context.newPage()` doesn't inherit the opener's
      // sessionStorage the way a real-browser "open in new tab" does).
      // So Tab B logs in independently — both tabs are then
      // authenticated as the same test user and see the same DB.
      await login(tabA);
      await tabA.goto('/chat', { waitUntil: 'networkidle' });
      await login(tabB);

      // Tab A submits the long prompt.
      const composerA = tabA.getByRole('textbox', { name: /chat input/i });
      await composerA.click();
      await composerA.fill(PROMPT);
      await tabA.keyboard.press('Enter');

      // The URL flips to /chat/{conversationId} as soon as the
      // conversation row is eager-created. Capture so Tab B can
      // navigate to the same conversation.
      await expect(tabA).toHaveURL(/\/chat\/[0-9a-f-]{36}/, {
        timeout: 15_000,
      });
      const conversationUrl = tabA.url();

      // Tab B opens the SAME conversation while Tab A is still
      // streaming. Confirm Tab B mounts with at least the user
      // bubble (matches "navigate-back-during-stream" reattach path
      // from the Background-Run Execution architecture).
      await tabB.goto(conversationUrl, { waitUntil: 'domcontentloaded' });
      await expect(tabB.locator('[data-role="user"]').last()).toContainText(
        /photoelectric|Einstein/i,
        { timeout: 10_000 },
      );

      // Tab A's stream finishes. The thinking strip flips to "Ready
      // for your next message" — the canonical run-complete signal.
      await expect(tabA.getByTestId('thinking-strip')).toHaveAttribute(
        'aria-label',
        /Ready for your next message/i,
        { timeout: 120_000 },
      );

      // Capture Tab A's final assistant reply for the cross-tab
      // comparison.
      const replyA = (
        await tabA.locator('[data-role="assistant"]').last().textContent()
      ) ?? '';
      expect(replyA).toMatch(/photoelectric|photon|Einstein/i);
      expect(replyA.length).toBeGreaterThan(400);

      // Tab B manually refreshes to pick up the new messages (the
      // out-of-scope item: no real-time push, so a manual nav or
      // refresh is required for Tab B to catch up).
      await tabB.reload({ waitUntil: 'domcontentloaded' });

      // Tab B's assistant reply now matches Tab A's. Allow some
      // tolerance — token-level identical match would be flaky if
      // the streamed text was trimmed/re-formatted on persist, so
      // assert by length within 10% and shared keywords.
      const replyB = (
        await tabB.locator('[data-role="assistant"]').last().textContent()
      ) ?? '';
      expect(replyB.length).toBeGreaterThan(400);
      expect(replyB).toMatch(/photoelectric|photon|Einstein/i);
      // The two tabs see the same DB row, so the persisted text is
      // identical to the last character.
      expect(replyB.trim()).toBe(replyA.trim());

      // Sidebar entries match across tabs (the auto-title resolves
      // before either tab queried the conversations list, so both
      // see the real title not the "New chat" placeholder).
      const titleA = await tabA
        .getByRole('navigation', { name: /recent conversations/i })
        .locator('a')
        .first()
        .textContent();
      const titleB = await tabB
        .getByRole('navigation', { name: /recent conversations/i })
        .locator('a')
        .first()
        .textContent();
      expect(titleA?.trim()).toBe(titleB?.trim());
      expect(titleA?.toLowerCase()).not.toMatch(/^new chat/);
    } finally {
      await context.close();
    }
  });
});
