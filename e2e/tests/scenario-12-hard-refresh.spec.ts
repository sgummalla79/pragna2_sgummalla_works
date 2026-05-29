/**
 * Scenario 12 — Hard refresh during streaming.
 *
 * From `docs/FRONTEND_TEST_SCENARIOS.md`. Same architecture as Scenario
 * 11 but with a more aggressive interruption — a browser reload that
 * discards the FE state entirely. The BE has no way to tell whether
 * the client crashed or just closed the tab; in either case the
 * background run should continue and persist on completion.
 *
 * Real-LLM-required.
 */
import { expect, test } from '@playwright/test';

import { login } from '../helpers/auth';

const HAS_REAL_KEY = Boolean(process.env.E2E_ANTHROPIC_API_KEY);
const PROMPT = `Explain the concept of quantum entanglement in 3 paragraphs covering its discovery, its experimental verification (e.g. Bell tests), and its modern applications in quantum computing.`;

test.describe('Scenario 12 — Hard refresh during streaming', () => {
  test.describe.configure({ timeout: 180_000 });

  test.skip(
    !HAS_REAL_KEY,
    'requires E2E_ANTHROPIC_API_KEY to be set when running `npm run setup`',
  );

  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('submit → reload mid-stream → return to chat → persisted reply is there', async ({
    page,
  }) => {
    await page.goto('/chat', { waitUntil: 'networkidle' });

    const composer = page.getByRole('textbox', { name: /chat input/i });
    await composer.click();
    await composer.fill(PROMPT);
    await page.keyboard.press('Enter');

    // Streaming started.
    await expect(
      page.getByRole('button', { name: /stop generating/i }),
    ).toBeVisible({ timeout: 30_000 });
    await expect(page).toHaveURL(/\/chat\/[0-9a-f-]{36}/, { timeout: 10_000 });
    const originalUrl = page.url();

    // Hard reload — fully discards FE state. The BE run keeps going.
    // waitUntil 'domcontentloaded' (not 'networkidle') is the right
    // signal: the SSE stream from the original conversation keeps
    // the network busy indefinitely, so 'networkidle' would never
    // fire. We just need the HTML re-parsed to confirm the reload
    // happened.
    await page.reload({ waitUntil: 'domcontentloaded' });

    // After reload we'd normally be on the chat landing OR on a fresh
    // copy of the same chat (the URL preserves). Wait until the run
    // completes on the BE.
    await page.waitForTimeout(45_000);

    // Navigate to the original chat (or stay if we're already there).
    if (page.url() !== originalUrl) {
      await page.goto(originalUrl, { waitUntil: 'networkidle' });
    } else {
      // Already on the chat — refetch the messages list via a
      // navigate-back-and-forth so the React Query cache invalidates.
      await page.goto('/chat', { waitUntil: 'networkidle' });
      await page.goto(originalUrl, { waitUntil: 'networkidle' });
    }

    await expect(
      page.locator('[data-role="assistant"]').last(),
    ).toBeVisible({ timeout: 10_000 });
    const replyText =
      (await page.locator('[data-role="assistant"]').last().textContent()) ?? '';
    expect(replyText).toMatch(/entangle|Bell|quantum/i);
    expect(replyText.length).toBeGreaterThan(400);
  });
});
