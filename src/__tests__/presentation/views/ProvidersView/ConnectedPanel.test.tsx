import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ConnectedPanel } from '@/presentation/views/settings/ProvidersView/ConnectedPanel';
import { ServiceContext, type Services } from '@/presentation/providers/ServiceContext';
import type { Model } from '@/domain/types/model.types';

function makeModel(overrides: Partial<Model> = {}): Model {
  return {
    id:                 overrides.id ?? 'm1',
    userProviderId:     'up1',
    modelName:          'claude-sonnet-4-6',
    displayName:        'Claude Sonnet 4.6',
    costPerInputToken:  '0.000003',
    costPerOutputToken: '0.000015',
    enabled:            false,
    availableForChat:   false,
    availableForFlows:  false,
    archived:           false,
    metadata:           {},
    supportsVision:     false,
    supportsPdf:        false,
    ...overrides,
  };
}

function renderPanel(models: Model[], onDirtyChange?: (d: boolean) => void) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const services = {
    modelService: {
      list: vi.fn(),
      update: vi.fn(),
      bulkUpdate: vi.fn().mockResolvedValue([]),
    },
  } as unknown as Services;

  return render(
    <QueryClientProvider client={qc}>
      <ServiceContext.Provider value={services}>
        <ConnectedPanel
          models={models}
          error=""
          onDirtyChange={onDirtyChange}
        />
      </ServiceContext.Provider>
    </QueryClientProvider>
  );
}

describe('ConnectedPanel', () => {
  it('always shows Save and Cancel in the grid-edit toolbar', () => {
    renderPanel([makeModel()]);
    expect(screen.getByRole('button', { name: /save/i })).toBeVisible();
    expect(screen.getByRole('button', { name: /cancel/i })).toBeVisible();
  });

  it('does not render Refresh in the panel (it lives in the modal header)', () => {
    renderPanel([makeModel()]);
    expect(screen.queryByRole('button', { name: /refresh/i })).toBeNull();
  });

  it('disables Save and Cancel when no rows are dirty', () => {
    renderPanel([makeModel()]);
    expect(screen.getByRole('button', { name: /save/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /cancel/i })).toBeDisabled();
  });

  it('enables Save and Cancel after clicking a toggle', () => {
    renderPanel([makeModel({ enabled: false })]);
    fireEvent.click(screen.getByRole('button', { name: 'Enabled' }));
    expect(screen.getByRole('button', { name: /save/i })).toBeEnabled();
    expect(screen.getByRole('button', { name: /cancel/i })).toBeEnabled();
  });

  it('enables Save and Cancel after clicking the Chat toggle', () => {
    renderPanel([makeModel({ availableForChat: false })]);
    fireEvent.click(screen.getByRole('button', { name: 'Chat' }));
    expect(screen.getByRole('button', { name: /save/i })).toBeEnabled();
    expect(screen.getByRole('button', { name: /cancel/i })).toBeEnabled();
  });

  it('enables Save and Cancel after editing a display name and blurring', () => {
    renderPanel([makeModel({ displayName: 'Old name' })]);
    const input = screen.getByDisplayValue('Old name');
    fireEvent.change(input, { target: { value: 'New name' } });
    fireEvent.blur(input);
    expect(screen.getByRole('button', { name: /save/i })).toBeEnabled();
    expect(screen.getByRole('button', { name: /cancel/i })).toBeEnabled();
  });

  it('disables Save/Cancel again when toggle is flipped back to its original value', () => {
    renderPanel([makeModel({ enabled: false })]);
    const toggle = screen.getByRole('button', { name: 'Enabled' });
    fireEvent.click(toggle); // false → true (dirty)
    expect(screen.getByRole('button', { name: /save/i })).toBeEnabled();
    fireEvent.click(toggle); // true → false (back to original — buffer drops the entry)
    expect(screen.getByRole('button', { name: /save/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /cancel/i })).toBeDisabled();
  });

  // Wired in future-discussions #7: ProviderModal arms its
  // `useDirtyDialog` guard off this callback, so the contract that
  // `onDirtyChange(true)` fires precisely when the in-grid Save/Cancel
  // enable is what gates Escape / overlay-click hardening upstream.
  describe('onDirtyChange callback', () => {
    it('fires false on mount when no rows are dirty', () => {
      const cb = vi.fn();
      renderPanel([makeModel()], cb);
      // First fire is the mount effect (always false because no rows
      // have been touched yet).
      expect(cb).toHaveBeenCalledWith(false);
    });

    it('fires true after a toggle flips, and back to false when reverted', () => {
      const cb = vi.fn();
      renderPanel([makeModel({ enabled: false })], cb);
      cb.mockClear();

      const toggle = screen.getByRole('button', { name: 'Enabled' });
      fireEvent.click(toggle);
      expect(cb).toHaveBeenLastCalledWith(true);

      fireEvent.click(toggle); // back to original
      expect(cb).toHaveBeenLastCalledWith(false);
    });

    it('fires false on unmount so the parent guard releases beforeunload', () => {
      const cb = vi.fn();
      const { unmount } = renderPanel([makeModel({ enabled: false })], cb);

      // Make it dirty so we can verify the unmount cleanup releases.
      fireEvent.click(screen.getByRole('button', { name: 'Enabled' }));
      expect(cb).toHaveBeenLastCalledWith(true);

      cb.mockClear();
      unmount();
      expect(cb).toHaveBeenCalledWith(false);
    });
  });
});
