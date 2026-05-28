/**
 * Canvas-driving tricks for React Flow under Playwright. These wrap two
 * non-obvious workarounds discovered while building the flow-editor
 * suite:
 *
 *  1. Side handles are `opacity-0` until hover, which makes Playwright's
 *     `.hover()` actionability check time out. Work around it by moving
 *     the mouse raw (`page.mouse.move`) and grabbing the handle's
 *     boundingBox while the parent is hovered.
 *
 *  2. The editor cascades new nodes at the same x with a small Y offset,
 *     so two stacked nodes have a z-index race — `.click()` (even with
 *     `force: true`) loses to React Flow's own pointer hit-test which
 *     picks the topmost node. Use `dispatchEvent('click')` to fire the
 *     synthetic event directly on the target element; React Flow's
 *     `onNodeClick` reads `event.target` and the right node wins.
 */
import type { Page } from '@playwright/test';

export type HandleSide = 'top' | 'right' | 'bottom' | 'left';

/** Reveal a node's handles (hover-trigger) and return one handle's box. */
export async function revealAndGetHandle(
  page: Page,
  nodeId: string,
  side: HandleSide,
) {
  const nodeBox = await page.locator(`.react-flow__node[data-id="${nodeId}"]`).boundingBox();
  if (!nodeBox) throw new Error(`node ${nodeId} not found on canvas`);
  await page.mouse.move(nodeBox.x + nodeBox.width / 2, nodeBox.y + nodeBox.height / 2);
  await page.waitForTimeout(250); // wait for opacity-0 → 100 transition
  const handleBox = await page
    .locator(`.react-flow__node[data-id="${nodeId}"] .react-flow__handle[data-handleid="${side}"]`)
    .boundingBox();
  if (!handleBox) throw new Error(`handle ${side} on ${nodeId} not found`);
  return handleBox;
}

/** Draw a connector from one node's side handle to another's. */
export async function dragSide(
  page: Page,
  src: { nodeId: string; side: HandleSide },
  dst: { nodeId: string; side: HandleSide },
): Promise<void> {
  const s = await revealAndGetHandle(page, src.nodeId, src.side);
  const d = await revealAndGetHandle(page, dst.nodeId, dst.side);
  await page.mouse.move(s.x + s.width / 2, s.y + s.height / 2);
  await page.mouse.down();
  // intermediate move so React Flow's connection line picks up the drag
  await page.mouse.move(s.x + s.width / 2 + 20, s.y + s.height / 2 + 20, { steps: 4 });
  await page.mouse.move(d.x + d.width / 2, d.y + d.height / 2, { steps: 20 });
  await page.mouse.up();
  await page.waitForTimeout(300);
}

/** Select a specific node + open its side panel (z-index-safe). */
export async function openPanelFor(page: Page, nodeId: string): Promise<void> {
  await page.locator(`.react-flow__node[data-id="${nodeId}"]`).dispatchEvent('click');
  await page.waitForTimeout(200);
  const opened = await page.locator('#np-node-id').inputValue();
  if (opened !== nodeId) {
    throw new Error(`openPanelFor(${nodeId}) opened panel for "${opened}"`);
  }
}
