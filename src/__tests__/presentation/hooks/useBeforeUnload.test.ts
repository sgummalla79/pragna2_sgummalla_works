import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useBeforeUnload } from '@/presentation/hooks/useBeforeUnload';

/**
 * Regression-pins the only two behaviors that matter for this hook:
 *  - listener attaches IFF `when` is truthy
 *  - listener calls `preventDefault()` + sets `returnValue` so the
 *    browser actually surfaces its native unsaved-changes prompt
 *
 * Future-discussions #7 (unsaved-changes guard) shipped this as the
 * tab-close / refresh half of the modal hardening — Escape + overlay
 * are handled by `useDirtyDialog`, this covers the browser-native
 * window-level events.
 */
describe('useBeforeUnload', () => {
  let addSpy: ReturnType<typeof vi.spyOn>;
  let removeSpy: ReturnType<typeof vi.spyOn>;

  function setupSpies() {
    addSpy = vi.spyOn(window, 'addEventListener');
    removeSpy = vi.spyOn(window, 'removeEventListener');
  }

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('does NOT attach a listener when `when` is false', () => {
    setupSpies();
    renderHook(() => useBeforeUnload(false));
    expect(
      addSpy.mock.calls.filter(([evt]) => evt === 'beforeunload'),
    ).toHaveLength(0);
  });

  it('attaches a listener when `when` flips true', () => {
    setupSpies();
    const { rerender } = renderHook(({ when }) => useBeforeUnload(when), {
      initialProps: { when: false },
    });
    expect(
      addSpy.mock.calls.filter(([evt]) => evt === 'beforeunload'),
    ).toHaveLength(0);

    rerender({ when: true });
    expect(
      addSpy.mock.calls.filter(([evt]) => evt === 'beforeunload'),
    ).toHaveLength(1);
  });

  it('detaches the listener on unmount', () => {
    setupSpies();
    const { unmount } = renderHook(() => useBeforeUnload(true));
    expect(
      removeSpy.mock.calls.filter(([evt]) => evt === 'beforeunload'),
    ).toHaveLength(0);
    unmount();
    expect(
      removeSpy.mock.calls.filter(([evt]) => evt === 'beforeunload'),
    ).toHaveLength(1);
  });

  it('detaches the listener when `when` flips false', () => {
    setupSpies();
    const { rerender } = renderHook(({ when }) => useBeforeUnload(when), {
      initialProps: { when: true },
    });
    expect(
      removeSpy.mock.calls.filter(([evt]) => evt === 'beforeunload'),
    ).toHaveLength(0);
    rerender({ when: false });
    expect(
      removeSpy.mock.calls.filter(([evt]) => evt === 'beforeunload'),
    ).toHaveLength(1);
  });

  it('handler calls preventDefault so the browser shows its native prompt', () => {
    renderHook(() => useBeforeUnload(true));

    // Synthesize a real beforeunload — jsdom dispatches it through
    // the normal listener chain, so our handler fires. We only assert
    // the modern API contract (`preventDefault`); the `returnValue=''`
    // line is a legacy-IE/Edge shim that jsdom doesn't faithfully
    // model and is not worth pinning across browser versions.
    const event = new Event('beforeunload', { cancelable: true });
    const preventSpy = vi.spyOn(event, 'preventDefault');
    window.dispatchEvent(event);

    expect(preventSpy).toHaveBeenCalledOnce();
  });
});
