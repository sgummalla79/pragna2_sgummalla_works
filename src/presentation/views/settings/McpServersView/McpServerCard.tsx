/**
 * One card per registered MCP server (Wedge B.2).
 *
 * Mirrors the `ConnectedPanel` pattern from `ProvidersView`: header
 * always visible, body toggles in/out. Header shows the server's
 * identity, transport badge, enabled switch, tool counts, and an
 * expand chevron. Body shows the per-tool toggle list, a "Refresh
 * tools" action, and a destructive "Archive" button (gated through
 * `ConfirmButton` per the `feedback-destructive-actions-confirm`
 * memory).
 */

import { useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, RefreshCw } from 'lucide-react';
import { Badge } from '@/presentation/components/ui/Badge';
import { Button } from '@/presentation/components/ui/Button';
import { Card } from '@/presentation/components/ui/Card';
import { ConfirmButton } from '@/presentation/components/ui/ConfirmButton';
import {
  useArchiveMcpServer,
  useRefreshMcpServerTools,
  useUpdateMcpServer,
} from '@/presentation/hooks/mcp-servers/useMcpServers';
import { useTools, useToggleTool } from '@/presentation/hooks/tools/useTools';
import type { UserMcpServer } from '@/domain/types/mcp.types';

interface Props {
  server: UserMcpServer;
}

export function McpServerCard({ server }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshSummary, setRefreshSummary] = useState<string | null>(null);

  const updateServer = useUpdateMcpServer();
  const archiveServer = useArchiveMcpServer();
  const refreshTools = useRefreshMcpServerTools();
  const toggleTool = useToggleTool();
  const { data: allTools = [] } = useTools();

  // Filter the flat /api/tools list down to this server's tools. The
  // backend stamps `userMcpServerId` on every MCP-typed tool row, so
  // we can do client-side filtering without a per-server endpoint.
  const serverTools = useMemo(
    () =>
      allTools
        .filter((t) => t.userMcpServerId === server.id)
        .sort((a, b) => a.apiName.localeCompare(b.apiName)),
    [allTools, server.id],
  );

  const totalCount = server.tools?.total ?? serverTools.length;
  const enabledCount =
    server.tools?.enabled ?? serverTools.filter((t) => t.enabled).length;

  async function handleToggleServer(nextEnabled: boolean) {
    setError(null);
    try {
      await updateServer.mutateAsync({
        id: server.id,
        payload: { enabled: nextEnabled },
      });
    } catch (err) {
      setError(
        err instanceof Error
          ? `Failed to update server: ${err.message}`
          : 'Failed to update server.',
      );
    }
  }

  async function handleRefreshTools() {
    setError(null);
    setRefreshSummary(null);
    try {
      const diff = await refreshTools.mutateAsync(server.id);
      setRefreshSummary(
        `Refreshed: ${diff.added} added, ${diff.unchanged} unchanged, ${diff.archived} archived.`,
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? `Discovery failed: ${err.message}`
          : 'Discovery failed.',
      );
    }
  }

  async function handleArchiveServer() {
    setError(null);
    try {
      await archiveServer.mutateAsync(server.id);
    } catch (err) {
      setError(
        err instanceof Error
          ? `Failed to archive server: ${err.message}`
          : 'Failed to archive server.',
      );
    }
  }

  async function handleToggleTool(toolId: string, enabled: boolean) {
    setError(null);
    try {
      await toggleTool.mutateAsync({ id: toolId, payload: { enabled } });
    } catch (err) {
      setError(
        err instanceof Error
          ? `Failed to toggle tool: ${err.message}`
          : 'Failed to toggle tool.',
      );
    }
  }

  return (
    <Card className="overflow-hidden">
      {/* ── Header (always visible) ─────────────────────────────── */}
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center gap-3 p-4 text-left hover:bg-accent/50"
        aria-expanded={expanded}
        aria-controls={`mcp-server-body-${server.id}`}
      >
        {expanded ? (
          <ChevronDown size={16} aria-hidden="true" className="shrink-0" />
        ) : (
          <ChevronRight size={16} aria-hidden="true" className="shrink-0" />
        )}
        <div className="flex flex-1 flex-col gap-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium truncate">{server.displayName}</span>
            <Badge variant="outline" className="text-[10px] uppercase">
              {server.transport}
            </Badge>
            {!server.enabled && (
              <Badge variant="secondary" className="text-[10px]">
                disabled
              </Badge>
            )}
          </div>
          <span className="text-xs text-muted-foreground">
            {enabledCount} / {totalCount} tools enabled
          </span>
        </div>
      </button>

      {/* ── Expanded body ────────────────────────────────────────── */}
      {expanded && (
        <div
          id={`mcp-server-body-${server.id}`}
          className="border-t border-border bg-background"
        >
          {/* Action row */}
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3">
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleRefreshTools}
                disabled={refreshTools.isPending}
              >
                <RefreshCw size={12} aria-hidden="true" className="mr-1.5" />
                {refreshTools.isPending ? 'Refreshing…' : 'Refresh tools'}
              </Button>
              <label className="flex items-center gap-2 text-xs">
                <input
                  type="checkbox"
                  checked={server.enabled}
                  onChange={(e) => handleToggleServer(e.target.checked)}
                  disabled={updateServer.isPending}
                />
                Server enabled
              </label>
            </div>
            <ConfirmButton
              size="sm"
              confirmTitle={`Archive '${server.displayName}'?`}
              confirmDescription={
                <>
                  This disables every tool from this server, and the server
                  disappears from your list. Existing flows that reference
                  these tools keep their chip values, but the resolver will
                  drop them at runtime. You can re-add the same server name
                  later (it'll get a fresh id).
                </>
              }
              confirmLabel="Archive"
              onConfirm={handleArchiveServer}
            >
              Archive…
            </ConfirmButton>
          </div>

          {refreshSummary && (
            <div className="border-b border-border bg-muted/30 px-4 py-2 text-[12px] text-muted-foreground">
              {refreshSummary}
            </div>
          )}
          {error && (
            <div className="border-b border-border bg-destructive/10 px-4 py-2 text-[12px] text-destructive">
              {error}
            </div>
          )}

          {/* Tool list */}
          {serverTools.length === 0 ? (
            <div className="px-4 py-6 text-center text-xs text-muted-foreground">
              No tools yet. Try refreshing — or this server may not expose any.
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {serverTools.map((t) => (
                <li
                  key={t.id}
                  className="flex items-start gap-3 px-4 py-3"
                >
                  <input
                    type="checkbox"
                    id={`tool-toggle-${t.id}`}
                    checked={t.enabled}
                    onChange={(e) =>
                      handleToggleTool(t.id, e.target.checked)
                    }
                    disabled={toggleTool.isPending}
                    className="mt-1 shrink-0"
                  />
                  <label
                    htmlFor={`tool-toggle-${t.id}`}
                    className="flex flex-1 flex-col gap-0.5 cursor-pointer min-w-0"
                  >
                    <span className="font-mono text-[12px] font-medium truncate">
                      {t.apiName}
                    </span>
                    {t.description && (
                      <span className="line-clamp-2 text-[11px] text-muted-foreground">
                        {t.description}
                      </span>
                    )}
                  </label>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </Card>
  );
}
