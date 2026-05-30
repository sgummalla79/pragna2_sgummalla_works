/** Reproduce user's report: drag Start down until it cuts off,
 *  then check whether (a) it's recoverable via Fit View, (b) it's
 *  recoverable via zoom-out alone, (c) it's hidden forever. */

import { test, expect } from '@playwright/test';
import { login } from '../helpers/auth';

test('drag Start far past viewport bottom, then attempt recovery', async ({ page }) => {
  test.setTimeout(120_000);

  await login(page);
  await page.goto('/flows/new');
  await page.waitForSelector('nav[aria-label="Add node"]');

  // Page + canvas dimensions.
  const pageBox = await page.evaluate(() => ({
    w: window.innerWidth,
    h: window.innerHeight,
  }));
  const canvasBox = await page.locator('.react-flow').boundingBox();
  console.log('Page:', pageBox, 'Canvas:', canvasBox);

  const startBefore = await page.locator('[data-id="__start__"]').boundingBox();
  console.log('Start before:', startBefore);
  await page.screenshot({ path: 'test-results/offscreen-00-before.png', fullPage: true });

  // Drag Start way past the bottom — simulate a user who flicks it.
  const cx = startBefore!.x + startBefore!.width / 2;
  const cy = startBefore!.y + startBefore!.height / 2;
  await page.mouse.move(cx, cy);
  await page.mouse.down();
  // Take it way down: 1000px past viewport bottom. React Flow's
  // pane-extent (translateExtent) is unlimited by default so the
  // node travels with the cursor until release.
  await page.mouse.move(cx, cy + 500, { steps: 5 });
  await page.mouse.move(cx, cy + 1500, { steps: 5 });
  await page.mouse.move(cx, cy + 3000, { steps: 5 });
  await page.mouse.up();
  await page.waitForTimeout(300);

  // Is Start still in DOM?
  const startStill = await page.locator('[data-id="__start__"]').count();
  console.log('Start nodes in DOM after drag:', startStill);
  const startBox = await page.locator('[data-id="__start__"]').boundingBox();
  console.log('Start bbox after drag:', startBox);

  await page.screenshot({ path: 'test-results/offscreen-01-after-drag.png', fullPage: true });

  // Now try the React Flow Controls "Fit view" button.
  const fitViewBtn = page.locator('.react-flow__controls-fitview');
  const fitCount = await fitViewBtn.count();
  console.log('Fit-view button count:', fitCount);
  if (fitCount > 0) {
    await fitViewBtn.click();
    await page.waitForTimeout(300);
    const startBoxAfterFit = await page.locator('[data-id="__start__"]').boundingBox();
    console.log('Start bbox after Fit-view click:', startBoxAfterFit);
    await page.screenshot({ path: 'test-results/offscreen-02-after-fit-view.png', fullPage: true });
  }

  // Now try zoom-out alone (multiple clicks). Resets the store via Fit
  // first to undo the previous step, then drag again to repro, then
  // only zoom-out.
});
