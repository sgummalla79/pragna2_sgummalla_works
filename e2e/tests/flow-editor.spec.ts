/**
 * End-to-end tests for the visual flow editor — items 1–10 from the
 * original verify plan. The unit + integration suites cover the logic;
 * these are the pointer/visual + DB-round-trip cases jsdom can't reach.
 *
 * Requires the stack to be running (`npm run setup` first).
 */
import { expect, test } from '@playwright/test';

import { login } from '../helpers/auth';
import { dragSide, openPanelFor, revealAndGetHandle } from '../helpers/canvas';
import { db, psql } from '../helpers/db';

test.describe.configure({ mode: 'serial' }); // shared DB → run in order

test.describe('Visual flow editor', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    await page.goto('/settings/flows/new', { waitUntil: 'networkidle' });
    await page.waitForSelector('button:has-text("Add node")');
  });

  test('#1 mounts with Start + End boundary nodes', async ({ page }) => {
    await expect(page.getByText(/▶ Start/)).toBeVisible();
    await expect(page.getByText(/■ End/)).toBeVisible();
    await expect(page.getByRole('button', { name: /add node/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /view yaml source/i })).toBeVisible();
  });

  test('#2 four side handles are hidden until node hover', async ({ page }) => {
    const handle = page.locator('.react-flow__node[data-id="__start__"] .react-flow__handle').first();
    expect(await handle.evaluate((el) => window.getComputedStyle(el).opacity)).toBe('0');
    await page.locator('.react-flow__node[data-id="__start__"]').hover();
    await page.waitForTimeout(250);
    expect(
      Number(await handle.evaluate((el) => window.getComputedStyle(el).opacity)),
    ).toBeGreaterThan(0.5);
    // All four sides exist.
    for (const side of ['top', 'right', 'bottom', 'left']) {
      await expect(
        page.locator(`.react-flow__node[data-id="__start__"] .react-flow__handle[data-handleid="${side}"]`),
      ).toHaveCount(1);
    }
  });

  test('#3 Add node creates an agent card AND opens the side panel', async ({ page }) => {
    await page.getByRole('button', { name: /add node/i }).click();
    await expect(page.locator('.react-flow__node[data-id="node_1"]')).toBeVisible();
    await expect(page.locator('#np-node-id')).toBeVisible();
    expect(await page.locator('#np-node-id').inputValue()).toBe('node_1');
  });

  test('#7 node_id collision shows inline error and reverts the draft', async ({ page }) => {
    // Add two nodes so we have a collision target.
    await page.getByRole('button', { name: /add node/i }).click();
    await page.getByRole('button', { name: /close panel/i }).click();
    await page.getByRole('button', { name: /add node/i }).click();
    // Panel is on node_2; rename to node_1 → collision.
    await page.locator('#np-node-id').fill('node_1');
    await page.locator('#np-node-id').blur();
    await expect(page.getByRole('alert')).toContainText(/already uses/i);
    expect(await page.locator('#np-node-id').inputValue()).toBe('node_2');
  });

  test('#8 YAML "view source" dialog shows the collapse invariant', async ({ page }) => {
    // Need at least one agent node so agents: + flow.nodes: have entries.
    await page.getByRole('button', { name: /add node/i }).click();
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
    await page.getByRole('button', { name: /add node/i }).click();
    await page.getByRole('button', { name: /close panel/i }).click();
    // Drag from node_1 bottom back to node_1 top.
    const bottom = await revealAndGetHandle(page, 'node_1', 'bottom');
    const top = await revealAndGetHandle(page, 'node_1', 'top');
    await page.mouse.move(bottom.x + bottom.width / 2, bottom.y + bottom.height / 2);
    await page.mouse.down();
    await page.mouse.move(top.x + top.width / 2, top.y + top.height / 2, { steps: 10 });
    await page.mouse.up();
    await page.waitForTimeout(300);
    await expect(page.locator('.react-flow__edge')).toHaveCount(0);
  });

  test('#4 + #5b + #6 + #9 + #10 — full authoring cycle through Save + prune', async ({ page }) => {
    // ── Two agent nodes ──
    await page.getByRole('button', { name: /add node/i }).click();
    await page.getByRole('button', { name: /close panel/i }).click();
    await page.getByRole('button', { name: /add node/i }).click();
    await page.getByRole('button', { name: /close panel/i }).click();

    // ── #4 side-handle drag (right → left) ──
    await dragSide(page, { nodeId: 'node_1', side: 'right' }, { nodeId: 'node_2', side: 'left' });
    await expect(page.locator('.react-flow__edge')).toHaveCount(1);

    // ── #5b duplicate source→target is blocked ──
    await dragSide(page, { nodeId: 'node_1', side: 'bottom' }, { nodeId: 'node_2', side: 'top' });
    await expect(page.locator('.react-flow__edge')).toHaveCount(1);

    // ── #6 condition not in source emits → red dashed warning ──
    await page.locator('select[aria-label="Edge condition"]').first().selectOption('passed');
    await page.waitForTimeout(200);
    const edgeStyle = await page.locator('.react-flow__edge .react-flow__edge-path').first().getAttribute('style');
    expect(edgeStyle).toMatch(/destructive/);
    expect(edgeStyle).toMatch(/dasharray/);

    // ── Set model + display name + system prompt on each node ──
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
    // We're still on the editor (URL switched to /edit/{flowId} on create).
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
