/**
 * High-level visual-editor authoring helpers shared across scenario
 * specs. Each scenario builds a different topology; these primitives
 * (drop from palette, configure an Agent, drag a handle, wait for the
 * save banner) keep the scenario bodies focused on what's distinctive
 * about each topology and tolerant of the inner mechanics.
 */
import { expect, type Page } from '@playwright/test';

/** Drop an Agent / Decision / End from the palette. */
export async function dropFromPalette(
  page: Page,
  label: 'Agent' | 'Decision' | 'End',
): Promise<void> {
  const palette = page.getByRole('navigation', { name: /add node/i });
  await palette.getByRole('button', { name: new RegExp(`^${label}$`) }).click();
  await page.waitForTimeout(150);
}

/** Reveal a node's handles via hover and return one handle's bounding box. */
export async function handleBox(
  page: Page,
  nodeId: string,
  handleId: string,
): Promise<{ x: number; y: number; width: number; height: number }> {
  const nodeSel = `.react-flow__node[data-id="${nodeId}"]`;
  const nodeBox = await page.locator(nodeSel).boundingBox();
  if (!nodeBox) throw new Error(`node ${nodeId} not found on canvas`);
  await page.mouse.move(nodeBox.x + nodeBox.width / 2, nodeBox.y + nodeBox.height / 2);
  await page.waitForTimeout(250);
  const box = await page
    .locator(`${nodeSel} .react-flow__handle[data-handleid="${handleId}"]`)
    .boundingBox();
  if (!box) throw new Error(`handle ${handleId} on ${nodeId} not found`);
  return box;
}

/** Draw a connector between two specific handles (handle-id-aware,
 *  supports omni sides like 'top'/'left' as well as port handles like
 *  'out', 'in', 'port:passed', 'port:else'). */
export async function dragHandle(
  page: Page,
  from: { nodeId: string; handleId: string },
  to: { nodeId: string; handleId: string },
): Promise<void> {
  const a = await handleBox(page, from.nodeId, from.handleId);
  const b = await handleBox(page, to.nodeId, to.handleId);
  await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2);
  await page.mouse.down();
  // Intermediate move so React Flow registers the drag as continuous.
  await page.mouse.move(a.x + a.width / 2 + 20, a.y + a.height / 2 + 20, { steps: 4 });
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 20 });
  await page.mouse.up();
  await page.waitForTimeout(300);
}

/** Add an edge via the editor store directly — bypasses React Flow's
 *  drag mechanics, which are fragile on a crowded canvas (cascade
 *  overlap + fitView's auto-scaling map screen pixels to canvas coords
 *  in non-obvious ways). Equivalent to a user successfully drawing
 *  the connector with their mouse: hits the store's `onConnect` action
 *  which runs through the same validation + dedupe rules.
 *
 *  Requires the FE to be in dev mode (Vite injects
 *  `window.__flowEditorStore`). */
export async function connectViaStore(
  page: Page,
  from: { nodeId: string; handleId: string },
  to: { nodeId: string; handleId: string },
): Promise<void> {
  await page.evaluate(
    ({ from, to }) => {
      const store = (window as unknown as {
        __flowEditorStore?: {
          getState: () => { onConnect: (c: unknown) => void };
        };
      }).__flowEditorStore;
      if (!store) {
        throw new Error(
          'window.__flowEditorStore not exposed — run in dev mode',
        );
      }
      store.getState().onConnect({
        source: from.nodeId,
        sourceHandle: from.handleId,
        target: to.nodeId,
        targetHandle: to.handleId,
      });
    },
    { from, to },
  );
  await page.waitForTimeout(100);
}

/** Drag a node from its current canvas position to a new absolute
 *  pixel position. Useful before wiring edges on a crowded canvas —
 *  the palette cascade stacks nodes vertically and a 4+-agent flow
 *  can leave handles overlapping.
 *
 *  Implementation note: we use Playwright's `dragTo` against the inner
 *  `.group` element so React Flow's node-drag handler receives a
 *  pointerdown on the card body (not the React Flow wrapper, which
 *  has handle dots positioned absolutely on its edges and can
 *  intercept the down event). */
export async function repositionNode(
  page: Page,
  nodeId: string,
  target: { x: number; y: number },
): Promise<void> {
  const card = page.locator(`.react-flow__node[data-id="${nodeId}"] > .group`).first();
  await card.scrollIntoViewIfNeeded();
  // Use raw mouse events but grab the CARD CENTRE (away from handles).
  const box = await card.boundingBox();
  if (!box) throw new Error(`node ${nodeId} card not found for reposition`);
  const grabX = box.x + box.width / 2;
  const grabY = box.y + box.height / 2;
  await page.mouse.move(grabX, grabY);
  await page.mouse.down();
  await page.mouse.move(grabX + 6, grabY + 6, { steps: 3 });
  await page.mouse.move(target.x, target.y, { steps: 20 });
  await page.mouse.up();
  await page.waitForTimeout(200);
}

/** Click a node to open its NodePanel (z-index-safe). */
export async function openPanel(page: Page, nodeId: string): Promise<void> {
  await page.locator(`.react-flow__node[data-id="${nodeId}"]`).dispatchEvent('click');
  await page.waitForTimeout(200);
  const opened = await page.locator('#np-node-id').inputValue();
  if (opened !== nodeId) {
    throw new Error(`openPanel(${nodeId}) opened panel for "${opened}"`);
  }
}

/** Replace the `emits` chip set on the open NodePanel to exactly the
 *  provided list. Clears every existing chip first (handy for If/Else
 *  nodes which drop with `[passed, failed]` pre-filled), then enters
 *  the new chips via fill + Enter. Caller is responsible for the panel
 *  being open on the target node. */
export async function setEmits(page: Page, emits: string[]): Promise<void> {
  // Clear every existing chip by clicking its `Remove emit label …`
  // button. Iterate until none remain (chip indices shift as we
  // remove, so we re-query each time).
  while (true) {
    const removeBtn = page.getByRole('button', { name: /^Remove emit label / });
    if ((await removeBtn.count()) === 0) break;
    await removeBtn.first().click();
  }
  // Add the new emits in order.
  for (const emit of emits) {
    await page.locator('#np-agent-emits').fill(emit);
    await page.locator('#np-agent-emits').press('Enter');
  }
}

/** Fill the NodePanel's standard chat-agent fields. The node id (=
 *  agent.api_name) is renamed first; the panel is assumed to be open
 *  on the just-dropped node. If `inputs` / `outputs` are given, the
 *  Context slots (#26) section is expanded and the chips entered so
 *  the node uses slot-based context (fixes the Anthropic
 *  assistant-prefill error on sequential pipelines). If `emits` is
 *  given, the emit chip set is replaced wholesale (useful for If/Else
 *  nodes whose [passed, failed] default doesn't match the scenario).
 *  Panel is closed on exit. */
export async function configureChatAgent(
  page: Page,
  opts: {
    nodeId: string;
    display: string;
    prompt: string;
    modelLabel?: RegExp;
    inputs?: string[];
    outputs?: string[];
    emits?: string[];
  },
): Promise<void> {
  const modelLabel = opts.modelLabel ?? /Claude Sonnet 4\.6/;
  await page.locator('#np-node-id').fill(opts.nodeId);
  await page.locator('#np-node-id').blur();
  await page.locator('#np-agent-display').fill(opts.display);
  await page.locator('#np-agent-prompt').fill(opts.prompt);
  await page.locator('#np-agent-model').click();
  await page.getByRole('option', { name: modelLabel }).click();
  await page.waitForTimeout(150);

  if (opts.emits) {
    await setEmits(page, opts.emits);
  }

  if ((opts.inputs && opts.inputs.length) || (opts.outputs && opts.outputs.length)) {
    // Expand the `<details>` block holding the slot inputs.
    await page.locator('summary:has-text("Context slots")').click();
    if (opts.inputs?.length) {
      for (const slot of opts.inputs) {
        await page.locator('#np-inputs').fill(slot);
        await page.locator('#np-inputs').press('Enter');
      }
    }
    if (opts.outputs?.length) {
      for (const slot of opts.outputs) {
        await page.locator('#np-outputs').fill(slot);
        await page.locator('#np-outputs').press('Enter');
      }
    }
  }

  await page.getByRole('button', { name: /close panel/i }).click();
}

/** Fill the four top-meta fields (display, api, description, slash). */
export async function fillFlowMeta(
  page: Page,
  meta: { display: string; apiName: string; description: string; slashName: string },
): Promise<void> {
  await page.locator('#flow-display-name').fill(meta.display);
  await page.locator('#flow-api-name').fill(meta.apiName);
  await page.locator('#flow-desc').fill(meta.description);
  await page.locator('#flow-slash').fill(meta.slashName);
}

/** Click Save and wait for the success banner. */
export async function saveFlow(page: Page): Promise<void> {
  await page.getByRole('button', { name: /^save$/i }).click();
  await expect(page.getByRole('status')).toContainText(/Created|Saved/, {
    timeout: 10_000,
  });
}
