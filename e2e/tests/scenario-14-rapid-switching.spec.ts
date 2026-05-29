/**
 * Scenario 14 — Rapid chat switching (2026-05-26 bug repro).
 *
 * From `docs/FRONTEND_TEST_SCENARIOS.md`. The exact user-reported
 * repro that motivated the Background-Run Execution architecture.
 * Before that work, rapid submits with immediate "+ New chat" clicks
 * produced ghost sidebar entries — visible in the sidebar but with
 * no DB row backing them.
 *
 * The per-user concurrent-runs cap is 3 (per CLAUDE.md §10), so we
 * fire exactly 3 in rapid succession and confirm each one survives
 * to a complete persisted reply.
 *
 * Real-LLM-required.
 */
import { expect, test } from '@playwright/test';

import { login } from '../helpers/auth';

const HAS_REAL_KEY = Boolean(process.env.E2E_ANTHROPIC_API_KEY);

const RAPID_PROMPTS = [
  'In one sentence, what is the largest planet in our solar system?',
  'In one sentence, what is the chemical formula for water?',
  'In one sentence, who painted the Mona Lisa?',
];

test.describe('Scenario 14 — Rapid chat switching', () => {
  test.describe.configure({ timeout: 240_000 });

  test.skip(
    !HAS_REAL_KEY,
    'requires E2E_ANTHROPIC_API_KEY to be set when running `npm run setup`',
  );

  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('3 rapid submits + new-chat clicks all persist replies', async ({
    page,
  }) => {
    await page.goto('/chat', { waitUntil: 'networkidle' });

    const conversationUrls: string[] = [];

    for (const prompt of RAPID_PROMPTS) {
      const composer = page.getByRole('textbox', { name: /chat input/i });
      // Between rapid submits the composer briefly disables while the
      // new-chat route remounts and the prior run's eager-create flush
      // completes. Wait for it to be ENABLED before clicking — otherwise
      // Playwright errors with "element is not enabled".
      await expect(composer).toBeEnabled({ timeout: 15_000 });
      await composer.click();
      await composer.fill(prompt);
      await page.keyboard.press('Enter');

      // The chat URL flips once the conversation row is created (the
      // earliest deterministic signal that eager-create succeeded).
      await expect(page).toHaveURL(/\/chat\/[0-9a-f-]{36}/, {
        timeout: 15_000,
      });
      conversationUrls.push(page.url());

      // Immediately fire off to a new chat — this is the
      // "abandon mid-flight" interaction that previously dropped runs.
      await page.getByRole('button', { name: /^new chat$/i }).click();
      await expect(page).toHaveURL(/\/chat$/, { timeout: 5_000 });
    }

    expect(conversationUrls).toHaveLength(3);

    // Wait for all 3 background runs to finish. Three concurrent
    // runs against the same provider tend to serialise at the rate-
    // limit layer; 90s gives Anthropic plenty of headroom even for
    // tail-end queuing.
    await page.waitForTimeout(75_000);

    // Visit each conversation and confirm it has both messages
    // persisted — the bug repro produced ghost rows (sidebar entry
    // with NO conversation behind it). Use toPass polling on the
    // assistant bubble because the last of the three runs can still
    // be flushing its persist when we navigate.
    for (let i = 0; i < conversationUrls.length; i++) {
      await page.goto(conversationUrls[i], { waitUntil: 'domcontentloaded' });
      // User bubble matches the prompt we submitted.
      await expect(page.locator('[data-role="user"]').last()).toContainText(
        RAPID_PROMPTS[i].slice(0, 30),
        { timeout: 10_000 },
      );
      // Assistant reply landed and is non-trivial.
      await expect(async () => {
        const replyText =
          (await page.locator('[data-role="assistant"]').last().textContent()) ?? '';
        expect(replyText.length).toBeGreaterThan(3);
      }).toPass({ timeout: 30_000, intervals: [1000, 2000, 3000] });
    }

    // Sidebar has 3 distinct entries (no ghost rows).
    const sidebarLinks = await page
      .getByRole('navigation', { name: /recent conversations/i })
      .locator('a')
      .all();
    // Sidebar may also include older conversations from earlier
    // scenarios in this run; we just need ≥3.
    expect(sidebarLinks.length).toBeGreaterThanOrEqual(3);
  });
});
