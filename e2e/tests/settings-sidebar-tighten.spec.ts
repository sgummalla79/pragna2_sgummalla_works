/** Visual probe for the settings sidebar tightening: confirm the nav
 *  link computed font-size went up, the SVG icons are bigger, and the
 *  visual gap between adjacent nav items shrank. */

import { test, expect } from '@playwright/test';
import { login } from '../helpers/auth';

test('settings sidebar: bigger text + icons, tighter line gap', async ({ page }) => {
  test.setTimeout(60_000);

  await login(page);
  await page.goto('/settings');
  await expect(page.getByRole('heading', { name: /providers/i }).first()).toBeVisible();

  // Two adjacent nav rows.
  const providers = page.getByRole('link', { name: /^Providers$/ });
  const mcp = page.getByRole('link', { name: /^MCP Servers$/ });

  const providersBox = await providers.boundingBox();
  const mcpBox = await mcp.boundingBox();
  expect(providersBox).toBeTruthy();
  expect(mcpBox).toBeTruthy();

  // Vertical gap between rows = top-of-next minus bottom-of-this.
  const visualGap = mcpBox!.y - (providersBox!.y + providersBox!.height);
  console.log('Providers box:', providersBox);
  console.log('MCP box:', mcpBox);
  console.log('Vertical gap between rows (px):', visualGap);

  // Font size + icon size.
  const fontSize = await providers.evaluate((el) => getComputedStyle(el).fontSize);
  const iconSize = await providers
    .locator('svg')
    .first()
    .evaluate((el) => ({
      width: (el as SVGElement).getAttribute('width'),
      height: (el as SVGElement).getAttribute('height'),
    }));
  console.log('Nav link font-size:', fontSize);
  console.log('Icon size attrs:', iconSize);

  // Assertions: font-size >=15px, icon 18×18, gap <4px (was ~4px from gap-1).
  expect(parseFloat(fontSize)).toBeGreaterThanOrEqual(15);
  expect(iconSize.width).toBe('18');
  expect(iconSize.height).toBe('18');
  expect(visualGap).toBeLessThan(4);

  await page.screenshot({ path: 'test-results/settings-sidebar-tighten.png', fullPage: false });
});
