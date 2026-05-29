/** Probe: what happens when the user drags the Start node downward?
 *  We capture the Start position before/after, the End position (should
 *  not move), screenshot the result, and check whether any state
 *  (dirty flag, edge attachments) changes unexpectedly. */

import { test, expect } from '@playwright/test';
import { login } from '../helpers/auth';

test('drag Start node downward', async ({ page }) => {
  await login(page);
  await page.goto('/flows/new');
  await expect(page.getByText('New flow')).toBeVisible();

  // Drop an Agent so we have an edge in the graph to observe too.
  const palette = page.getByRole('navigation', { name: /add node/i });
  await palette.getByRole('button', { name: /^Agent$/ }).click();
  await page.waitForTimeout(200);

  const startBefore = await page.locator('[data-id="__start__"]').boundingBox();
  const endBefore = await page.locator('[data-id="__end__"]').boundingBox();
  expect(startBefore).toBeTruthy();
  expect(endBefore).toBeTruthy();
  console.log('Start before:', startBefore);
  console.log('End before:', endBefore);

  await page.screenshot({ path: 'test-results/drag-start-01-before.png', fullPage: true });

  // ── Drag Start down by ~300px ────────────────────────────────────
  const startEl = page.locator('[data-id="__start__"]');
  const box = await startEl.boundingBox();
  if (!box) throw new Error('Start node has no bounding box');
  // Grab the centre of the Start node and drag down 300px. React Flow
  // uses pointer events under Loose mode; raw mouse.down/move/up is the
  // reliable path (the `dragTo` helper is fine too but we want precise
  // delta control). One intermediate move with `steps` helps React Flow
  // register the drag as continuous rather than a jump.
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  await page.mouse.move(cx, cy);
  await page.mouse.down();
  await page.mouse.move(cx, cy + 150, { steps: 6 });
  await page.mouse.move(cx, cy + 300, { steps: 6 });
  await page.mouse.up();
  await page.waitForTimeout(300);

  const startAfter = await page.locator('[data-id="__start__"]').boundingBox();
  const endAfter = await page.locator('[data-id="__end__"]').boundingBox();
  console.log('Start after:', startAfter);
  console.log('End after:', endAfter);

  await page.screenshot({ path: 'test-results/drag-start-02-after.png', fullPage: true });

  // ── Observations as assertions ───────────────────────────────────
  // 1. Start moved downward by roughly 300px (allow tolerance for
  //    React Flow's grid snap + the drag's pixel precision).
  expect(startAfter!.y - startBefore!.y).toBeGreaterThan(250);
  expect(startAfter!.y - startBefore!.y).toBeLessThan(350);

  // 2. End stayed roughly put (drag is not a graph-wide layout
  //    change). A small residual is OK — React Flow may still be
  //    settling its initial-mount fitView at the moment the drag
  //    starts; the dragged node's delta (~300px) is what matters.
  expect(Math.abs(endAfter!.x - endBefore!.x)).toBeLessThan(40);
  expect(Math.abs(endAfter!.y - endBefore!.y)).toBeLessThan(40);

  // 3. Save button is now enabled (dirty fires on drag-end per the
  //    position-change reducer in useFlowEditorStore).
  await expect(page.getByRole('button', { name: /^save$/i })).toBeEnabled();

  // 4. Start handle id is still 'out' (didn't get rewritten / lost).
  await expect(
    page.locator('[data-id="__start__"] [data-handleid="out"]'),
  ).toBeVisible();
});
