/**
 * Scenario 10 — Aggregator (parallel fan-out + synthesis).
 *
 * From `docs/FRONTEND_TEST_SCENARIOS.md`. Tests that a flow can fan
 * out the user's question to three agents in PARALLEL, then fan in to
 * a synthesizer that reads all three perspectives and writes a
 * unified answer.
 *
 * Topology:
 *   Start ─┬─→ agg-technical   ─┐
 *          ├─→ agg-practical   ─┼─→ agg-synthesizer → End
 *          └─→ agg-historical  ─┘
 *
 * Slot wiring (#26): each perspective publishes to its own named slot
 * (so parallel writes don't last-wins-clobber each other), and the
 * synthesizer reads all three. Without slots, the synthesizer would
 * see three back-to-back assistant turns and trip Anthropic's
 * assistant-prefill rejection.
 *
 * Real-LLM-required.
 */
import { expect, test } from '@playwright/test';

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

const FLOW_API_NAME = 'aggregate';
const SLASH_NAME = 'aggregate';

const PERSPECTIVES: ReadonlyArray<{
  nodeId: string;
  display: string;
  prompt: string;
  outputSlot: string;
}> = [
  {
    nodeId: 'agg-technical',
    display: 'Technical Perspective',
    prompt: `The user's question (below) needs a TECHNICAL perspective. Answer in 1-2 sentences. Begin your reply with the literal text "[TECHNICAL]".`,
    outputSlot: 'perspective_tech',
  },
  {
    nodeId: 'agg-practical',
    display: 'Practical Perspective',
    prompt: `The user's question (below) needs a PRACTICAL / everyday perspective. Answer in 1-2 sentences. Begin your reply with the literal text "[PRACTICAL]".`,
    outputSlot: 'perspective_prac',
  },
  {
    nodeId: 'agg-historical',
    display: 'Historical Perspective',
    prompt: `The user's question (below) needs a HISTORICAL perspective. Answer in 1-2 sentences. Begin your reply with the literal text "[HISTORICAL]".`,
    outputSlot: 'perspective_hist',
  },
];

const SYNTH_ID = 'agg-synthesizer';
const SYNTH_PROMPT = `Three perspectives on the user's question are provided below, each prefixed with [TECHNICAL], [PRACTICAL], or [HISTORICAL]. Write a single 2-3 sentence synthesis that EXPLICITLY weaves together insights from ALL THREE — name each perspective by its label at least once. Begin your reply with the literal text "[SYNTHESIS]".`;

test.describe('Scenario 10 — Aggregator (fan-out + fan-in)', () => {
  // 3 parallel LLM calls + 1 synthesizer + authoring. 5 minutes is
  // comfortable; Anthropic Sonnet parallel calls usually return in
  // ~10-20s each.
  test.describe.configure({ timeout: 300_000 });

  test.skip(
    !HAS_REAL_KEY,
    'requires E2E_ANTHROPIC_API_KEY to be set when running `npm run setup`',
  );

  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('build aggregator flow, dispatch /aggregate, see three perspectives + synthesis', async ({
    page,
  }) => {
    // ── Arrange ──
    await page.goto('/flows/new', { waitUntil: 'networkidle' });
    await page.waitForSelector('nav[aria-label="Add node"]');
    await fillFlowMeta(page, {
      display: 'Multi-Perspective Aggregator',
      apiName: FLOW_API_NAME,
      description: 'Gets three perspectives in parallel, then synthesises them.',
      slashName: SLASH_NAME,
    });

    // Three perspective agents.
    for (const p of PERSPECTIVES) {
      await dropFromPalette(page, 'Agent');
      await configureChatAgent(page, {
        nodeId: p.nodeId,
        display: p.display,
        prompt: p.prompt,
        inputs: ['user_query'],
        outputs: [p.outputSlot],
      });
    }

    // Synthesizer reads all three perspective slots.
    await dropFromPalette(page, 'Agent');
    await configureChatAgent(page, {
      nodeId: SYNTH_ID,
      display: 'Synthesizer',
      prompt: SYNTH_PROMPT,
      inputs: [
        'perspective_tech',
        'perspective_prac',
        'perspective_hist',
      ],
    });

    // Wire fan-out + fan-in via the store (drag-based is too brittle
    // with 4+ overlapping nodes; see Scenario 7 for the diagnostic).
    for (const p of PERSPECTIVES) {
      await connectViaStore(
        page,
        { nodeId: '__start__', handleId: 'out' },
        { nodeId: p.nodeId, handleId: 'left' },
      );
      await connectViaStore(
        page,
        { nodeId: p.nodeId, handleId: 'right' },
        { nodeId: SYNTH_ID, handleId: 'left' },
      );
    }
    await connectViaStore(
      page,
      { nodeId: SYNTH_ID, handleId: 'right' },
      { nodeId: '__end__', handleId: 'in' },
    );

    await saveFlow(page);
    const agentIds = db.agentsForFlow(FLOW_API_NAME).map((r) => r[0]).sort();
    // Alphabetical: historical < practical < synthesizer < technical.
    expect(agentIds).toEqual([
      'agg-historical',
      'agg-practical',
      SYNTH_ID, // agg-synthesizer
      'agg-technical',
    ]);

    // ── Act ──
    await page.goto('/chat', { waitUntil: 'networkidle' });
    const composer = page.getByRole('textbox', { name: /chat input/i });
    await composer.click();
    await composer.fill(`/${SLASH_NAME} why do we use clocks?`);
    await page.keyboard.press('Enter');

    // ── Assert ──
    await expect(page.locator('[data-role="user"]').last()).toContainText(
      /clocks/i,
      { timeout: 5_000 },
    );

    // Wait for all four bubbles to land AND each has its prefix.
    // Three perspective bubbles can appear in any order (parallel
    // execution), and the synthesizer appears last.
    await expect(async () => {
      const bubbles = await page.locator('[data-role="assistant"]').allTextContents();
      expect(bubbles.length).toBeGreaterThanOrEqual(4);
      const joined = bubbles.join('\n');
      expect(joined).toMatch(/\[TECHNICAL\]/);
      expect(joined).toMatch(/\[PRACTICAL\]/);
      expect(joined).toMatch(/\[HISTORICAL\]/);
      // Synthesizer is the LAST bubble.
      expect(bubbles[bubbles.length - 1]).toMatch(/\[SYNTHESIS\]/);
    }).toPass({ timeout: 150_000, intervals: [500, 1000, 2000] });
  });
});
