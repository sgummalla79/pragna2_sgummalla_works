import { defineConfig, devices } from '@playwright/test';

/**
 * Browser tests for the pragna2 FE. Assumes the stack is already up
 * (`npm run setup` first) — Playwright doesn't manage the BE / FE /
 * Postgres processes, just drives the browser.
 */
export default defineConfig({
  testDir: './tests',
  fullyParallel: false, // one shared backing DB; tests serialize for now
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: process.env.E2E_FE_URL ?? 'http://localhost:5173',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    actionTimeout: 10_000,
    navigationTimeout: 15_000,
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
