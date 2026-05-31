import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useSmoothStreamingText } from '@/presentation/views/chat/hooks/useSmoothStreamingText';

/**
 * Drive requestAnimationFrame deterministically: each flushFrame(dtMs)
 * invokes the pending rAF callback with a controlled timestamp so we can
 * assert the reveal cadence without real timers.
 */
let now = 0;
let pending: FrameRequestCallback | null = null;

beforeEach(() => {
  now = 0;
  pending = null;
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
    pending = cb;
    return 1;
  });
  vi.stubGlobal('cancelAnimationFrame', () => {
    pending = null;
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function flushFrame(dtMs: number) {
  now += dtMs;
  const cb = pending;
  pending = null;
  act(() => {
    cb?.(now);
  });
}

describe('useSmoothStreamingText', () => {
  it('returns the full text immediately when not streaming', () => {
    const { result } = renderHook(() =>
      useSmoothStreamingText('Complete answer.', false),
    );
    expect(result.current).toBe('Complete answer.');
  });

  it('reveals a growing prefix over frames while streaming', () => {
    const text = 'a'.repeat(500);
    const { result } = renderHook(() => useSmoothStreamingText(text, true));

    // First frame seeds the timestamp (dt=0) → nothing revealed yet beyond
    // the initial count (which starts at full length on mount, so force the
    // streaming path by starting from empty).
    // Start from empty content streaming up.
    const empty = renderHook(
      ({ t, s }) => useSmoothStreamingText(t, s),
      { initialProps: { t: '', s: true } },
    );
    empty.rerender({ t: text, s: true });

    flushFrame(0); // seed timestamp
    flushFrame(100); // advance 100ms
    const afterFirst = empty.result.current.length;
    expect(afterFirst).toBeGreaterThan(0);
    expect(afterFirst).toBeLessThan(text.length);

    flushFrame(100);
    expect(empty.result.current.length).toBeGreaterThan(afterFirst);

    // The revealed text is always a prefix of the full buffer.
    expect(text.startsWith(empty.result.current)).toBe(true);

    // Drain over several frames (per-frame dt is clamped, so a single huge
    // frame can't dump the buffer — that clamp is the backgrounded-tab
    // guard). A bounded loop reaches the full text.
    for (let i = 0; i < 500 && empty.result.current.length < text.length; i++) {
      flushFrame(50);
    }
    expect(empty.result.current).toBe(text);

    // touch the streaming hook result to avoid an unused-var lint
    expect(typeof result.current).toBe('string');
  });

  it('snaps to the full text the moment streaming ends', () => {
    const text = 'b'.repeat(300);
    const { result, rerender } = renderHook(
      ({ t, s }) => useSmoothStreamingText(t, s),
      { initialProps: { t: '', s: true } },
    );
    rerender({ t: text, s: true });
    flushFrame(0);
    flushFrame(50);
    expect(result.current.length).toBeLessThan(text.length);

    // Stream completes → full text shows at once, no waiting for frames.
    rerender({ t: text, s: false });
    expect(result.current).toBe(text);
  });
});
