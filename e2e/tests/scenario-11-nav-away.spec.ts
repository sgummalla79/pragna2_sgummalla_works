/**
 * Scenario 11 — Navigate away mid-response, come back.
 *
 * From `docs/FRONTEND_TEST_SCENARIOS.md`. Tests the Background-Run
 * Execution architecture: once a chat turn is submitted the BE keeps
 * generating even if the client navigates away. When the user comes
 * back the response is either complete (variant B) or re-streams
 * live via the event-log replay (variant A).
 *
 * This spec exercises variant B — wait long enough that the run
 * completes on the BE while the FE is on a different chat, then come
 * back and verify the persisted message landed.
 *
 * Real-LLM-required.
 */
import { expect, test } from '@playwright/test';

import { login } from '../helpers/auth';

const HAS_REAL_KEY = Boolean(process.env.E2E_ANTHROPIC_API_KEY);
const LONG_PROMPT = `Write a 4-paragraph essay on the history of the printing press, covering its origins, Gutenberg's contribution, the social impact in Europe, and a comparison to digital publishing today.`;

test.describe('Scenario 11 — Navigate away mid-response', () => {
  // Long prompt + 30s navigate-away gap + completion check.
  test.describe.configure({ timeout: 180_000 });

  test.skip(
    !HAS_REAL_KEY,
    'requires E2E_ANTHROPIC_API_KEY to be set when running `npm run setup`',
  );

  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('submit → navigate to new chat → come back → see persisted reply', async ({
    page,
  }) => {
    await page.goto('/chat', { waitUntil: 'networkidle' });

    // Submit the long prompt.
    const composer = page.getByRole('textbox', { name: /chat input/i });
    await composer.click();
    await composer.fill(LONG_PROMPT);
    await page.keyboard.press('Enter');

    // Wait for streaming to start (Stop button visible).
    await expect(
      page.getByRole('button', { name: /stop generating/i }),
    ).toBeVisible({ timeout: 30_000 });

    // The chat URL flips to /chat/{conversationId} once the
    // conversation row is created. Capture the path so we can come
    // back to the same chat after navigating away.
    await expect(page).toHaveURL(/\/chat\/[0-9a-f-]{36}/, { timeout: 10_000 });
    const originalUrl = page.url();

    // Navigate away — click "+ New chat" in the sidebar.
    await page.getByRole('button', { name: /^new chat$/i }).click();
    await expect(page).toHaveURL(/\/chat$/, { timeout: 5_000 });
    // Sanity: the new chat landing has no [data-role="assistant"]
    // bubble yet (we navigated AWAY from the streaming chat).
    expect(await page.locator('[data-role="assistant"]').count()).toBe(0);

    // Wait for the BE to finish the original run in the background.
    // Anthropic Sonnet on a 4-paragraph essay returns in ~15-25s; 45s
    // is comfortable headroom.
    await page.waitForTimeout(45_000);

    // Navigate back to the original chat — the response should be
    // fully streamed and persisted.
    await page.goto(originalUrl, { waitUntil: 'networkidle' });

    // The persisted reply has landed and is non-empty.
    await expect(
      page.locator('[data-role="assistant"]').last(),
    ).toBeVisible({ timeout: 10_000 });
    const replyText =
      (await page.locator('[data-role="assistant"]').last().textContent()) ?? '';
    // Shape check: the reply mentions Gutenberg AND has substantial
    // length (≥500 chars — a 4-paragraph essay should easily exceed
    // that).
    expect(replyText).toMatch(/Gutenberg/i);
    expect(replyText.length).toBeGreaterThan(500);

    // The sidebar got a real auto-title (NOT "New chat").
    const titleEntry = page
      .getByRole('navigation', { name: /recent conversations/i })
      .locator('a')
      .first();
    const titleText = (await titleEntry.textContent()) ?? '';
    expect(titleText).not.toMatch(/^new chat/i);
    expect(titleText.length).toBeGreaterThan(3);
  });
});
