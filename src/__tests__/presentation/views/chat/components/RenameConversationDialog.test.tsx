import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RenameConversationDialog } from '@/presentation/views/chat/components/RenameConversationDialog';
import {
  ServiceContext,
  type Services,
} from '@/presentation/providers/ServiceContext';

function renderDialog(opts: {
  onOpenChange?: (open: boolean) => void;
  updateImpl?: (id: string, payload: { title?: string }) => Promise<unknown>;
}) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const update = vi.fn(
    opts.updateImpl ??
      ((_id, payload) =>
        Promise.resolve({
          id: 'conv-1',
          flowId: null,
          threadId: 't',
          userModelId: 'm',
          title: payload.title ?? null,
          createdAt: '2026-05-21T00:00:00Z',
        })),
  );
  const services = {
    conversationService: { update },
  } as unknown as Services;

  const onOpenChange = opts.onOpenChange ?? vi.fn();
  const utils = render(
    <QueryClientProvider client={qc}>
      <ServiceContext.Provider value={services}>
        <RenameConversationDialog
          conversationId="conv-1"
          currentTitle="Old title"
          open={true}
          onOpenChange={onOpenChange}
        />
      </ServiceContext.Provider>
    </QueryClientProvider>,
  );
  return { ...utils, update, onOpenChange };
}

describe('RenameConversationDialog', () => {
  it('renders with the current title pre-filled', () => {
    renderDialog({});
    expect(screen.getByDisplayValue('Old title')).toBeInTheDocument();
  });

  it('calls conversationService.update with the new title on Save', async () => {
    const { update, onOpenChange } = renderDialog({});
    const input = screen.getByDisplayValue('Old title');
    fireEvent.change(input, { target: { value: 'New title' } });
    fireEvent.click(screen.getByRole('button', { name: /save/i }));

    await waitFor(() =>
      expect(update).toHaveBeenCalledWith('conv-1', { title: 'New title' }),
    );
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
  });

  it('coerces an empty title to "Untitled chat"', async () => {
    const { update } = renderDialog({});
    const input = screen.getByDisplayValue('Old title');
    fireEvent.change(input, { target: { value: '   ' } });
    fireEvent.click(screen.getByRole('button', { name: /save/i }));

    await waitFor(() =>
      expect(update).toHaveBeenCalledWith('conv-1', { title: 'Untitled chat' }),
    );
  });

  it('does not close on save error (so user can retry)', async () => {
    const onOpenChange = vi.fn();
    renderDialog({
      onOpenChange,
      updateImpl: () => Promise.reject(new Error('nope')),
    });
    fireEvent.click(screen.getByRole('button', { name: /save/i }));
    // Wait a tick for the mutation to reject; dialog stays open.
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
  });
});
