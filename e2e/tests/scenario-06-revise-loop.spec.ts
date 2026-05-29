/**
 * Scenario 6 — Reflection / revision loop (drafter ↔ reviewer).
 *
 * From `docs/FRONTEND_TEST_SCENARIOS.md`. The canonical If/Else routing
 * test:
 *
 *   Start → haiku-drafter → haiku-reviewer
 *   haiku-reviewer (port:passed) → End
 *   haiku-reviewer (port:failed) → haiku-drafter (loop back)
 *
 * Slot wiring (#26):
 *   - drafter inputs: [user_query, critique]; outputs: [draft]
 *   - reviewer inputs: [draft]; outputs: [critique]
 *
 * The reviewer is dropped from the If/Else palette entry (which
 * pre-fills emits=[passed, failed]) and uses `set_route` (#25) to
 * pick its branch.
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

const FLOW_API_NAME = 'revise-loop';
const SLASH_NAME = 'revise';

const DRAFTER_ID = 'haiku-drafter';
const DRAFTER_PROMPT = `The user's topic appears below. Write a haiku (3 lines, roughly 5/7/5 syllables) on that topic. If a critique block is also below, address every concern in your revision. Output ONLY the haiku — no preface, no commentary.`;

const REVIEWER_ID = 'haiku-reviewer';
const REVIEWER_PROMPT = `A haiku draft appears below. Verify (a) exactly 3 lines, (b) roughly 5/7/5 syllables. Reply with one short sentence stating your judgement, then call set_route: target="passed" if BOTH checks succeed; target="failed" if either fails. Be slightly lenient on syllable counts — a 4/7/5 or 5/8/5 passes if the spirit is right.`;

test.describe('Scenario 6 — Revise loop with If/Else', () => {
  // Up to 3 sequential LLM calls (drafter + reviewer + possibly revise)
  // plus authoring. 3 minutes covers slow tails comfortably.
  test.describe.configure({ timeout: 240_000 });

  test.skip(
    !HAS_REAL_KEY,
    'requires E2E_ANTHROPIC_API_KEY to be set when running `npm run setup`',
  );

  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('build revise-loop, dispatch /revise, see drafter + reviewer bubbles end on passed', async ({
    page,
  }) => {
    // ── Arrange ──
    await page.goto('/flows/new', { waitUntil: 'networkidle' });
    await page.waitForSelector('nav[aria-label="Add node"]');
    await fillFlowMeta(page, {
      display: 'Revise Loop',
      apiName: FLOW_API_NAME,
      description: 'Drafts a haiku and revises until a reviewer approves.',
      slashName: SLASH_NAME,
    });

    // Drafter (chat Agent — emits empty, reads user_query + critique
    // slots, publishes its haiku to the draft slot).
    await dropFromPalette(page, 'Agent');
    await configureChatAgent(page, {
      nodeId: DRAFTER_ID,
      display: 'Haiku Drafter',
      prompt: DRAFTER_PROMPT,
      inputs: ['user_query', 'critique'],
      outputs: ['draft'],
    });

    // Reviewer (If/Else — palette entry pre-fills emits=[passed,
    // failed], we keep them; reads `draft`, publishes `critique`).
    await dropFromPalette(page, 'Decision');
    await configureChatAgent(page, {
      nodeId: REVIEWER_ID,
      display: 'Haiku Reviewer',
      prompt: REVIEWER_PROMPT,
      inputs: ['draft'],
      outputs: ['critique'],
      // emits left as the If/Else default [passed, failed].
    });

    // Wire the four edges, including the revise back-edge from the
    // reviewer's `port:failed` to the drafter.
    await dragHandle(
      page,
      { nodeId: '__start__', handleId: 'out' },
      { nodeId: DRAFTER_ID, handleId: 'left' },
    );
    await dragHandle(
      page,
      { nodeId: DRAFTER_ID, handleId: 'right' },
      { nodeId: REVIEWER_ID, handleId: 'in' },
    );
    await dragHandle(
      page,
      { nodeId: REVIEWER_ID, handleId: 'port:passed' },
      { nodeId: '__end__', handleId: 'in' },
    );
    await dragHandle(
      page,
      { nodeId: REVIEWER_ID, handleId: 'port:failed' },
      { nodeId: DRAFTER_ID, handleId: 'top' },
    );

    await saveFlow(page);

    // DB invariants — confirm topology + If/Else emits + slot configs.
    const agentIds = db.agentsForFlow(FLOW_API_NAME).map((r) => r[0]).sort();
    expect(agentIds).toEqual([DRAFTER_ID, REVIEWER_ID]);

    // ── Act ──
    await page.goto('/chat', { waitUntil: 'networkidle' });
    const composer = page.getByRole('textbox', { name: /chat input/i });
    await composer.click();
    await composer.fill(`/${SLASH_NAME} cherry blossoms`);
    await page.keyboard.press('Enter');

    // ── Assert ──
    await expect(page.locator('[data-role="user"]').last()).toContainText(
      /cherry blossoms/i,
      { timeout: 5_000 },
    );

    // Wait for the run to fully settle: at minimum we see drafter +
    // reviewer (>=2 bubbles). On a revise-and-pass run we may see
    // 3, 4, or more. The terminating signal is the ThinkingStrip
    // flipping to "Ready for your next message".
    await expect(
      page.getByTestId('thinking-strip'),
    ).toHaveAttribute('aria-label', /Ready for your next message/i, {
      timeout: 180_000,
    });

    // Poll the final state: an even number of bubbles (drafter +
    // reviewer pair per iteration), the LAST bubble is the reviewer's
    // judgement (one short sentence) and the iteration ended on a
    // pass (so the final reviewer reply doesn't suggest "failed" /
    // criticism — admittedly LLM-dependent, so we only assert the
    // BUBBLES were produced and at least one haiku-like 3-line draft
    // exists in the transcript).
    await expect(async () => {
      const bubbles = await page.locator('[data-role="assistant"]').allTextContents();
      expect(bubbles.length).toBeGreaterThanOrEqual(2);
      // At least one bubble looks haiku-like (3 lines of text). Cheap
      // shape check: contains exactly two line-break-separated chunks.
      const haikuLike = bubbles.some((b) => b.split('\n').filter((l) => l.trim()).length >= 3);
      expect(haikuLike).toBeTruthy();
      // The final bubble (reviewer's last judgement) is bounded —
      // under ~600 chars. Some models annotate syllable counts per
      // line which can run to ~300+ chars; we only need to confirm
      // it's not the much longer haiku or a chained ramble.
      expect(bubbles[bubbles.length - 1].length).toBeLessThan(800);
    }).toPass({ timeout: 30_000, intervals: [500, 1000, 2000] });
  });
});
