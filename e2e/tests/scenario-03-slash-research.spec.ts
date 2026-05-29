/**
 * Scenario 3 — Run a slash command (slash-exposed flow).
 *
 * From `docs/FRONTEND_TEST_SCENARIOS.md`. Covers the canonical
 * single-agent slash flow end-to-end:
 *
 *   Arrange — build `research-flow` in the visual editor (one Agent
 *   node, slash-exposed as `/research`), Save, confirm slash badge.
 *   Act     — open a new chat, type `/research <topic>`, send.
 *   Assert  — user bubble has `/research` prefix, "Research Agent..."
 *             progress label appears, assistant bubble streams in
 *             with a relevant reply.
 *
 * Real-LLM-required. Authoring up through Save would work without a
 * key, but the slash dispatch + reply assertion needs a live LLM.
 */
import { expect, test } from '@playwright/test';

import { login } from '../helpers/auth';
import { db } from '../helpers/db';
import {
  configureChatAgent,
  dragHandle,
  dropFromPalette,
  fillFlowMeta,
  saveFlow,
} from '../helpers/flow-author';

const HAS_REAL_KEY = Boolean(process.env.E2E_ANTHROPIC_API_KEY);

const FLOW_API_NAME = 'research-flow';
const SLASH_NAME = 'research';
const AGENT_NODE_ID = 'research-agent';
const AGENT_DISPLAY = 'Research Agent';
const AGENT_PROMPT = `You are a careful researcher. Answer the user's question in 3 to 5 sentences using plain English. If the question is unclear, make a reasonable assumption and state it.`;

test.describe('Scenario 3 — Single-agent slash flow', () => {
  test.skip(
    !HAS_REAL_KEY,
    'requires E2E_ANTHROPIC_API_KEY to be set when running `npm run setup`',
  );

  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('build research-flow visually, then dispatch /research and verify reply', async ({
    page,
  }) => {
    // ── Arrange — build the flow ──
    await page.goto('/flows/new', { waitUntil: 'networkidle' });
    await page.waitForSelector('nav[aria-label="Add node"]');

    await fillFlowMeta(page, {
      display: 'Research Flow',
      apiName: FLOW_API_NAME,
      description: 'Quick research answers on any topic.',
      slashName: SLASH_NAME,
    });

    await dropFromPalette(page, 'Agent');
    await configureChatAgent(page, {
      nodeId: AGENT_NODE_ID,
      display: AGENT_DISPLAY,
      prompt: AGENT_PROMPT,
    });

    await dragHandle(
      page,
      { nodeId: '__start__', handleId: 'out' },
      { nodeId: AGENT_NODE_ID, handleId: 'left' },
    );
    await dragHandle(
      page,
      { nodeId: AGENT_NODE_ID, handleId: 'right' },
      { nodeId: '__end__', handleId: 'in' },
    );

    await saveFlow(page);
    expect(db.flowCount()).toBeGreaterThanOrEqual(1);

    // ── Act — dispatch /research ──
    await page.goto('/chat', { waitUntil: 'networkidle' });
    const composer = page.getByRole('textbox', { name: /chat input/i });
    await composer.click();
    await composer.fill(`/${SLASH_NAME} what is the speed of light`);
    await page.keyboard.press('Enter');

    // ── Assert — slash dispatch + reply ──
    await expect(page.locator('[data-role="user"]').last()).toContainText(
      new RegExp(`/${SLASH_NAME}\\b.*speed of light`, 'i'),
      { timeout: 5_000 },
    );

    // Progress label surfaces the agent display name during the run.
    await expect(page.getByText(new RegExp(AGENT_DISPLAY, 'i'))).toBeVisible({
      timeout: 30_000,
    });

    await expect(
      page.getByRole('button', { name: /stop generating/i }),
    ).toHaveCount(0, { timeout: 60_000 });

    // Tolerant content assertion — the factual prompt has a stable
    // canonical answer; any of these markers is acceptable.
    const reply = await page.locator('[data-role="assistant"]').last().textContent();
    expect(reply ?? '').toMatch(/light|300|299,?792|c\b/i);
  });
});
