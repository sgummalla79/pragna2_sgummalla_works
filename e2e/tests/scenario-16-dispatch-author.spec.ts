/**
 * Scenario 16 — Dynamic fan-out: author + visualize a dispatching edge.
 *
 * From `docs/FRONTEND_TEST_SCENARIOS.md`. Covers the FE work shipped on
 * `feat/dynamic-fan-out` (BE future-discussions #35):
 *
 *  1. Build a 2-agent flow (producer → verifier) with slot wiring.
 *  2. Click the connecting edge → new EdgePanel inspector slides in.
 *  3. Tick **Send per item**, pick items_slot from the source's outputs
 *     and item_slot from the target's inputs.
 *  4. Confirm the dispatching edge renders the **↴ per-item** badge
 *     plus a dashed stroke.
 *  5. **Round-trip** — close + reopen the flow, confirm the config
 *     persisted (chip on edge, panel still ticked with same slots).
 *
 * BE-only test — does NOT need a real LLM key. The runtime path (an
 * actual fan-out producing N parallel bubbles) is deferred until an
 * upstream node primitive can write a real list to a slot; today's
 * LLMAgentNode writes the reply STRING and would degrade dispatch to
 * a single-instance scalar wrap (see #35 implementation notes).
 */
import { expect, test } from '@playwright/test';

import { login } from '../helpers/auth';
import { psql } from '../helpers/db';
import {
  configureChatAgent,
  connectViaStore,
  dropFromPalette,
  fillFlowMeta,
  saveFlow,
} from '../helpers/flow-author';

test.describe.configure({ mode: 'serial' });

const FLOW_API_NAME = 'dispatch-sketch';
const SLASH_NAME = 'dispatch-sketch';

test.describe('Scenario 16 — Dynamic fan-out: author + visualize', () => {
  test.beforeEach(async ({ page }) => {
    // Re-runs accumulate flows under the shared e2e test user; the
    // per-user (user_id, api_name) uniqueness on `flows` then 409s the
    // saveFlow call. Wipe this scenario's row up-front so the test
    // starts from a clean slate. Cascade on flows clears the
    // dependent flow_nodes / flow_edges / user_agents rows.
    psql(`DELETE FROM flows WHERE api_name = '${FLOW_API_NAME}';`);
    await login(page);
  });

  test('build flow, declare per-item dispatch on edge, see badge + round-trip', async ({
    page,
  }) => {
    // ── Arrange — build the flow ────────────────────────────────────
    await page.goto('/flows/new', { waitUntil: 'networkidle' });
    await page.waitForSelector('nav[aria-label="Add node"]');

    await fillFlowMeta(page, {
      display: 'Dispatch Sketch',
      apiName: FLOW_API_NAME,
      description: 'Minimal flow to author a per-item dispatch edge.',
      slashName: SLASH_NAME,
    });

    // Producer publishes a list slot the dispatching edge will iterate.
    await dropFromPalette(page, 'Agent');
    await configureChatAgent(page, {
      nodeId: 'producer',
      display: 'Producer',
      prompt: 'Produce raw items.',
      outputs: ['raw_items'],
    });

    // Verifier reads a per-instance payload bound by the dispatch.
    await dropFromPalette(page, 'Agent');
    await configureChatAgent(page, {
      nodeId: 'verifier',
      display: 'Verifier',
      prompt: 'Verify one item.',
      inputs: ['one_item'],
    });

    // Wire __start__ → producer → verifier → __end__ via the store
    // (drag-based is brittle with cascaded nodes — see Scenario 10).
    await connectViaStore(
      page,
      { nodeId: '__start__', handleId: 'out' },
      { nodeId: 'producer', handleId: 'left' },
    );
    await connectViaStore(
      page,
      { nodeId: 'producer', handleId: 'right' },
      { nodeId: 'verifier', handleId: 'left' },
    );
    await connectViaStore(
      page,
      { nodeId: 'verifier', handleId: 'right' },
      { nodeId: '__end__', handleId: 'in' },
    );

    // ── Act — click the producer→verifier edge, declare dispatch ────
    // Configure dispatch BEFORE the first save. Verifier declares
    // `inputs: [one_item]` and no upstream node outputs it directly —
    // only the dispatching edge's `item_slot` registers it as
    // produced (BE validator pass added in #35 implementation). If we
    // saved before configuring dispatch, the BE would 422 with
    // "Node 'verifier' reads slot 'one_item' which no node produces".
    // Identify the dispatching edge by its endpoints. React Flow tags
    // each <g class="react-flow__edge"> with data-id="<edge-id>" (same
    // attribute scheme as nodes — see canvas.ts:revealAndGetHandle).
    // We don't know the synthesised id up-front, so look it up from
    // the store first then locate the SVG group by its data-id.
    const targetEdgeId = await page.evaluate(() => {
      const store = (window as unknown as {
        __flowEditorStore?: {
          getState: () => {
            edges: Array<{ id: string; source: string; target: string }>;
          };
        };
      }).__flowEditorStore;
      if (!store) throw new Error('window.__flowEditorStore not exposed');
      const e = store
        .getState()
        .edges.find((x) => x.source === 'producer' && x.target === 'verifier');
      if (!e) throw new Error('producer→verifier edge not found');
      return e.id;
    });

    // Click the edge SVG group. dispatchEvent bypasses React Flow's
    // pointer hit-test (same z-index trick used in canvas.openPanelFor).
    await page
      .locator(`[data-testid="rf__edge-${targetEdgeId}"]`)
      .dispatchEvent('click');
    await expect(page.getByTestId('edge-panel')).toBeVisible();
    await expect(page.getByTestId('edge-panel')).toContainText(
      'producer → verifier',
    );

    // Toggle dispatch ON — dropdowns reveal.
    await page.getByTestId('dispatch-toggle').check();
    await expect(page.getByTestId('dispatch-fields')).toBeVisible();

    // Pick the slots. The Items slot dropdown lists the source's outputs
    // (raw_items) plus the reserved `user_query`; the Item slot lists
    // the target's inputs (one_item).
    await page.getByTestId('items-slot-select').click();
    await page.getByRole('option', { name: 'raw_items' }).click();
    await page.getByTestId('item-slot-select').click();
    await page.getByRole('option', { name: 'one_item' }).click();

    // Close the EdgePanel + save.
    await page.getByRole('button', { name: /close edge inspector/i }).click();
    await saveFlow(page);

    // ── Assert — visual badge + dashed stroke ───────────────────────
    // React Flow's EdgeLabelRenderer portals labels OUTSIDE the edge
    // <g> element, so the badge is asserted at PAGE scope. Only one
    // dispatching edge exists in this flow, so the unique-testid
    // assumption holds.
    const badge = page.getByTestId('dispatch-badge');
    await expect(badge).toBeVisible();
    await expect(badge).toContainText('↴ per-item');

    // Tooltip names the items_slot — exposed via the chip's `title=`.
    await expect(badge).toHaveAttribute('title', /raw_items/);

    // Dashed stroke on the SVG path. The path IS inside the edge <g>
    // (it's the BaseEdge connector, not the label) so the edge-scoped
    // selector is correct here. React renders `style={{ strokeDasharray:
    // '6 3' }}` as `style="stroke-dasharray: 6 3"` (inline CSS, not an
    // SVG attribute), so we assert via toHaveCSS.
    //
    // IMPORTANT: re-read the edge id from the store AFTER save —
    // buildEditorGraph regenerates ids on re-hydrate (`e_1`, `e_2`),
    // so the `targetEdgeId` captured pre-save is stale.
    const postSaveEdgeId = await page.evaluate(() => {
      const store = (window as unknown as {
        __flowEditorStore?: {
          getState: () => {
            edges: Array<{ id: string; source: string; target: string }>;
          };
        };
      }).__flowEditorStore;
      const e = store!
        .getState()
        .edges.find((x) => x.source === 'producer' && x.target === 'verifier');
      if (!e) throw new Error('producer→verifier edge missing post-save');
      return e.id;
    });
    const path = page.locator(
      `[data-testid="rf__edge-${postSaveEdgeId}"] .react-flow__edge-path`,
    );
    await expect(path).toHaveCSS('stroke-dasharray', /6.*3/);

    // ── Round-trip — back to flow list, reopen, verify it stuck ────
    await page.getByRole('link', { name: /back/i }).click();
    await page.waitForURL('**/flows');
    // The flows list renders each flow as a card with both a body
    // link AND an edit-action link — `.first()` picks the body link
    // (which is enough; both lead to the same /flows/{id}/edit URL).
    await page.getByRole('link', { name: /Dispatch Sketch/i }).first().click();
    await page.waitForSelector('nav[aria-label="Add node"]');

    // Refetch the rebuilt edge id (post-reload, ids regenerate from YAML).
    const reloadedEdgeId = await page.evaluate(() => {
      const store = (window as unknown as {
        __flowEditorStore?: {
          getState: () => {
            edges: Array<{
              id: string;
              source: string;
              target: string;
              data?: { dispatchMode?: string; itemsSlot?: string; itemSlot?: string };
            }>;
          };
        };
      }).__flowEditorStore;
      const e = store!
        .getState()
        .edges.find((x) => x.source === 'producer' && x.target === 'verifier');
      return e
        ? {
            id: e.id,
            dispatchMode: e.data?.dispatchMode,
            itemsSlot: e.data?.itemsSlot,
            itemSlot: e.data?.itemSlot,
          }
        : null;
    });
    expect(reloadedEdgeId).not.toBeNull();
    // The three dispatch fields survived the YAML round-trip via the BE.
    expect(reloadedEdgeId!.dispatchMode).toBe('per_item');
    expect(reloadedEdgeId!.itemsSlot).toBe('raw_items');
    expect(reloadedEdgeId!.itemSlot).toBe('one_item');

    // Badge still rendered after reload (page scope — see above).
    await expect(page.getByTestId('dispatch-badge')).toBeVisible();

    // Re-click the edge — panel re-opens with the same picks.
    await page
      .locator(`[data-testid="rf__edge-${reloadedEdgeId!.id}"]`)
      .dispatchEvent('click');
    await expect(page.getByTestId('edge-panel')).toBeVisible();
    await expect(page.getByTestId('dispatch-toggle')).toBeChecked();
    await expect(page.getByTestId('dispatch-fields')).toContainText('raw_items');
    await expect(page.getByTestId('dispatch-fields')).toContainText('one_item');
  });
});
