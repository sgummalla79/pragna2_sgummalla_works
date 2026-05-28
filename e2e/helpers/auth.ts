/** Login via the FE form — assumes the auth-strategy patch is applied
 *  + the BE is on AUTH_STRATEGY=local + the test user exists.
 *  See README.md for setup. */
import type { Page } from '@playwright/test';

import { TEST_USER } from './env';

export async function login(page: Page): Promise<void> {
  await page.goto('/login');
  // Use role/textbox to dodge the password-visibility button (also labelled "Password").
  await page.getByRole('textbox', { name: /email/i }).fill(TEST_USER.email);
  await page.getByRole('textbox', { name: /^password$/i }).fill(TEST_USER.password);
  await page.getByRole('button', { name: /log in|sign in/i }).click();
  await page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 10_000 });
}
