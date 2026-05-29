/**
 * Scenario 5 — Sequential pipeline (research → summarize).
 *
 * From `docs/FRONTEND_TEST_SCENARIOS.md`. Two chat-agents wired in
 * sequence; the runtime emits TWO assistant bubbles back-to-back, one
 * per node, with the progress strip flipping between their display
 * names.
 *
 * Topology:
 *   Start → pipeline-researcher → pipeline-summarizer → End
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

const FLOW_API_NAME = 'research-pipeline';
const SLASH_NAME = 'research-pipeline';

const RESEARCHER_ID = 'pipeline-researcher';
const RESEARCHER_DISPLAY = 'Pipeline Researcher';
const RESEARCHER_PROMPT = `You are a researcher. Write 3 to 5 sentences explaining the user's topic in plain English. Do NOT add a summary or conclusion line — output ONLY the explanation paragraph.`;

const SUMMARIZER_ID = 'pipeline-summarizer';
const SUMMARIZER_DISPLAY = 'Pipeline Summarizer';
const SUMMARIZER_PROMPT = `The previous assistant turn contains a research passage. Condense it into EXACTLY ONE sentence (max 25 words) that captures the most important fact. Output ONLY the one-sentence summary — no preface, no list, no quote of the original.`;

test.describe('Scenario 5 — Sequential pipeline', () => {
  // Two sequential LLM calls + 30s of authoring need headroom beyond
  // Playwright's 30s per-test default. Anthropic Sonnet's full reply
  // on each node is ~10-20s; 3 minutes covers slow tail cases too.
  test.describe.configure({ timeout: 180_000 });

  test.skip(
    !HAS_REAL_KEY,
    'requires E2E_ANTHROPIC_API_KEY to be set when running `npm run setup`',
  );

  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('build 2-node pipeline, dispatch /research-pipeline, see two bubbles', async ({
    page,
  }) => {
    // ── Arrange ──
    await page.goto('/flows/new', { waitUntil: 'networkidle' });
    await page.waitForSelector('nav[aria-label="Add node"]');
    await fillFlowMeta(page, {
      display: 'Research Pipeline',
      apiName: FLOW_API_NAME,
      description: 'Researches a topic, then condenses to one sentence.',
      slashName: SLASH_NAME,
    });

    // Slot wiring (#26): the researcher publishes its text to the
    // `research_notes` slot; the summarizer reads ONLY from that slot.
    // Without slots, the summarizer's prompt would inherit the full
    // transcript (ending on the researcher's assistant turn) and
    // Anthropic rejects that with "model does not support assistant
    // message prefill".
    await dropFromPalette(page, 'Agent');
    await configureChatAgent(page, {
      nodeId: RESEARCHER_ID,
      display: RESEARCHER_DISPLAY,
      prompt: RESEARCHER_PROMPT,
      outputs: ['research_notes'],
    });

    await dropFromPalette(page, 'Agent');
    await configureChatAgent(page, {
      nodeId: SUMMARIZER_ID,
      display: SUMMARIZER_DISPLAY,
      prompt: SUMMARIZER_PROMPT,
      inputs: ['research_notes'],
    });

    await dragHandle(
      page,
      { nodeId: '__start__', handleId: 'out' },
      { nodeId: RESEARCHER_ID, handleId: 'left' },
    );
    await dragHandle(
      page,
      { nodeId: RESEARCHER_ID, handleId: 'right' },
      { nodeId: SUMMARIZER_ID, handleId: 'left' },
    );
    await dragHandle(
      page,
      { nodeId: SUMMARIZER_ID, handleId: 'right' },
      { nodeId: '__end__', handleId: 'in' },
    );

    await saveFlow(page);
    const agentIds = db.agentsForFlow(FLOW_API_NAME).map((r) => r[0]).sort();
    expect(agentIds).toEqual([RESEARCHER_ID, SUMMARIZER_ID]);

    // ── Act ──
    await page.goto('/chat', { waitUntil: 'networkidle' });
    const composer = page.getByRole('textbox', { name: /chat input/i });
    await composer.click();
    await composer.fill(`/${SLASH_NAME} what is photosynthesis`);
    await page.keyboard.press('Enter');

    // ── Assert ──
    await expect(page.locator('[data-role="user"]').last()).toContainText(
      /photosynthesis/i,
      { timeout: 5_000 },
    );

    // Poll until BOTH bubbles exist AND the second carries summarizer
    // content. (A single `toContainText` on `.last()` can match the
    // researcher's text while it's still the only bubble — the second
    // gets added a tick later. `toPass` polls all conditions together
    // so we only succeed when the run has fully landed.)
    await expect(async () => {
      const bubbles = await page.locator('[data-role="assistant"]').allTextContents();
      expect(bubbles.length).toBe(2);
      const researcher = bubbles[0];
      const summarizer = bubbles[1];
      expect(researcher).toMatch(/photosynth|plant|light|sugar|chloro/i);
      expect(summarizer).toMatch(/photosynth|plant|light|sugar|chloro/i);
      // The summarizer compresses by design.
      expect(summarizer.length).toBeLessThan(researcher.length);
    }).toPass({ timeout: 150_000, intervals: [500, 1000, 2000] });
  });
});
