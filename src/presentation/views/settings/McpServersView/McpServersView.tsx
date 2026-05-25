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

  function handleRegistered(result: RegisteredMcpServer) {
    setLastRegistered(result);
    setModalOpen(false);
  }

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4 p-6">
      {/* ── Header ─────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold">MCP Servers</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Register your own Model Context Protocol servers. Each
            server's discovered tools land in your tool inventory; opt
            them in per tool, then reference them from any agent's{' '}
            <code>tools</code> list.
          </p>
        </div>
        <Button onClick={() => setModalOpen(true)}>
          <Plus size={14} aria-hidden="true" className="mr-1.5" />
          Register server
        </Button>
      </div>

      {/* ── Post-register success banner ───────────────────────────── */}
      {lastRegistered && (
        <div className="rounded-md border border-green-500/30 bg-green-500/5 px-4 py-3 text-[12px] text-foreground">
          <div className="font-medium">
            Registered “{lastRegistered.displayName}” with{' '}
            {lastRegistered.discoveredToolApiNames.length} tool
            {lastRegistered.discoveredToolApiNames.length === 1 ? '' : 's'}{' '}
            discovered.
          </div>
          <div className="mt-0.5 text-muted-foreground">
            Expand the server card below and toggle on the tools you
            want available to your agents.
          </div>
        </div>
      )}

      {/* ── Body ───────────────────────────────────────────────────── */}
      {isLoading ? (
        <div className="rounded-lg border border-border bg-card p-8 text-center text-sm text-muted-foreground">
          Loading…
        </div>
      ) : isError ? (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-6 text-sm text-destructive">
          Failed to load MCP servers. Check that the backend is reachable
          and reload the page.
        </div>
      ) : servers.length === 0 ? (
        <EmptyState onCreate={() => setModalOpen(true)} />
      ) : (
        <div className="flex flex-col gap-3">
          {servers.map((s) => (
            <McpServerCard key={s.id} server={s} />
          ))}
        </div>
      )}

      {/* ── Register modal ─────────────────────────────────────────── */}
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
            />
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  );
}

function EmptyState({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-border bg-card p-10 text-center">
      <Plug size={28} aria-hidden="true" className="text-muted-foreground" />
      <div>
        <h2 className="text-sm font-medium">No MCP servers yet</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Register your first MCP server to make its tools available
          to your agents.
        </p>
      </div>
      <Button onClick={onCreate}>
        <Plus size={14} aria-hidden="true" className="mr-1.5" />
        Register your first MCP server
      </Button>
    </div>
  );
}
