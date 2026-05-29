/**
 * MCP Servers settings page (Wedge B.2).
 *
 * Lists the user's registered MCP servers (one expandable `McpServerCard`
 * each) + a "Register server" CTA that opens a modal carrying
 * `RegisterMcpServerForm`. Empty state when no servers are registered.
 *
 * Per the scoping conversation: stdio is deferred to Wedge B.3 (the
 * allowlist ships empty on the BE), so the registration form locks
 * the transport selector to `http`.
 */

import { useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { Plug, Plus } from 'lucide-react';
import { Button } from '@/presentation/components/ui/Button';
import { useDirtyDialog } from '@/presentation/hooks/useDirtyDialog';
import { useMcpServers } from '@/presentation/hooks/mcp-servers/useMcpServers';
import { McpServerCard } from './McpServerCard';
import { RegisterMcpServerForm } from './RegisterMcpServerForm';
import type { RegisteredMcpServer } from '@/domain/types/mcp.types';

export default function McpServersView() {
  const { data: servers = [], isLoading, isError } = useMcpServers();
  const [modalOpen, setModalOpen] = useState(false);
  const [lastRegistered, setLastRegistered] = useState<RegisteredMcpServer | null>(
    null,
  );
  // Mirrored from RegisterMcpServerForm via callback so the modal can
  // block Escape / overlay-click while a bearer token is typed but
  // not yet submitted. Labelled close affordances (X icon, Cancel
  // button, successful registration) bypass and proceed normally.
  const [formDirty, setFormDirty] = useState(false);
  const guard = useDirtyDialog(modalOpen && formDirty);

  function handleRegistered(result: RegisteredMcpServer) {
    setLastRegistered(result);
    setModalOpen(false);
  }

  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto">
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold">MCP Servers</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Per-user Model Context Protocol servers. Opt tools in to use them from your agents.
          </p>
        </div>
        <Button onClick={() => setModalOpen(true)} size="sm" className="shrink-0">
          <Plus size={16} aria-hidden="true" />
          Register server
        </Button>
      </div>

      {lastRegistered && (
        <div className="mb-4 rounded-md border border-green-500/30 bg-green-500/5 px-4 py-3 text-sm text-foreground">
          <div className="font-medium">
            Registered “{lastRegistered.displayName}” with{' '}
            {lastRegistered.discoveredToolApiNames.length} tool
            {lastRegistered.discoveredToolApiNames.length === 1 ? '' : 's'}{' '}
            discovered.
          </div>
          <div className="mt-0.5 text-xs text-muted-foreground">
            Expand the server card below and toggle on the tools you want available to your agents.
          </div>
        </div>
      )}

      {isLoading ? (
        <p className="text-muted-foreground text-sm">Loading MCP servers…</p>
      ) : isError ? (
        <p role="alert" className="text-sm text-destructive">
          Failed to load MCP servers. Check that the backend is reachable and reload the page.
        </p>
      ) : servers.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <Plug size={40} className="mx-auto mb-3 opacity-30" aria-hidden="true" />
          <p>No MCP servers yet. Register one to make its tools available to your agents.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {servers.map((s) => (
            <McpServerCard key={s.id} server={s} />
          ))}
        </div>
      )}

      <Dialog.Root open={modalOpen} onOpenChange={setModalOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-[700] bg-foreground/40 backdrop-blur-sm" />
          <Dialog.Content
            className="
              fixed left-1/2 top-1/2 z-[701] -translate-x-1/2 -translate-y-1/2
              w-[560px] max-w-[calc(100vw-32px)]
              flex flex-col gap-4
              rounded-[14px] border border-border
              bg-popover p-6 shadow-2xl
              max-h-[90vh] overflow-y-auto
            "
            {...guard.contentProps}
          >
            <Dialog.Title className="text-base font-bold text-foreground m-0">
              Register an MCP server
            </Dialog.Title>
            <Dialog.Description className="text-[12px] text-muted-foreground m-0">
              We'll connect to the server during registration to discover
              its tool list. Discovered tools start disabled — opt them
              in afterward.
            </Dialog.Description>
            <RegisterMcpServerForm
              onRegistered={handleRegistered}
              onCancel={() => setModalOpen(false)}
              onDirtyChange={setFormDirty}
            />
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  );
}
