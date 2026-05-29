/**
 * Scenario 2 — Chat that opens a form (the "ask user" tool).
 *
 * From `docs/FRONTEND_TEST_SCENARIOS.md`. Tests that the default chat
 * agent can call the universal `ask_user` tool to pause the run, render
 * a form pop-up above the composer, and resume with the submitted
 * values reflected in the next assistant turn.
 *
 * Real-LLM-required (`E2E_ANTHROPIC_API_KEY`). The LLM has discretion
 * about WHETHER to call `ask_user` for a given prompt; the user's
 * message in this scenario is explicit ("Please use ask_user to
 * collect ...") so a competent model should comply on the first try.
 * If it doesn't, the test retries once with an even more explicit
 * follow-up before failing.
 */
import { expect, test, type Page } from '@playwright/test';

import { login } from '../helpers/auth';

const HAS_REAL_KEY = Boolean(process.env.E2E_ANTHROPIC_API_KEY);

const PROMPT = `I want to book a meeting room. Please use ask_user to collect the room name, the meeting date, and how many people will attend, then confirm the details back to me.`;

/** Submit the composer text. */
async function sendComposer(page: Page, text: string) {
  const composer = page.getByRole('textbox', { name: /chat input/i });
  await composer.click();
  await composer.fill(text);
  await page.keyboard.press('Enter');
}

/** Find every visible text-ish input inside the open HITL form. */
async function formInputs(page: Page) {
  return page
    .locator(
      'form input[type="text"], form input[type="number"], form input[type="date"], form textarea',
    )
    .all();
}

test.describe('Scenario 2 — Chat with ask_user form', () => {
  test.skip(
    !HAS_REAL_KEY,
    'requires E2E_ANTHROPIC_API_KEY to be set when running `npm run setup`',
  );

  test.beforeEach(async ({ page }) => {
    await login(page);
    await page.goto('/chat', { waitUntil: 'networkidle' });
  });

  test('LLM calls ask_user → form appears → submit → confirmation reply', async ({ page }) => {
    await sendComposer(page, PROMPT);

    // ── User bubble lands ──
    await expect(page.locator('[data-role="user"]').last()).toContainText(
      /book a meeting room/i,
      { timeout: 5_000 },
    );

    // ── A form pops up. The HITLFormCard renders "The agent needs your
    //    input" as its header — a reliable signal that the form is open
    //    independent of the LLM's chosen field names. ──
    const formHeader = page.getByText(/agent needs your input/i);
    try {
      await expect(formHeader).toBeVisible({ timeout: 30_000 });
    } catch {
      // Retry once with a maximally explicit follow-up if the LLM
      // skipped the tool (it sometimes does on borderline prompts).
      await sendComposer(
        page,
        'You MUST call the ask_user tool before answering. Use it now to collect: room_name, meeting_date, attendees.',
      );
      await expect(formHeader).toBeVisible({ timeout: 30_000 });
    }

    // ── At least 2 input fields are present (3 expected — room, date,
    //    attendees — but allow some slack in case the LLM bundles two
    //    of them or picks slightly different labels). ──
    const inputs = await formInputs(page);
    expect(inputs.length).toBeGreaterThanOrEqual(2);

    // ── Fill every input with a reasonable value. We don't know the
    //    LLM's exact field schema; we just need every required field
    //    populated so the submit button enables. Text fields get a
    //    short string, number fields get a number, date fields get a
    //    YYYY-MM-DD. ──
    for (const input of inputs) {
      const type = (await input.getAttribute('type')) ?? 'text';
      if (type === 'number') {
        await input.fill('5');
      } else if (type === 'date') {
        await input.fill('2026-06-15');
      } else {
        await input.fill('Oak Room');
      }
    }

    // ── Submit ──
    // The HITLFormCard's submit button label is LLM-chosen (the model
    // picks something thematic like "Book Room" / "Save" / "Continue"
    // based on the user's prompt). Match by [type="submit"] inside the
    // form, which is invariant regardless of label.
    await page.locator('form button[type="submit"]').click();

    // ── Form disappears (resume kicks in) ──
    await expect(formHeader).toHaveCount(0, { timeout: 15_000 });

    // ── A follow-up assistant bubble streams in confirming the values.
    //    Assert SHAPE: the bubble mentions at least one of the values
    //    we just typed. ──
    const lastAssistant = page.locator('[data-role="assistant"]').last();
    await expect(lastAssistant).toBeVisible({ timeout: 30_000 });
    await expect(
      page.getByRole('button', { name: /stop generating/i }),
    ).toHaveCount(0, { timeout: 60_000 });
    const replyText = (await lastAssistant.textContent()) ?? '';
    expect(replyText.length).toBeGreaterThan(5);
    // Any one of the values we entered must echo back.
    expect(replyText).toMatch(/Oak Room|2026-06-15|June 15|5\b/i);
  });
});
