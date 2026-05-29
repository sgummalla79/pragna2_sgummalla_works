import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useDirtyDialog } from '@/presentation/hooks/useDirtyDialog';

/**
 * Pins the Radix dialog hardening contract for the unsaved-changes
 * guard (future-discussions #7).
 *
 * Radix interprets a `preventDefault()` inside `onEscapeKeyDown` /
 * `onPointerDownOutside` as "consume the event, do not close the
 * dialog." So our hook MUST call preventDefault when dirty, and MUST
 * NOT call it when clean — otherwise either accidental dismissals
 * leak through OR labelled close affordances stop working at all.
 */
describe('useDirtyDialog', () => {
  function fakeEvent() {
    return { preventDefault: vi.fn() };
  }

  it('does NOT preventDefault Escape when not dirty', () => {
    const { result } = renderHook(() => useDirtyDialog(false));
    const e = fakeEvent();
    result.current.contentProps.onEscapeKeyDown(e as unknown as KeyboardEvent);
    expect(e.preventDefault).not.toHaveBeenCalled();
  });

  it('does NOT preventDefault overlay click when not dirty', () => {
    const { result } = renderHook(() => useDirtyDialog(false));
    const e = fakeEvent();
    result.current.contentProps.onPointerDownOutside(e);
    expect(e.preventDefault).not.toHaveBeenCalled();
  });

  it('preventDefaults Escape when dirty', () => {
    const { result } = renderHook(() => useDirtyDialog(true));
    const e = fakeEvent();
    result.current.contentProps.onEscapeKeyDown(e as unknown as KeyboardEvent);
    expect(e.preventDefault).toHaveBeenCalledOnce();
  });

  it('preventDefaults overlay click when dirty', () => {
    const { result } = renderHook(() => useDirtyDialog(true));
    const e = fakeEvent();
    result.current.contentProps.onPointerDownOutside(e);
    expect(e.preventDefault).toHaveBeenCalledOnce();
  });

  it('flipping dirty true→false stops blocking, false→true starts blocking', () => {
    const { result, rerender } = renderHook(
      ({ dirty }: { dirty: boolean }) => useDirtyDialog(dirty),
      { initialProps: { dirty: true } },
    );

    const e1 = fakeEvent();
    result.current.contentProps.onEscapeKeyDown(e1 as unknown as KeyboardEvent);
    expect(e1.preventDefault).toHaveBeenCalledOnce();

    rerender({ dirty: false });
    const e2 = fakeEvent();
    result.current.contentProps.onEscapeKeyDown(e2 as unknown as KeyboardEvent);
    expect(e2.preventDefault).not.toHaveBeenCalled();

    rerender({ dirty: true });
    const e3 = fakeEvent();
    result.current.contentProps.onEscapeKeyDown(e3 as unknown as KeyboardEvent);
    expect(e3.preventDefault).toHaveBeenCalledOnce();
  });

  it('attaches a beforeunload listener when dirty (browser-level half of the guard)', () => {
    const addSpy = vi.spyOn(window, 'addEventListener');
    renderHook(() => useDirtyDialog(true));
    expect(
      addSpy.mock.calls.filter(([evt]) => evt === 'beforeunload'),
    ).toHaveLength(1);
    addSpy.mockRestore();
  });
});
