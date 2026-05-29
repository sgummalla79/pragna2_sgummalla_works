/** Movable palette: drag the header by 200px right + 150px down,
 *  confirm the palette reposition; then click an Agent entry to
 *  prove the buttons are still clickable post-move. */

import { test, expect } from '@playwright/test';
import { login } from '../helpers/auth';

test('palette can be dragged to a new position via the header', async ({ page }) => {
  test.setTimeout(60_000);

  await login(page);
  await page.goto('/flows/new');
  await expect(page.getByText('New flow')).toBeVisible();

  const palette = page.getByRole('navigation', { name: /add node/i });
  const before = await palette.boundingBox();
  expect(before).toBeTruthy();

  // Grab the header strip (the "Nodes" label area — it carries the
  // drag handle's pointerdown). title="Drag to move the palette".
  const handle = page.getByTitle('Drag to move the palette');
  const handleBox = await handle.boundingBox();
  expect(handleBox).toBeTruthy();
  const cx = handleBox!.x + handleBox!.width / 2;
  const cy = handleBox!.y + handleBox!.height / 2;

  await page.mouse.move(cx, cy);
  await page.mouse.down();
  await page.mouse.move(cx + 100, cy + 75, { steps: 6 });
  await page.mouse.move(cx + 200, cy + 150, { steps: 6 });
  await page.mouse.up();
  await page.waitForTimeout(150);

  const after = await palette.boundingBox();
  console.log('Palette before:', before);
  console.log('Palette after:', after);

  // Palette moved by ~the drag delta (allow tolerance for the handle's
  // offset within the palette and any clamping at the parent edge).
  expect(after!.x - before!.x).toBeGreaterThan(150);
  expect(after!.x - before!.x).toBeLessThan(250);
  expect(after!.y - before!.y).toBeGreaterThan(100);
  expect(after!.y - before!.y).toBeLessThan(200);

  // Buttons still clickable after the move — drop an Agent.
  await palette.getByRole('button', { name: /^Agent$/ }).click();
  await page.waitForTimeout(200);
  await expect(page.locator('[data-id="node_1"]')).toBeVisible();
});
