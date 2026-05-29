/**
 * Scenario 9 — Multi-pause HITL (two ask_user forms in one flow).
 *
 * From `docs/FRONTEND_TEST_SCENARIOS.md`. Tests that a single flow run
 * can pause TWICE — once at each of two different nodes — and the
 * same chat surface handles both forms in sequence within one
 * episode.
 *
 * Topology:
 *   Start → stage-1-collector → stage-2-collector → End
 *
 * Both collectors have `ask_user` bound. The flow pauses at each in
 * turn; the user submits values; the run resumes and continues.
 *
 * Slot wiring (#26):
 *   - stage-1: outputs=[stage1_summary] (its "Got it: <name> in <city>." line)
 *   - stage-2: inputs=[user_query, stage1_summary] so its prompt sees
 *     both the original request AND stage 1's collected identity (so
 *     the final summary can echo Alex+Berlin even though stage 1 ran
 *     in a separate node).
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

const FLOW_API_NAME = 'two-stage-form';
const SLASH_NAME = 'two-stage-form';

const STAGE1_ID = 'stage-1-collector';
const STAGE1_PROMPT = `You collect basic identity. You MUST call the ask_user tool EXACTLY ONCE to collect: (1) "name" — first name (text, required); (2) "city" — city the user lives in (text, required). After the user submits the form, write ONE short line: "Got it: <name> in <city>." then stop. Do NOT call ask_user a second time.`;

const STAGE2_ID = 'stage-2-collector';
const STAGE2_PROMPT = `You collect an activity preference. Above this you may see an earlier "Got it: <name> in <city>." line — remember that name and city. You MUST call the ask_user tool EXACTLY ONCE to collect: (1) "activity" — favourite weekend activity (text, required). After the user submits, write one summary sentence that mentions the activity AND repeats the earlier name + city. End with "All done." Do NOT call ask_user a second time.`;

/** Fill every text/number/date input inside the open HITL form with a
 *  value derived from the field's label (so the LLM's confirmation can
 *  reference what we typed). */
async function fillAndSubmitForm(
  page: Page,
  values: Record<string, string>,
): Promise<void> {
  // The form headline anchors the form's open state.
  await expect(page.getByText(/agent needs your input/i)).toBeVisible({
    timeout: 30_000,
  });
  // For each labelled input, find a matching key in `values` (case-
  // insensitive substring match — LLM may capitalise / rename slightly).
  const inputs = await page
    .locator('form input[type="text"], form input[type="number"], form textarea')
    .all();
  for (const input of inputs) {
    const id = (await input.getAttribute('id')) ?? '';
    // Field labels live in a sibling <Label htmlFor=id>; pull its text.
    const labelText = (await page.locator(`label[for="${id}"]`).textContent()) ?? '';
    const lower = labelText.toLowerCase();
    let value = '';
    for (const [k, v] of Object.entries(values)) {
      if (lower.includes(k.toLowerCase())) {
        value = v;
        break;
      }
    }
    if (!value) value = 'na'; // fallback — shouldn't matter; LLM picks the schema
    await input.fill(value);
  }
  await page.locator('form button[type="submit"]').click();
}

test.describe('Scenario 9 — Two-stage HITL form', () => {
  // 2 pauses + 2 LLM calls + 1 LLM call per resume → up to 5 LLM
  // interactions plus the authoring. 5 minutes of headroom is
  // conservative for slow tails.
  test.describe.configure({ timeout: 300_000 });

  test.skip(
    !HAS_REAL_KEY,
    'requires E2E_ANTHROPIC_API_KEY to be set when running `npm run setup`',
  );

  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('build two-stage-form, dispatch, fill two forms in sequence, see summary', async ({
    page,
  }) => {
    // ── Arrange ──
    await page.goto('/flows/new', { waitUntil: 'networkidle' });
    await page.waitForSelector('nav[aria-label="Add node"]');
    await fillFlowMeta(page, {
      display: 'Two-Stage Form',
      apiName: FLOW_API_NAME,
      description: 'Collect identity, then preferences, then summarise.',
      slashName: SLASH_NAME,
    });

    // Stage 1 — has ask_user tool, publishes its summary line.
    await dropFromPalette(page, 'Agent');
    await configureChatAgent(page, {
      nodeId: STAGE1_ID,
      display: 'Stage 1 Collector',
      prompt: STAGE1_PROMPT,
      inputs: ['user_query'],
      outputs: ['stage1_summary'],
    });
    // Add the ask_user chip via the Tools ChipInput (NodePanel is
    // already closed by configureChatAgent — reopen).
    await page.locator(`.react-flow__node[data-id="${STAGE1_ID}"]`).dispatchEvent('click');
    await page.locator('#np-agent-tools').fill('ask_user');
    await page.locator('#np-agent-tools').press('Enter');
    await page.getByRole('button', { name: /close panel/i }).click();

    // Stage 2 — has ask_user tool, reads stage1_summary.
    await dropFromPalette(page, 'Agent');
    await configureChatAgent(page, {
      nodeId: STAGE2_ID,
      display: 'Stage 2 Collector',
      prompt: STAGE2_PROMPT,
      inputs: ['user_query', 'stage1_summary'],
    });
    await page.locator(`.react-flow__node[data-id="${STAGE2_ID}"]`).dispatchEvent('click');
    await page.locator('#np-agent-tools').fill('ask_user');
    await page.locator('#np-agent-tools').press('Enter');
    await page.getByRole('button', { name: /close panel/i }).click();

    // Wire Start → stage1 → stage2 → End via the store (robust on a
    // crowded canvas).
    await connectViaStore(
      page,
      { nodeId: '__start__', handleId: 'out' },
      { nodeId: STAGE1_ID, handleId: 'left' },
    );
    await connectViaStore(
      page,
      { nodeId: STAGE1_ID, handleId: 'right' },
      { nodeId: STAGE2_ID, handleId: 'left' },
    );
    await connectViaStore(
      page,
      { nodeId: STAGE2_ID, handleId: 'right' },
      { nodeId: '__end__', handleId: 'in' },
    );

    await saveFlow(page);
    const agentIds = db.agentsForFlow(FLOW_API_NAME).map((r) => r[0]).sort();
    expect(agentIds).toEqual([STAGE1_ID, STAGE2_ID]);

    // ── Act ──
    await page.goto('/chat', { waitUntil: 'networkidle' });
    const composer = page.getByRole('textbox', { name: /chat input/i });
    await composer.click();
    // Trailing space closes the slash popover (otherwise it intercepts
    // Enter to "select" the highlighted slash, never reaching the
    // composer's send handler). Matches the doc's flow where the user
    // picks /two-stage-form from the popover, which leaves a trailing
    // space, then presses Enter to send.
    await composer.fill(`/${SLASH_NAME} `);
    await page.keyboard.press('Enter');

    // ── Assert — first form, then second form, then summary ──
    // Form 1: name + city.
    await fillAndSubmitForm(page, { name: 'Alex', city: 'Berlin' });

    // The form disappears, an intermediate bubble lands ("Got it:
    // Alex in Berlin."), then the second form appears.
    await fillAndSubmitForm(page, { activity: 'cycling' });

    // Final assistant bubble references all three submitted values.
    // Use toPass polling because the final stream takes time.
    await expect(async () => {
      const bubbles = await page.locator('[data-role="assistant"]').allTextContents();
      // Two assistant bubbles minimum: stage1's "Got it:" + stage2's
      // final summary.
      expect(bubbles.length).toBeGreaterThanOrEqual(2);
      const finalBubble = bubbles[bubbles.length - 1];
      expect(finalBubble).toMatch(/cycling/i);
      expect(finalBubble).toMatch(/Alex/);
      expect(finalBubble).toMatch(/Berlin/i);
      expect(finalBubble).toMatch(/all done/i);
    }).toPass({ timeout: 120_000, intervals: [500, 1000, 2000] });
  });
});
