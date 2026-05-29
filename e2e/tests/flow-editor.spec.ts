/**
 * End-to-end tests for the visual flow editor — items 1–10 from the
 * original verify plan, adapted to the post-#33 visual model (top-level
 * `/flows/new` route, left-side palette instead of "Add node" button,
 * minimal cards with icon + type label + display name).
 *
 * Requires the stack to be running (`npm run setup` first).
 */
import { expect, test, type Page } from '@playwright/test';

import { login } from '../helpers/auth';
import { dragSide, openPanelFor, revealAndGetHandle } from '../helpers/canvas';
import { db, psql } from '../helpers/db';

test.describe.configure({ mode: 'serial' }); // shared DB → run in order

/** Drop an Agent / If/Else / End node from the palette. */
async function dropFromPalette(page: Page, label: 'Agent' | 'If/Else' | 'End') {
  const palette = page.getByRole('navigation', { name: /add node/i });
  await palette.getByRole('button', { name: new RegExp(`^${label}$`) }).click();
  await page.waitForTimeout(150);
}

test.describe('Visual flow editor', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    await page.goto('/flows/new', { waitUntil: 'networkidle' });
    // Wait for the palette to render — anchors the rest of the test on a
    // fully-mounted editor (the palette is the first interactive surface
    // post-redesign).
    await page.waitForSelector('nav[aria-label="Add node"]');
  });

  test('#1 mounts with Start + End boundary nodes and the palette', async ({ page }) => {
    // Cards now display the plain "Start" / "End" labels (no ▶ / ■
    // prefix glyph anymore — the icon-tile carries the role visually).
    await expect(
      page.locator('.react-flow__node[data-id="__start__"]').getByText(/^Start$/),
    ).toBeVisible();
    await expect(
      page.locator('.react-flow__node[data-id="__end__"]').getByText(/^End$/),
    ).toBeVisible();
    // Palette has the three entries.
    const palette = page.getByRole('navigation', { name: /add node/i });
    await expect(palette.getByRole('button', { name: /^Agent$/ })).toBeVisible();
    await expect(palette.getByRole('button', { name: /^If\/Else$/ })).toBeVisible();
    await expect(palette.getByRole('button', { name: /^End$/ })).toBeVisible();
    // Header still has the YAML / Validate / Save buttons.
    await expect(page.getByRole('button', { name: /view yaml source/i })).toBeVisible();
  });

  test('#2 four omni handles on an Agent are hidden until node hover', async ({ page }) => {
    // Pre-redesign this tested __start__, which now has only a single
    // right-side `out` handle (Start became a singleton boundary with
    // one handle). Switched to a chat-Agent which still has 4 omni
    // handles as before.
    await dropFromPalette(page, 'Agent');
    const handle = page.locator('.react-flow__node[data-id="node_1"] .react-flow__handle').first();
    expect(await handle.evaluate((el) => window.getComputedStyle(el).opacity)).toBe('0.3');
    await page.locator('.react-flow__node[data-id="node_1"]').hover();
    await page.waitForTimeout(250);
    expect(
      Number(await handle.evaluate((el) => window.getComputedStyle(el).opacity)),
    ).toBeGreaterThan(0.8);
    for (const side of ['top', 'right', 'bottom', 'left']) {
      await expect(
        page.locator(`.react-flow__node[data-id="node_1"] .react-flow__handle[data-handleid="${side}"]`),
      ).toHaveCount(1);
    }
  });

  test('#3 dropping Agent from palette creates a node and opens the side panel', async ({ page }) => {
    await dropFromPalette(page, 'Agent');
    await expect(page.locator('.react-flow__node[data-id="node_1"]')).toBeVisible();
    await expect(page.locator('#np-node-id')).toBeVisible();
    expect(await page.locator('#np-node-id').inputValue()).toBe('node_1');
  });

  test('#7 node_id collision shows inline error and reverts the draft', async ({ page }) => {
    await dropFromPalette(page, 'Agent');
    await page.getByRole('button', { name: /close panel/i }).click();
    await dropFromPalette(page, 'Agent');
    // Panel is on node_2; rename to node_1 → collision.
    await page.locator('#np-node-id').fill('node_1');
    await page.locator('#np-node-id').blur();
    await expect(page.getByRole('alert')).toContainText(/already uses/i);
    expect(await page.locator('#np-node-id').inputValue()).toBe('node_2');
  });

  test('#8 YAML "view source" dialog shows the collapse invariant', async ({ page }) => {
    await dropFromPalette(page, 'Agent');
    await page.getByRole('button', { name: /close panel/i }).click();
    await page.getByRole('button', { name: /view yaml source/i }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toContainText(/Flow YAML \(read-only\)/i);
    // Collapse invariant: agents[].api_name == node_id.
    const text = (await dialog.textContent()) ?? '';
    expect(text).toMatch(/api_name:\s*node_1/);
    expect(text).toMatch(/node_id:\s*node_1[\s\S]*agent:\s*node_1/);
  });

  test('#5a self-loop is rejected at draw time (no edge created)', async ({ page }) => {
    await dropFromPalette(page, 'Agent');
    await page.getByRole('button', { name: /close panel/i }).click();
    const bottom = await revealAndGetHandle(page, 'node_1', 'bottom');
    const top = await revealAndGetHandle(page, 'node_1', 'top');
    await page.mouse.move(bottom.x + bottom.width / 2, bottom.y + bottom.height / 2);
    await page.mouse.down();
    await page.mouse.move(top.x + top.width / 2, top.y + top.height / 2, { steps: 10 });
    await page.mouse.up();
    await page.waitForTimeout(300);
    await expect(page.locator('.react-flow__edge')).toHaveCount(0);
  });

  test('#4 + #5b + #9 + #10 — full authoring cycle through Save + prune', async ({ page }) => {
    // The pre-redesign version also covered #6 ("condition not in source
    // emits → red dashed warning"). That UI is gone — the edge-midpoint
    // dropdown was deleted in the #33 redesign; edge condition derives
    // from which port (`port:passed` / `port:else` / ...) the edge
    // leaves. The branching-specific assertion lives in Scenario 6 in
    // FRONTEND_TEST_SCENARIOS.md; this test stays focused on chat
    // agents (no emits) plus the save/prune DB invariants.

    await dropFromPalette(page, 'Agent');
    await page.getByRole('button', { name: /close panel/i }).click();
    await dropFromPalette(page, 'Agent');
    await page.getByRole('button', { name: /close panel/i }).click();

    // ── #4 side-handle drag (right → left) creates an edge ──
    await dragSide(page, { nodeId: 'node_1', side: 'right' }, { nodeId: 'node_2', side: 'left' });
    await expect(page.locator('.react-flow__edge')).toHaveCount(1);

    // ── #5b duplicate (source, target) is blocked even when handles
    // differ (chat agents dedupe on source-target — port-handle dedupe
    // only kicks in for branching nodes; covered elsewhere). ──
    await dragSide(page, { nodeId: 'node_1', side: 'bottom' }, { nodeId: 'node_2', side: 'top' });
    await expect(page.locator('.react-flow__edge')).toHaveCount(1);

    // ── Set top-meta fields (slash is on by default → slash-name is
    // required for save to succeed) ──
    await page.locator('#flow-api-name').fill('my-flow');
    await page.locator('#flow-display-name').fill('My Flow');
    await page.locator('#flow-slash').fill('my-flow');
    for (const id of ['node_1', 'node_2'] as const) {
      await openPanelFor(page, id);
      await page.locator('#np-agent-display').fill(`Agent ${id}`);
      await page.locator('#np-agent-prompt').fill(`You are agent ${id}.`);
      await page.locator('#np-agent-model').click();
      await page.getByRole('option', { name: /Claude Sonnet 4\.6/ }).click();
      await page.waitForTimeout(150);
    }
    await page.getByRole('button', { name: /close panel/i }).click();
    await page.locator('#flow-desc').fill('e2e-verified flow.');

    // ── #9 Save round-trip ──
    await page.getByRole('button', { name: /^save$/i }).click();
    await expect(page.getByRole('status')).toContainText(/Created|Saved/);

    // DB invariants: 1 flow, 2 flow-owned agents (collapse: api_name == node_id).
    expect(db.flowCount()).toBe(1);
    const agents = db.agentsForFlow('my-flow');
    expect(agents.map((r) => r[0]).sort()).toEqual(['node_1', 'node_2']);
    const nodes = db.flowNodes('my-flow');
    expect(nodes.map((r) => r[0]).sort()).toEqual(['node_1', 'node_2']);

    // ── #10 Prune on resave (delete node_2 + save) ──
    await openPanelFor(page, 'node_2');
    await page.getByRole('button', { name: /delete node/i }).click();
    await page.waitForTimeout(200);
    await page.getByRole('button', { name: /^save$/i }).click();
    await expect(page.getByRole('status')).toContainText(/Saved/);
    const agentsAfter = db.agentsForFlow('my-flow');
    expect(agentsAfter.map((r) => r[0])).toEqual(['node_1']);
    expect(psql("SELECT COUNT(*) FROM user_agents WHERE api_name='node_2'")).toBe('0');
  });
});
