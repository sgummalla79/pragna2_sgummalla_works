import { useState } from 'react';
import { Plus, Trash2, Cpu } from 'lucide-react';
import { useProviders, useCreateProvider, useDeleteProvider } from '@/presentation/hooks/providers/useProviders';
import { PROVIDER_LABELS, PROVIDER_NAMES } from '@/constants/providers';
import type { ProviderKind } from '@/domain/types/provider.types';
import { Button } from '@/presentation/components/ui/Button';
import { Input } from '@/presentation/components/ui/Input';
import { Label } from '@/presentation/components/ui/Label';
import { Badge } from '@/presentation/components/ui/Badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/presentation/components/ui/Card';

export default function ProvidersView() {
  const { data: providers = [], isLoading } = useProviders();
  const createProvider = useCreateProvider();
  const deleteProvider = useDeleteProvider();

  const [showForm, setShowForm] = useState(false);
  const [providerName, setProviderName] = useState<ProviderKind>('anthropic');
  const [apiKey, setApiKey] = useState('');
  const [formError, setFormError] = useState('');

  async function handleAdd() {
    setFormError('');
    if (!apiKey.trim()) { setFormError('API key is required.'); return; }
    try {
      await createProvider.mutateAsync({ providerName, apiKey: apiKey.trim() });
      setShowForm(false);
      setApiKey('');
    } catch {
      setFormError('Failed to register provider. Check your key and try again.');
    }
  }

  return (
    <div className="p-4 md:p-8 max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">LLM Providers</h1>
          <p className="text-muted-foreground text-sm mt-1">Register your API keys (BYOK). Keys are encrypted at rest.</p>
        </div>
        <Button onClick={() => setShowForm(!showForm)} size="sm">
          <Plus size={16} aria-hidden="true" />
          Add provider
        </Button>
      </div>

      {showForm && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-base">Register new provider</CardTitle>
            <CardDescription>Your key is sent once and never displayed again.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="provider-select">Provider</Label>
              <select
                id="provider-select"
                value={providerName}
                onChange={(e) => setProviderName(e.target.value as ProviderKind)}
                className="flex h-11 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-brand-ring)]"
              >
                {Object.values(PROVIDER_NAMES).map((name) => (
                  <option key={name} value={name}>{PROVIDER_LABELS[name]}</option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="api-key">API Key</Label>
              <Input id="api-key" type="password" placeholder="sk-…" value={apiKey} onChange={(e) => setApiKey(e.target.value)} />
            </div>
            {formError && <p role="alert" className="text-sm text-destructive">{formError}</p>}
            <div className="flex gap-2">
              <Button onClick={handleAdd} disabled={createProvider.isPending}>
                {createProvider.isPending ? 'Saving…' : 'Save provider'}
              </Button>
              <Button variant="ghost" onClick={() => { setShowForm(false); setApiKey(''); }}>Cancel</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {isLoading ? (
        <p className="text-muted-foreground text-sm">Loading providers…</p>
      ) : providers.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <Cpu size={40} className="mx-auto mb-3 opacity-30" aria-hidden="true" />
          <p>No providers registered yet.</p>
        </div>
      ) : (
        <ul className="space-y-3 list-none" role="list">
          {providers.map((p) => (
            <li key={p.id}>
              <Card>
                <CardContent className="flex items-center justify-between py-4">
                  <div className="flex items-center gap-3">
                    <Cpu size={20} className="text-muted-foreground" aria-hidden="true" />
                    <div>
                      <p className="font-medium">{PROVIDER_LABELS[p.providerName] ?? p.providerName}</p>
                      <p className="text-xs text-muted-foreground">ID: {p.id.slice(0, 8)}…</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={p.enabled ? 'default' : 'secondary'}>{p.enabled ? 'Active' : 'Disabled'}</Badge>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => deleteProvider.mutate(p.id)}
                      aria-label={`Remove ${PROVIDER_LABELS[p.providerName]} provider`}
                    >
                      <Trash2 size={16} aria-hidden="true" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
