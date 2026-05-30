/**
 * Scenario 1 — Plain chat (no special features).
 *
 * From `docs/FRONTEND_TEST_SCENARIOS.md`. Tests that the default chat
 * agent receives a user message, streams a response, and the
 * conversation surface settles cleanly when the run completes.
 *
 * Real-LLM-required: this spec exercises a live Anthropic call. Run
 * `E2E_ANTHROPIC_API_KEY=sk-ant-... npm run setup` before `npm test`.
 * Without the key, the BE encrypts a dummy value into user_providers
 * and the runtime LLM call returns 401; we skip the spec with a clear
 * message in that case so the suite doesn't fail confusingly.
 */
import { expect, test } from '@playwright/test';

import { login } from '../helpers/auth';

const HAS_REAL_KEY = Boolean(process.env.E2E_ANTHROPIC_API_KEY);

test.describe('Scenario 1 — Plain chat', () => {
  test.skip(
    !HAS_REAL_KEY,
    'requires E2E_ANTHROPIC_API_KEY to be set when running `npm run setup`',
  );

  test.beforeEach(async ({ page }) => {
    await login(page);
    // /chat lands on the chat landing view (centred composer).
    await page.goto('/chat', { waitUntil: 'networkidle' });
  });

  test('user message + assistant reply round-trip', async ({ page }) => {
    // Focus the composer. The textarea is `aria-label="Chat input"`
    // per ChatInput.tsx. Type a short factual question; keep the
    // prompt deterministic-ish so non-determinism doesn't break the
    // shape assertions.
    const composer = page.getByRole('textbox', { name: /chat input/i });
    await composer.click();
    await composer.fill('In one sentence, what is the capital of France?');
    await page.keyboard.press('Enter');

    // ── User bubble appears immediately (FE optimistically commits) ──
    await expect(
      page.locator('[data-role="user"]').last(),
    ).toContainText(/capital of France/i, { timeout: 5_000 });

    // ── The Stop button replaces Send while the run streams ──
    // (aria-label="Stop generating" per ChatInput.tsx). This is the
    // earliest deterministic signal that the BE accepted the turn.
    await expect(
      page.getByRole('button', { name: /stop generating/i }),
    ).toBeVisible({ timeout: 30_000 });

    // ── A streaming assistant bubble appears ──
    const assistantBubble = page.locator('[data-role="assistant"]').last();
    await expect(assistantBubble).toBeVisible({ timeout: 30_000 });

    // ── Smooth-reveal layer is engaged while the turn streams ──
    // The assistant markdown wrapper carries `chat-markdown--animate`
    // ONLY while its turn is mid-stream — it drives the claude.ai-style
    // typewriter reveal + per-block fade. Its presence proves the
    // per-turn `isStreaming` detection fired (the bug where it was keyed
    // off BE-persisted history left this false the whole stream, so text
    // dumped in). This is the same per-turn streaming path that lets
    // parallel fan-out turns each animate — the runtime fan-out that
    // produces concurrent bubbles isn't wired yet (see scenario 16/17),
    // so the multi-turn case is pinned by the useChatSession unit test;
    // here we verify the shared single-turn path end-to-end. The class
    // is removed once streaming ends, so we assert it before settling.
    await expect(
      assistantBubble.locator('.chat-markdown--animate'),
    ).toBeVisible({ timeout: 30_000 });

    // ── Wait for streaming to finish (Stop reverts to Send) ──
    await expect(
      page.getByRole('button', { name: /stop generating/i }),
    ).toHaveCount(0, { timeout: 60_000 });

    // ── Shape assertions on the final reply ──
    // We do NOT assert exact content. We DO assert the reply has
    // material text and mentions Paris (the right answer to this
    // factual prompt). If the LLM ever fails this we have bigger
    // problems than test flakiness.
    const finalText = (await assistantBubble.textContent()) ?? '';
    expect(finalText.length).toBeGreaterThan(5);
    expect(finalText).toMatch(/Paris/i);

  });
});

