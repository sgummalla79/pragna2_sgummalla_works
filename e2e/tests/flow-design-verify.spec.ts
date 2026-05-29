/** One-off verify spec for the flow editor redesign (future-discussions #33).
 *  Drives the FE through the new full-page editor at /flows/new, exercises
 *  the palette (Agent / If/Else / End), captures screenshots, and asserts
 *  the per-node handle layout + the legacy-route redirect. */

import { test, expect } from '@playwright/test';
import { login } from '../helpers/auth';

test('flow-design redesign — palette + N+1 ports + redirect', async ({ page }) => {
  await login(page);

  // ── New top-level editor route ────────────────────────────────────
  await page.goto('/flows/new');
  await expect(page).toHaveURL(/\/flows\/new$/);

  // Title + Draft chip + back-arrow visible (chrome).
  await expect(page.getByText('New flow')).toBeVisible();
  await expect(page.getByText('Draft', { exact: true })).toBeVisible();

  // Palette: three entries. Scope to the palette nav so "Agent" / "End"
  // labels here don't ambiguate with the equivalently-labelled nodes
  // that may already be on the canvas (Start/End boundaries, dropped
  // agents).
  const palette = page.getByRole('navigation', { name: /add node/i });
  const paletteAgent = palette.getByRole('button', { name: /^Agent$/ });
  const paletteIfElse = palette.getByRole('button', { name: /^If\/Else$/ });
  const paletteEnd = palette.getByRole('button', { name: /^End$/ });
  await expect(paletteAgent).toBeVisible();
  await expect(paletteIfElse).toBeVisible();
  await expect(paletteEnd).toBeVisible();

  // Empty canvas (seeded Start + End boundaries).
  await page.screenshot({ path: 'test-results/flow-design-01-empty.png', fullPage: true });

  // ── Drop one of each kind ────────────────────────────────────────
  await paletteAgent.click();
  await paletteIfElse.click();
  await paletteEnd.click();
  // Give React Flow a tick to render the new nodes.
  await page.waitForTimeout(300);
  await page.screenshot({ path: 'test-results/flow-design-02-populated.png', fullPage: true });

  // ── Per-node handle assertions ───────────────────────────────────
  // Start (singleton): exactly one source handle id='out'.
  const startHandles = await page.locator(
    '[data-id="__start__"] .react-flow__handle',
  ).count();
  expect(startHandles).toBe(1);
  await expect(
    page.locator('[data-id="__start__"] [data-handleid="out"]'),
  ).toBeVisible();

  // End instances: each has exactly one target handle id='in'.
  // Restrict to `.react-flow__node` so handle elements (which share the
  // `data-id="__end__-…"` prefix) don't bleed into the list.
  const endIds = await page
    .locator('.react-flow__node[data-id^="__end__"]')
    .evaluateAll((els) => els.map((e) => e.getAttribute('data-id')));
  // Expect both the original __end__ and the appended __end__::2.
  expect(endIds.sort()).toEqual(['__end__', '__end__::2']);
  for (const eid of endIds) {
    const handleCount = await page.locator(
      `[data-id="${eid}"] .react-flow__handle`,
    ).count();
    expect(handleCount).toBe(1);
    await expect(
      page.locator(`[data-id="${eid}"] [data-handleid="in"]`),
    ).toBeVisible();
  }

  // Agent (chat, emits empty): 4 omni handles top/right/bottom/left.
  // The newly-added agent gets node_id `node_1`.
  const agentHandles = await page.locator(
    '[data-id="node_1"] .react-flow__handle',
  ).count();
  expect(agentHandles).toBe(4);
  for (const hid of ['top', 'right', 'bottom', 'left']) {
    await expect(
      page.locator(`[data-id="node_1"] [data-handleid="${hid}"]`),
    ).toBeAttached();
  }

  // If/Else: 1 left target + N+1 right sources (port:passed, port:failed,
  // port:else). It's the second agent node, so node_id = node_2.
  const ifElseHandles = await page.locator(
    '[data-id="node_2"] .react-flow__handle',
  ).count();
  expect(ifElseHandles).toBe(4); // 1 in + 3 out (passed/failed/else)
  await expect(
    page.locator('[data-id="node_2"] [data-handleid="in"]'),
  ).toBeAttached();
  await expect(
    page.locator('[data-id="node_2"] [data-handleid="port:passed"]'),
  ).toBeAttached();
  await expect(
    page.locator('[data-id="node_2"] [data-handleid="port:failed"]'),
  ).toBeAttached();
  await expect(
    page.locator('[data-id="node_2"] [data-handleid="port:else"]'),
  ).toBeAttached();

  // ── Card content: minimal (icon + type label + display name) ──────
  // The If/Else card displays its type label "If/Else" plus its display
  // name. NOTE: blankIfElseAgent presets displayName='If/Else', so both
  // lines on the card show "If/Else" — a duplicated label. Worth a UX
  // tweak (default the displayName to '' so the bottom line is empty
  // until the author names it). For now we just assert the type label
  // is present via .first().
  await expect(
    page.locator('[data-id="node_2"]').getByText('If/Else').first(),
  ).toBeVisible();
  // The chat agent's card: type label "Agent" + node_id (displayName is
  // empty by default → falls back to apiName which equals node_id).
  await expect(
    page.locator('[data-id="node_1"]').getByText('Agent', { exact: true }),
  ).toBeVisible();
  await expect(
    page.locator('[data-id="node_1"]').getByText('node_1'),
  ).toBeVisible();

  // Old midpoint dropdown <select> should NOT exist anywhere in the
  // canvas — we deleted it in ConditionEdge.tsx.
  expect(
    await page.locator('.react-flow__edges select').count(),
  ).toBe(0);

  // ── Horizontal default layout: Start ≈ left, End ≈ right ─────────
  const startBox = await page
    .locator('[data-id="__start__"]')
    .boundingBox();
  const endBox = await page
    .locator('[data-id="__end__"]')
    .boundingBox();
  expect(startBox).toBeTruthy();
  expect(endBox).toBeTruthy();
  expect(endBox!.x).toBeGreaterThan(startBox!.x + 300);

  // ── Legacy redirect: /settings/flows/:flowId/edit → /flows/:flowId/edit ──
  // The :flowId param is preserved by RedirectFlowEditor.
  await page.goto('/settings/flows/abc-123/edit');
  await page.waitForURL(/\/flows\/abc-123\/edit$/, { timeout: 5_000 });
});
