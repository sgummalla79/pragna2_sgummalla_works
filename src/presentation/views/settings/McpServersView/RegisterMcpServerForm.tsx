/**
 * MCP server registration form (Wedge B.2).
 *
 * v1 supports HTTP-SSE only; the transport selector is rendered (so
 * the affordance shape is there for Wedge B.3 stdio) but locked to
 * `http`. The credentials block is an editable header dictionary —
 * users typically need an `Authorization: Bearer …` row.
 */

import { useEffect, useState, type FormEvent } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/presentation/components/ui/Button';
import { Input } from '@/presentation/components/ui/Input';
import { Label } from '@/presentation/components/ui/Label';
import { useRegisterMcpServer } from '@/presentation/hooks/mcp-servers/useMcpServers';
import type { RegisteredMcpServer } from '@/domain/types/mcp.types';

interface HeaderRow {
  /** Stable id so React can key rows across renders even when key
   *  values change. */
  rid: number;
  key: string;
  value: string;
}

interface Props {
  onRegistered: (result: RegisteredMcpServer) => void;
  onCancel: () => void;
  /**
   * Fires `true` once any field has been touched (display name, URL,
   * or a header row with content), `false` when the form clears or
   * unmounts. The parent uses this to arm the modal's
   * unsaved-changes guard so Escape / overlay-click can't silently
   * discard a typed-but-not-yet-submitted bearer token.
   */
  onDirtyChange?: (dirty: boolean) => void;
}

let _rowSeq = 0;
function newRow(): HeaderRow {
  _rowSeq += 1;
  return { rid: _rowSeq, key: '', value: '' };
}

export function RegisterMcpServerForm({ onRegistered, onCancel, onDirtyChange }: Props) {
  const [displayName, setDisplayName] = useState('');
  const [url, setUrl] = useState('');
  const [headers, setHeaders] = useState<HeaderRow[]>([newRow()]);
  const [error, setError] = useState<string | null>(null);

  const register = useRegisterMcpServer();

  // Derived dirty signal — any field touched OR any header row with
  // non-empty key/value. Trim so a single accidental space doesn't
  // register as dirty. Headers are checked field-by-field rather than
  // counting rows because the initial `[newRow()]` state is one empty
  // row by design (so the "Add header" button isn't lonely on open).
  const isDirty =
    displayName.trim().length > 0 ||
    url.trim().length > 0 ||
    headers.some((r) => r.key.trim().length > 0 || r.value.length > 0);

  useEffect(() => {
    onDirtyChange?.(isDirty);
    // Always notify `false` on unmount so the parent's guard releases
    // its beforeunload listener even if the form was forcibly closed.
    return () => onDirtyChange?.(false);
  }, [isDirty, onDirtyChange]);

  function addHeaderRow() {
    setHeaders((h) => [...h, newRow()]);
  }
  function updateHeaderRow(rid: number, patch: Partial<HeaderRow>) {
    setHeaders((h) => h.map((r) => (r.rid === rid ? { ...r, ...patch } : r)));
  }
  function removeHeaderRow(rid: number) {
    setHeaders((h) => (h.length === 1 ? [newRow()] : h.filter((r) => r.rid !== rid)));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    const trimmedName = displayName.trim();
    const trimmedUrl = url.trim();
    if (!trimmedName) {
      setError('Display name is required.');
      return;
    }
    if (!trimmedUrl) {
      setError('Server URL is required.');
      return;
    }

    // Collapse the rows into a `Record<string, string>`, dropping
    // empty rows so a stray blank entry doesn't override an existing
    // header by name.
    const headerObj: Record<string, string> = {};
    for (const r of headers) {
      const k = r.key.trim();
      if (k && r.value !== '') headerObj[k] = r.value;
    }
    const credentials =
      Object.keys(headerObj).length > 0 ? { headers: headerObj } : undefined;

    try {
      const result = await register.mutateAsync({
        displayName: trimmedName,
        transport: 'http',
        config: { url: trimmedUrl },
        credentials,
      });
      onRegistered(result);
    } catch (err) {
      // Surface BE validation errors verbatim (the FE doesn't know
      // every constraint).
      const detail =
        // axios error shape
        (err as { response?: { data?: { detail?: string } } })?.response?.data
          ?.detail ??
        (err instanceof Error ? err.message : 'Failed to register MCP server.');
      setError(String(detail));
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="mcp-display-name">Display name</Label>
        <Input
          id="mcp-display-name"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          placeholder="e.g. My Linear"
          autoFocus
          required
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label>Transport</Label>
        <div className="flex items-center gap-2">
          <input
            type="radio"
            id="mcp-transport-http"
            name="mcp-transport"
            checked
            readOnly
          />
          <label htmlFor="mcp-transport-http" className="text-sm">
            HTTP-SSE
          </label>
          <span className="ml-3 text-[11px] text-muted-foreground">
            (stdio coming soon — needs the operator allowlist to be
            populated first)
          </span>
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="mcp-url">Server URL</Label>
        <Input
          id="mcp-url"
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://your-mcp-server.example.com/sse"
          required
        />
        <p className="text-[11px] text-muted-foreground">
          The MCP server's SSE endpoint. We'll connect during registration
          to discover the tool list.
        </p>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label>Headers (optional)</Label>
        <p className="text-[11px] text-muted-foreground">
          Each row maps to a request header sent on every call to the
          server. Common: <code>Authorization: Bearer …</code>. Values are
          encrypted at rest.
        </p>
        <div className="flex flex-col gap-2">
          {headers.map((r) => (
            <div key={r.rid} className="flex items-center gap-2">
              <Input
                value={r.key}
                onChange={(e) => updateHeaderRow(r.rid, { key: e.target.value })}
                placeholder="Header name"
                className="flex-1"
              />
              <Input
                value={r.value}
                onChange={(e) =>
                  updateHeaderRow(r.rid, { value: e.target.value })
                }
                placeholder="Header value"
                type="password"
                autoComplete="off"
                className="flex-1"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => removeHeaderRow(r.rid)}
                aria-label="Remove header"
              >
                <Trash2 size={14} aria-hidden="true" />
              </Button>
            </div>
          ))}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={addHeaderRow}
            className="self-start"
          >
            <Plus size={12} aria-hidden="true" className="mr-1" />
            Add header
          </Button>
        </div>
      </div>

      {error && (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-[12px] text-destructive">
          {error}
        </div>
      )}

      <div className="flex justify-end gap-2 pt-2">
        <Button
          type="button"
          variant="ghost"
          onClick={onCancel}
          disabled={register.isPending}
        >
          Cancel
        </Button>
        <Button type="submit" disabled={register.isPending}>
          {register.isPending ? 'Registering…' : 'Register + discover tools'}
        </Button>
      </div>
    </form>
  );
}
