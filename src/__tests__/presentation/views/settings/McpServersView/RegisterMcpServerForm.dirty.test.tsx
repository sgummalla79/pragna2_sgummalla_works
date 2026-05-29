import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RegisterMcpServerForm } from '@/presentation/views/settings/McpServersView/RegisterMcpServerForm';
import { ServiceContext, type Services } from '@/presentation/providers/ServiceContext';

/**
 * Pins the `onDirtyChange` callback contract that future-discussions
 * #7 (unsaved-changes guard) wires up. McpServersView uses this
 * signal to arm the modal's `useDirtyDialog` — without it, Escape /
 * overlay-click can silently discard a typed-but-not-yet-submitted
 * bearer token.
 */
function renderForm(onDirtyChange: (d: boolean) => void) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const services = {
    mcpServerService: {
      list: vi.fn().mockResolvedValue([]),
      register: vi.fn(),
      update: vi.fn(),
      archive: vi.fn(),
      refreshTools: vi.fn(),
    },
  } as unknown as Services;

  return render(
    <QueryClientProvider client={qc}>
      <ServiceContext.Provider value={services}>
        <RegisterMcpServerForm
          onRegistered={vi.fn()}
          onCancel={vi.fn()}
          onDirtyChange={onDirtyChange}
        />
      </ServiceContext.Provider>
    </QueryClientProvider>,
  );
}

describe('RegisterMcpServerForm — onDirtyChange wiring', () => {
  it('fires false on mount (no fields touched yet)', () => {
    const cb = vi.fn();
    renderForm(cb);
    expect(cb).toHaveBeenCalledWith(false);
  });

  it('fires true once the display name has content', () => {
    const cb = vi.fn();
    renderForm(cb);
    cb.mockClear();

    const name = screen.getByLabelText(/Display name/i);
    fireEvent.change(name, { target: { value: 'My Linear' } });
    expect(cb).toHaveBeenLastCalledWith(true);
  });

  it('fires true once the URL has content', () => {
    const cb = vi.fn();
    renderForm(cb);
    cb.mockClear();

    const url = screen.getByLabelText(/Server URL/i);
    fireEvent.change(url, { target: { value: 'https://x' } });
    expect(cb).toHaveBeenLastCalledWith(true);
  });

  it('fires true once a header row has either a key or a value', () => {
    const cb = vi.fn();
    renderForm(cb);
    cb.mockClear();

    // First row is the seed empty row. Filling its value field marks dirty.
    const [, headerValue] = screen.getAllByPlaceholderText(/Header (name|value)/i);
    fireEvent.change(headerValue, { target: { value: 'sk-...' } });
    expect(cb).toHaveBeenLastCalledWith(true);
  });

  it('reverts to false when all fields are cleared back to empty', () => {
    const cb = vi.fn();
    renderForm(cb);
    cb.mockClear();

    const name = screen.getByLabelText(/Display name/i);
    fireEvent.change(name, { target: { value: 'X' } });
    expect(cb).toHaveBeenLastCalledWith(true);

    fireEvent.change(name, { target: { value: '' } });
    expect(cb).toHaveBeenLastCalledWith(false);
  });

  it('fires false on unmount so the parent guard releases beforeunload', () => {
    const cb = vi.fn();
    const { unmount } = renderForm(cb);

    const name = screen.getByLabelText(/Display name/i);
    fireEvent.change(name, { target: { value: 'My Linear' } });
    expect(cb).toHaveBeenLastCalledWith(true);

    cb.mockClear();
    unmount();
    expect(cb).toHaveBeenCalledWith(false);
  });

  it('whitespace-only input does NOT mark dirty (trim guard)', () => {
    const cb = vi.fn();
    renderForm(cb);
    cb.mockClear();

    fireEvent.change(screen.getByLabelText(/Display name/i), {
      target: { value: '   ' },
    });
    // No call with `true` — the initial mount fire already established
    // baseline `false`, so absence of any `true` call here proves the
    // trim guard held.
    expect(cb).not.toHaveBeenCalledWith(true);
  });
});
