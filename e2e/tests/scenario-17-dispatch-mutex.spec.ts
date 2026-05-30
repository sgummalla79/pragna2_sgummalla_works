/**
 * Scenario 17 — Dynamic fan-out: mutual-exclusion gate with If/Else.
 *
 * From `docs/FRONTEND_TEST_SCENARIOS.md`. Tests the v1 locked design
 * call (#35 Fork 3): a node either branches via `set_route` (`emits`
 * non-empty) OR fans out via `dispatch_mode`, NOT both. The
 * EdgePanel enforces this by **disabling the dispatch toggle** and
 * surfacing an **amber callout** that names the source agent's
 * emits and the rule. This pre-empts the BE YAML validator's
 * `mutual-exclusion` 422 — the author can't even author the
 * conflict in the visual editor.
 *
 * BE-only — no LLM required. Purely a UI + state assertion.
 */
import { expect, test } from '@playwright/test';

import { login } from '../helpers/auth';
import {
  configureChatAgent,
  connectViaStore,
  dropFromPalette,
  fillFlowMeta,
  saveFlow,
} from '../helpers/flow-author';

test.describe.configure({ mode: 'serial' });

const FLOW_API_NAME = 'gate-sketch';
const SLASH_NAME = 'gate-sketch';

test.describe('Scenario 17 — Dynamic fan-out: mutual-exclusion gate', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('If/Else source disables dispatch toggle, shows amber callout naming emits', async ({
    page,
  }) => {
    // ── Arrange — flow with an If/Else node + worker ─────────────────
    await page.goto('/flows/new', { waitUntil: 'networkidle' });
    await page.waitForSelector('nav[aria-label="Add node"]');

    await fillFlowMeta(page, {
      display: 'Gate Sketch',
      apiName: FLOW_API_NAME,
      description: 'Minimal flow to test the dispatch mutual-exclusion gate.',
      slashName: SLASH_NAME,
    });

    // If/Else node — drops with `[passed, failed]` emits by default.
    // The classify prompt template references them; we don't run the
    // flow, but the emits being non-empty is the gate trigger.
    await dropFromPalette(page, 'Decision');

    // Worker reads a payload slot. The dispatch toggle should be
    // gated off REGARDLESS of whether the target has matching
    // inputs — the gate is about the SOURCE, not the target.
    await dropFromPalette(page, 'Agent');
    await configureChatAgent(page, {
      nodeId: 'worker',
      display: 'Worker',
      prompt: 'Process the payload.',
      inputs: ['payload'],
    });

    // The If/Else node's default id is `node_1` (palette cascade).
    // Wire __start__ → node_1 → worker (off port:passed) → __end__.
    await connectViaStore(
      page,
      { nodeId: '__start__', handleId: 'out' },
      { nodeId: 'node_1', handleId: 'left' },
    );
    await connectViaStore(
      page,
      { nodeId: 'node_1', handleId: 'port:passed' },
      { nodeId: 'worker', handleId: 'left' },
    );
    await connectViaStore(
      page,
      { nodeId: 'worker', handleId: 'right' },
      { nodeId: '__end__', handleId: 'in' },
    );

    await saveFlow(page);

    // ── Act — click the node_1 → worker edge, open EdgePanel ────────
    const gatedEdgeId = await page.evaluate(() => {
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
        .edges.find((x) => x.source === 'node_1' && x.target === 'worker');
      if (!e) throw new Error('node_1→worker edge not found');
      return e.id;
    });

    await page
      .locator(`.react-flow__edge[data-id="${gatedEdgeId}"]`)
      .dispatchEvent('click');
    await expect(page.getByTestId('edge-panel')).toBeVisible();

    // ── Assert — toggle disabled + callout naming emits ─────────────
    const toggle = page.getByTestId('dispatch-toggle');
    await expect(toggle).toBeDisabled();
    await expect(toggle).not.toBeChecked();

    // The amber callout explains the gate. We require the EXACT words
    // describing the v1 rule plus the emits list — both are author-
    // facing teaching moments that must not regress silently.
    const callout = page.getByTestId('dispatch-blocked-reason');
    await expect(callout).toBeVisible();
    await expect(callout).toContainText(/branches via emits/);
    await expect(callout).toContainText(/passed/);
    await expect(callout).toContainText(/failed/);
    await expect(callout).toContainText(/v1 mutual-exclusion/);

    // Dropdowns must NOT be rendered — they only appear when dispatch
    // is on, and the gate prevents turning it on.
    await expect(page.getByTestId('dispatch-fields')).toHaveCount(0);

    // No badge on the canvas edge — nothing is being dispatched.
    await expect(
      page
        .locator(`.react-flow__edge[data-id="${gatedEdgeId}"]`)
        .getByTestId('dispatch-badge'),
    ).toHaveCount(0);
  });
});
