import { useState } from 'react';
import { Plus, Trash2, Settings } from 'lucide-react';
import { useModels, useRegisterModel, useDeleteModel } from '@/presentation/hooks/models/useModels';
import { useProviders } from '@/presentation/hooks/providers/useProviders';
import { formatCostPerMillion } from '@/domain/utils/formatCost';
import { Button } from '@/presentation/components/ui/Button';
import { Input } from '@/presentation/components/ui/Input';
import { Label } from '@/presentation/components/ui/Label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/presentation/components/ui/Card';

export default function ModelsView() {
  const { data: models = [], isLoading } = useModels();
  const { data: providers = [] } = useProviders();
  const registerModel = useRegisterModel();
  const deleteModel = useDeleteModel();

  const [showForm, setShowForm] = useState(false);
  const [providerId, setProviderId] = useState('');
  const [modelId, setModelId] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [inputCost, setInputCost] = useState('');
  const [outputCost, setOutputCost] = useState('');
  const [formError, setFormError] = useState('');

  async function handleRegister() {
    setFormError('');
    if (!providerId || !modelId || !displayName) { setFormError('All fields are required.'); return; }
    try {
      await registerModel.mutateAsync({
        userProviderId: providerId,
        modelId,
        displayName,
        costPerInputToken: parseFloat(inputCost) || 0,
        costPerOutputToken: parseFloat(outputCost) || 0,
      });
      setShowForm(false);
      setModelId(''); setDisplayName(''); setInputCost(''); setOutputCost('');
    } catch {
      setFormError('Failed to register model.');
    }
  }

  return (
    <div className="p-4 md:p-8 max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Models</h1>
          <p className="text-muted-foreground text-sm mt-1">Register models with per-token pricing for cost tracking.</p>
        </div>
        <Button onClick={() => setShowForm(!showForm)} size="sm" disabled={providers.length === 0}>
          <Plus size={16} aria-hidden="true" />
          Register model
        </Button>
      </div>

      {providers.length === 0 && (
        <p className="text-sm text-muted-foreground mb-4">Add a provider first before registering models.</p>
      )}

      {showForm && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-base">Register model</CardTitle>
            <CardDescription>Set the pricing in USD per token.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="provider-id">Provider</Label>
                <select
                  id="provider-id"
                  value={providerId}
                  onChange={(e) => setProviderId(e.target.value)}
                  className="flex h-11 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="">Select provider…</option>
                  {providers.map((p) => (
                    <option key={p.id} value={p.id}>{p.providerName} ({p.id.slice(0,8)}…)</option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="model-id">Model ID</Label>
                <Input id="model-id" placeholder="claude-sonnet-4-6" value={modelId} onChange={(e) => setModelId(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="display-name">Display name</Label>
                <Input id="display-name" placeholder="Claude Sonnet" value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="input-cost">Input cost ($/token)</Label>
                <Input id="input-cost" type="number" step="0.000001" placeholder="0.000003" value={inputCost} onChange={(e) => setInputCost(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="output-cost">Output cost ($/token)</Label>
                <Input id="output-cost" type="number" step="0.000001" placeholder="0.000015" value={outputCost} onChange={(e) => setOutputCost(e.target.value)} />
              </div>
            </div>
            {formError && <p role="alert" className="text-sm text-destructive">{formError}</p>}
            <div className="flex gap-2">
              <Button onClick={handleRegister} disabled={registerModel.isPending}>
                {registerModel.isPending ? 'Saving…' : 'Save model'}
              </Button>
              <Button variant="ghost" onClick={() => setShowForm(false)}>Cancel</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {isLoading ? (
        <p className="text-muted-foreground text-sm">Loading models…</p>
      ) : models.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <Settings size={40} className="mx-auto mb-3 opacity-30" aria-hidden="true" />
          <p>No models registered yet.</p>
        </div>
      ) : (
        <ul className="space-y-3 list-none" role="list">
          {models.map((m) => (
            <li key={m.id}>
              <Card>
                <CardContent className="flex items-center justify-between py-4">
                  <div>
                    <p className="font-medium">{m.displayName}</p>
                    <p className="text-xs text-muted-foreground">{m.modelId}</p>
                    <p className="text-xs text-muted-foreground">
                      In: {formatCostPerMillion(m.costPerInputToken)} · Out: {formatCostPerMillion(m.costPerOutputToken)}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => deleteModel.mutate(m.id)}
                    aria-label={`Remove model ${m.displayName}`}
                  >
                    <Trash2 size={16} aria-hidden="true" />
                  </Button>
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
