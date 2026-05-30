/**
 * Scenario 8 — Plan & Execute (planner → executor).
 *
 * From `docs/FRONTEND_TEST_SCENARIOS.md`. Two chat-agents in sequence;
 * the planner outputs a numbered plan and the executor narrates each
 * step. Same shape as Scenario 5 (sequential pipeline) but with
 * different prompts that test "the second node reads conversation
 * history correctly".
 *
 * Topology:
 *   Start → plan-planner → plan-executor → End
 *
 * Real-LLM-required.
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

const FLOW_API_NAME = 'plan-and-do';
const SLASH_NAME = 'plan-and-do';

const PLANNER_ID = 'plan-planner';
const PLANNER_DISPLAY = 'Planner';
const PLANNER_PROMPT = `The user asks you to perform a task. Do NOT perform it yourself. Output a numbered list of 3 to 5 concrete steps that an executor would follow. Begin with the literal line "Plan:" then list each step on its own line ("1. ...", "2. ...", etc.). No commentary after the list.`;

const EXECUTOR_ID = 'plan-executor';
const EXECUTOR_DISPLAY = 'Executor';
const EXECUTOR_PROMPT = `The previous assistant turn contains a "Plan:" with numbered steps. Execute each step by writing exactly one line per step that begins with "Step N:" and describes what you did in 5-10 words (you have no real tools — narrate plausibly). End your reply with the single word "Done." on its own line.`;

test.describe('Scenario 8 — Plan & Execute', () => {
  // Same headroom as Scenario 5 — sequential LLM calls + authoring.
  test.describe.configure({ timeout: 180_000 });

  test.skip(
    !HAS_REAL_KEY,
    'requires E2E_ANTHROPIC_API_KEY to be set when running `npm run setup`',
  );

  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('build plan-and-do flow, dispatch /plan-and-do, see planner + executor bubbles', async ({
    page,
  }) => {
    // ── Arrange ──
    await page.goto('/flows/new', { waitUntil: 'networkidle' });
    await page.waitForSelector('nav[aria-label="Add node"]');
    await fillFlowMeta(page, {
      display: 'Plan & Do',
      apiName: FLOW_API_NAME,
      description: 'A planner outlines steps, then an executor performs them.',
      slashName: SLASH_NAME,
    });

    // Slot wiring (#26): planner publishes `plan`; executor reads it.
    // Without slots the executor inherits the full transcript ending on
    // the planner's assistant turn → Anthropic rejects assistant
    // prefill (the same Failure B documented in future-discussions #26).
    await dropFromPalette(page, 'Agent');
    await configureChatAgent(page, {
      nodeId: PLANNER_ID,
      display: PLANNER_DISPLAY,
      prompt: PLANNER_PROMPT,
      outputs: ['plan'],
    });

    await dropFromPalette(page, 'Agent');
    await configureChatAgent(page, {
      nodeId: EXECUTOR_ID,
      display: EXECUTOR_DISPLAY,
      prompt: EXECUTOR_PROMPT,
      inputs: ['plan'],
    });

    await dragHandle(
      page,
      { nodeId: '__start__', handleId: 'out' },
      { nodeId: PLANNER_ID, handleId: 'left' },
    );
    await dragHandle(
      page,
      { nodeId: PLANNER_ID, handleId: 'right' },
      { nodeId: EXECUTOR_ID, handleId: 'left' },
    );
    await dragHandle(
      page,
      { nodeId: EXECUTOR_ID, handleId: 'right' },
      { nodeId: '__end__', handleId: 'in' },
    );

    await saveFlow(page);
    const agentIds = db.agentsForFlow(FLOW_API_NAME).map((r) => r[0]).sort();
    expect(agentIds).toEqual([EXECUTOR_ID, PLANNER_ID]);

    // ── Act ──
    await page.goto('/chat', { waitUntil: 'networkidle' });
    const composer = page.getByRole('textbox', { name: /chat input/i });
    await composer.click();
    await composer.fill(
      `/${SLASH_NAME} organise a small birthday party for ten guests`,
    );
    await page.keyboard.press('Enter');

    // ── Assert ──
    await expect(page.locator('[data-role="user"]').last()).toContainText(
      /birthday party/i,
      { timeout: 5_000 },
    );

    // Poll until BOTH bubbles exist AND the executor's signature
    // line ("Done.") has landed. (See Scenario 5 for the same pattern
    // + reasoning — a single `toContainText` on .last() can match the
    // planner's text while the executor's bubble hasn't been added.)
    await expect(async () => {
      const bubbles = await page.locator('[data-role="assistant"]').allTextContents();
      expect(bubbles.length).toBe(2);
      const planner = bubbles[0];
      const executor = bubbles[1];
      expect(planner).toMatch(/Plan:/i);
      // The planner is prompted to emit a numbered list. Streamdown
      // renders it as <ol>, so the "1." marker is CSS-generated list
      // styling and is NOT present in textContent. Assert the ordered
      // list actually rendered (3-5 steps per the planner prompt)
      // instead of grepping the now-marker-less text.
      expect(
        await page.locator('[data-role="assistant"]').first().locator('ol li').count(),
      ).toBeGreaterThanOrEqual(3);
      expect(executor).toMatch(/Step\s*1\b/i);
      expect(executor).toMatch(/Done\./i);
    }).toPass({ timeout: 150_000, intervals: [500, 1000, 2000] });
  });
});
