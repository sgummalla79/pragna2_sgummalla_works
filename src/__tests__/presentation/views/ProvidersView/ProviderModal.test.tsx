/**
 * Integration test for the future-discussions #7 unsaved-changes guard
 * applied at the ProviderModal layer. Unit-level hardening contract is
 * pinned by `useDirtyDialog.test.ts`; this test asserts the integrated
 * behavior — that Radix actually honors our `preventDefault` when our
 * hook passes it `modelEditsDirty=true`, so Escape stops closing the
 * modal in the real (jsdom) integration.
 *
 * Trust-but-verify: the hook contract is true today, but a future
 * Radix-version bump could change the semantics under us. This test
 * fails loudly if that happens.
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ProviderModal } from '@/presentation/views/settings/ProvidersView/ProviderModal';
import { ServiceContext, type Services } from '@/presentation/providers/ServiceContext';
import type { LlmProvider, UserProvider } from '@/domain/types/provider.types';

const FAKE_PROVIDER: LlmProvider = {
  id: 'p1',
  name: 'anthropic',
  displayName: 'Anthropic',
  credentialKind: 'api_key',
  enabled: true,
};

const FAKE_USER_PROVIDER: UserProvider = {
  id: 'up1',
  llmProviderId: 'p1',
  providerName: 'anthropic',
  enabled: true,
  metadata: {},
};

function renderModal(opts: {
  modelEditsDirty: boolean;
  onClose?: () => void;
  open?: boolean;
}) {
  const onClose = opts.onClose ?? vi.fn();
  // ConnectedPanel pulls `useBulkUpdateModels` → useServices, so the
  // modal mount needs both providers even when we're only asserting
  // the dialog hardening surface.
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const services = {
    modelService: {
      list: vi.fn(),
      update: vi.fn(),
      bulkUpdate: vi.fn().mockResolvedValue([]),
    },
  } as unknown as Services;

  render(
    <QueryClientProvider client={qc}>
      <ServiceContext.Provider value={services}>
        <ProviderModal
          llmProvider={FAKE_PROVIDER}
          userProvider={FAKE_USER_PROVIDER}
          models={[]}
          open={opts.open ?? true}
          onClose={onClose}
          disconnecting={false}
          disconnectError=""
          onDisconnect={vi.fn()}
          credentialValues={{}}
          onCredentialChange={vi.fn()}
          connectError=""
          connecting={false}
          onConnect={vi.fn()}
          refreshing={false}
          onRefresh={vi.fn()}
          modelEditsDirty={opts.modelEditsDirty}
          onModelEditsDirtyChange={vi.fn()}
        />
      </ServiceContext.Provider>
    </QueryClientProvider>,
  );
  return { onClose };
}

describe('ProviderModal — unsaved-changes guard (future-discussions #7)', () => {
  it('Escape closes the modal when modelEditsDirty=false', () => {
    const { onClose } = renderModal({ modelEditsDirty: false });
    fireEvent.keyDown(document.body, { key: 'Escape', code: 'Escape' });
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('Escape does NOT close the modal when modelEditsDirty=true', () => {
    const { onClose } = renderModal({ modelEditsDirty: true });
    fireEvent.keyDown(document.body, { key: 'Escape', code: 'Escape' });
    expect(onClose).not.toHaveBeenCalled();
    // Modal chrome is still rendered.
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('labelled X close button still closes the modal when dirty (trusted intentional dismissal)', () => {
    const { onClose } = renderModal({ modelEditsDirty: true });
    fireEvent.click(screen.getByRole('button', { name: /^Close$/i }));
    expect(onClose).toHaveBeenCalledOnce();
  });
});
