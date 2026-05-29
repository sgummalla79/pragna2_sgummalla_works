/**
 * Scenario 7 — In-flow routing (router → specialist by topic).
 *
 * From `docs/FRONTEND_TEST_SCENARIOS.md`. Tests an If/Else with THREE
 * custom emits dispatching to three specialist Agents. The router
 * uses `set_route` (#25) to pick its branch based on classification.
 *
 * Topology:
 *   Start → triage-router (If/Else, emits=[code, math, general])
 *   triage-router (port:code)    → triage-coder
 *   triage-router (port:math)    → triage-mathematician
 *   triage-router (port:general) → triage-generalist
 *   All 3 specialists → End
 *
 * Slot wiring (#26): every node reads from `user_query` so each
 * specialist's LLM call ends on a user turn — avoids the Anthropic
 * assistant-prefill error after the router's classification turn.
 *
 * The test exercises ALL THREE branches in turn (3 separate chats,
 * one per topic) to confirm the routing actually discriminates.
 *
 * Real-LLM-required.
 */
import { expect, test, type Page } from '@playwright/test';

import { login } from '../helpers/auth';
import { db } from '../helpers/db';
import {
  configureChatAgent,
  connectViaStore,
  dropFromPalette,
  fillFlowMeta,
  saveFlow,
} from '../helpers/flow-author';

const HAS_REAL_KEY = Boolean(process.env.E2E_ANTHROPIC_API_KEY);
const FLOW_API_NAME = 'triage';
const SLASH_NAME = 'triage';

const ROUTER_ID = 'triage-router';
const ROUTER_PROMPT = `The user's question is below. Classify it into EXACTLY ONE of: "code" (anything about programming, software, debugging), "math" (numbers, equations, formulas, calculations), or "general" (everything else). Reply with one short sentence stating your classification — e.g. "Classified as code." — then call set_route with target equal to "code", "math", or "general". Do NOT answer the question yourself.`;

const SPECIALISTS: ReadonlyArray<{
  nodeId: string;
  display: string;
  prompt: string;
}> = [
  {
    nodeId: 'triage-coder',
    display: 'Coder Specialist',
    prompt: `The user's question (below) was classified as a code question. Answer with concise code or a 1-2 sentence explanation. Begin your reply with the literal text "[CODE]".`,
  },
  {
    nodeId: 'triage-mathematician',
    display: 'Math Specialist',
    prompt: `The user's question (below) was classified as a math question. Answer with the relevant formula or short calculation. Begin your reply with the literal text "[MATH]".`,
  },
  {
    nodeId: 'triage-generalist',
    display: 'Generalist',
    prompt: `The user's question (below) was classified as general. Answer in 1-2 plain sentences. Begin your reply with the literal text "[GENERAL]".`,
  },
];

async function sendInFreshChat(page: Page, message: string): Promise<void> {
  await page.goto('/chat', { waitUntil: 'networkidle' });
  const composer = page.getByRole('textbox', { name: /chat input/i });
  await composer.click();
  await composer.fill(message);
  await page.keyboard.press('Enter');
}

test.describe('Scenario 7 — Triage router', () => {
  // 1 authoring pass + 3 sequential LLM-pair runs (router + specialist
  // per topic). 4 minutes of headroom is conservative.
  test.describe.configure({ timeout: 300_000 });

  test.skip(
    !HAS_REAL_KEY,
    'requires E2E_ANTHROPIC_API_KEY to be set when running `npm run setup`',
  );

  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('build triage flow, then dispatch all three branches', async ({ page }) => {
    // ── Arrange ──
    await page.goto('/flows/new', { waitUntil: 'networkidle' });
    await page.waitForSelector('nav[aria-label="Add node"]');
    await fillFlowMeta(page, {
      display: 'Triage Router',
      apiName: FLOW_API_NAME,
      description: 'Classifies the user\'s question into code, math, or general and routes to a specialist.',
      slashName: SLASH_NAME,
    });

    // Router (If/Else with custom 3-way emits).
    await dropFromPalette(page, 'If/Else');
    await configureChatAgent(page, {
      nodeId: ROUTER_ID,
      display: 'Triage Router',
      prompt: ROUTER_PROMPT,
      emits: ['code', 'math', 'general'],
      inputs: ['user_query'],
    });

    // Three specialist Agents (cascade-positioned; spread before
    // wiring below).
    for (const spec of SPECIALISTS) {
      await dropFromPalette(page, 'Agent');
      await configureChatAgent(page, {
        nodeId: spec.nodeId,
        display: spec.display,
        prompt: spec.prompt,
        inputs: ['user_query'],
      });
    }

    // Wire the edges via the store directly. A drag-based approach
    // is too brittle with 4+ nodes: the palette cascade stacks them
    // tightly, fitView's auto-scaling means screen-pixel drag targets
    // don't map to canvas coords 1:1, and edges to obscured handles
    // silently no-op. `connectViaStore` routes through the same
    // `onConnect` action a successful mouse drag would fire.
    await connectViaStore(
      page,
      { nodeId: '__start__', handleId: 'out' },
      { nodeId: ROUTER_ID, handleId: 'in' },
    );
    await connectViaStore(
      page,
      { nodeId: ROUTER_ID, handleId: 'port:code' },
      { nodeId: 'triage-coder', handleId: 'left' },
    );
    await connectViaStore(
      page,
      { nodeId: ROUTER_ID, handleId: 'port:math' },
      { nodeId: 'triage-mathematician', handleId: 'left' },
    );
    await connectViaStore(
      page,
      { nodeId: ROUTER_ID, handleId: 'port:general' },
      { nodeId: 'triage-generalist', handleId: 'left' },
    );
    for (const spec of SPECIALISTS) {
      await connectViaStore(
        page,
        { nodeId: spec.nodeId, handleId: 'right' },
        { nodeId: '__end__', handleId: 'in' },
      );
    }

    await saveFlow(page);
    const agentIds = db.agentsForFlow(FLOW_API_NAME).map((r) => r[0]).sort();
    expect(agentIds).toEqual([
      'triage-coder',
      'triage-generalist',
      'triage-mathematician',
      ROUTER_ID,
    ]);

    // ── Act + Assert — one run per branch ──
    const cases = [
      { topic: 'write a python function that reverses a string', expectedTag: /\[CODE\]/i },
      { topic: 'what is the integral of x squared from 0 to 3', expectedTag: /\[MATH\]/i },
      { topic: 'who was the first president of the United States', expectedTag: /\[GENERAL\]/i },
    ];

    for (const c of cases) {
      await sendInFreshChat(page, `/${SLASH_NAME} ${c.topic}`);

      // The user bubble lands immediately.
      await expect(page.locator('[data-role="user"]').last()).toContainText(
        c.topic,
        { timeout: 5_000 },
      );

      // Poll until BOTH the router + specialist have produced bubbles
      // (>=2 total) AND the specialist's [TAG] prefix has landed.
      await expect(async () => {
        const bubbles = await page.locator('[data-role="assistant"]').allTextContents();
        expect(bubbles.length).toBeGreaterThanOrEqual(2);
        // The LAST bubble is the specialist's reply. Confirm its tag
        // matches the branch this topic should have taken.
        expect(bubbles[bubbles.length - 1]).toMatch(c.expectedTag);
      }).toPass({ timeout: 90_000, intervals: [500, 1000, 2000] });
    }
  });
});
