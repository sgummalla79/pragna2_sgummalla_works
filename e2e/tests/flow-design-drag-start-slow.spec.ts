/** Slow-drag probe: move Start downward in small increments and
 *  capture cursor-delta vs node-delta at each step. If node-delta
 *  exceeds cursor-delta, React Flow's screen→canvas transform is
 *  amplifying motion (likely a CSS transform on a parent throwing
 *  off the viewport math). */

import { test, expect } from '@playwright/test';
import { login } from '../helpers/auth';

test('drag Start node slowly downward, watch for amplification', async ({ page }) => {
  test.setTimeout(120_000);

  await login(page);
  await page.goto('/flows/new');
  await expect(page.getByText('New flow')).toBeVisible();

  // Read React Flow viewport transform + zoom for context.
  const viewport = await page.locator('.react-flow__viewport').boundingBox();
  const transform = await page
    .locator('.react-flow__viewport')
    .evaluate((el) => getComputedStyle(el).transform);
  const pageZoom = await page.evaluate(() => window.devicePixelRatio);
  console.log('Viewport box:', viewport);
  console.log('Viewport CSS transform:', transform);
  console.log('devicePixelRatio:', pageZoom);

  // Also dump any CSS transform on ancestors of the React Flow root.
  const ancestorTransforms = await page.evaluate(() => {
    const el = document.querySelector('.react-flow');
    if (!el) return [];
    const chain: { tag: string; cls: string; transform: string }[] = [];
    let cur: HTMLElement | null = el as HTMLElement;
    while (cur && cur.tagName !== 'HTML') {
      const t = getComputedStyle(cur).transform;
      if (t && t !== 'none') {
        chain.push({ tag: cur.tagName, cls: cur.className.toString().slice(0, 80), transform: t });
      }
      cur = cur.parentElement;
    }
    return chain;
  });
  console.log('Ancestor transforms (non-none):', ancestorTransforms);

  const startBefore = await page.locator('[data-id="__start__"]').boundingBox();
  if (!startBefore) throw new Error('Start has no bbox');
  console.log('Start before:', startBefore);

  await page.screenshot({ path: 'test-results/slow-drag-00-before.png', fullPage: true });

  const cx = startBefore.x + startBefore.width / 2;
  const cy = startBefore.y + startBefore.height / 2;

  // Move cursor onto Start centre, press, then nudge down 20px five
  // times. Capture node bbox after each nudge so we can compare
  // cursor-delta (20px each step) against node-delta.
  await page.mouse.move(cx, cy);
  await page.mouse.down();

  const samples: { step: number; cursorDy: number; nodeY: number; nodeDy: number }[] = [];
  let prevNodeY = startBefore.y;
  for (let i = 1; i <= 10; i++) {
    const newCy = cy + i * 30;
    await page.mouse.move(cx, newCy, { steps: 6 });
    await page.waitForTimeout(50);
    const box = await page.locator('[data-id="__start__"]').boundingBox();
    if (!box) {
      console.log(`Step ${i}: Start vanished from DOM`);
      break;
    }
    samples.push({
      step: i,
      cursorDy: i * 30,
      nodeY: box.y,
      nodeDy: box.y - prevNodeY,
    });
    prevNodeY = box.y;
    await page.screenshot({ path: `test-results/slow-drag-${String(i).padStart(2, '0')}.png` });
  }

  await page.mouse.up();
  await page.waitForTimeout(200);

  console.log('Samples (cursorDy is cumulative, nodeDy is per-step):');
  for (const s of samples) {
    console.log(
      `  step ${s.step}: cursorDy=${s.cursorDy}, nodeY=${s.nodeY.toFixed(1)}, nodeDy=${s.nodeDy.toFixed(1)}`,
    );
  }

  const afterBox = await page.locator('[data-id="__start__"]').boundingBox();
  console.log('Start after release:', afterBox);
  await page.screenshot({ path: 'test-results/slow-drag-99-after.png', fullPage: true });

  // No assertions — this is observational. The console output is the report.
});
