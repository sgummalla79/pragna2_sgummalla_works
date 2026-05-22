import { useState } from 'react';
import { Plus, Trash2, GitBranch } from 'lucide-react';
import {
  useFlows,
  useCreateFlow,
  useDeleteFlow,
} from '@/presentation/hooks/flows/useFlows';
import { FEATURE_FLOW_BUILDER } from '@/constants/api';
import { Button } from '@/presentation/components/ui/Button';
import { Input } from '@/presentation/components/ui/Input';
import { Label } from '@/presentation/components/ui/Label';
import { Badge } from '@/presentation/components/ui/Badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/presentation/components/ui/Card';

/**
 * Flow listing + thin shell create-form. Adding nodes/edges from the UI
 * is intentionally not exposed yet — under the R3.5 YAML-first model,
 * nodes reference `user_agents` rows, and there is no user-agents UI to
 * pick from. Once R3.6 lands (YAML save flow) and R3.7 (YAML editor),
 * authoring moves into the YAML editor and this view becomes a list +
 * "open editor" launcher.
 */
export default function FlowBuilderView() {
  const { data: flows = [], isLoading } = useFlows();
  const createFlow = useCreateFlow();
  const deleteFlow = useDeleteFlow();

  const [showForm, setShowForm] = useState(false);
  const [apiName, setApiName] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [description, setDescription] = useState('');
  const [formError, setFormError] = useState('');

  if (!FEATURE_FLOW_BUILDER) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        <GitBranch size={40} className="mx-auto mb-3 opacity-30" aria-hidden="true" />
        <p>Flow builder is not enabled.</p>
      </div>
    );
  }

  async function handleCreate() {
    setFormError('');
    if (!apiName.trim()) { setFormError('API name is required.'); return; }
    if (!displayName.trim()) { setFormError('Display name is required.'); return; }
    try {
      await createFlow.mutateAsync({
        apiName: apiName.trim(),
        displayName: displayName.trim(),
        description: description.trim() || undefined,
      });
      setShowForm(false);
      setApiName(''); setDisplayName(''); setDescription('');
    } catch {
      setFormError('Failed to create flow. API name may already be in use.');
    }
  }

  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Flows</h1>
          <p className="text-muted-foreground text-sm mt-1">Multi-agent pipelines. YAML authoring lands in R3.7.</p>
        </div>
        <Button onClick={() => setShowForm(!showForm)} size="sm">
          <Plus size={16} aria-hidden="true" />
          New flow
        </Button>
      </div>

      {showForm && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-base">Create flow</CardTitle>
            <CardDescription>Topology and agents are authored later via YAML.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="flow-api-name">API name</Label>
                <Input
                  id="flow-api-name"
                  placeholder="research-pipeline"
                  value={apiName}
                  onChange={(e) => setApiName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="flow-display-name">Display name</Label>
                <Input
                  id="flow-display-name"
                  placeholder="Research Pipeline"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="flow-desc">Description (optional)</Label>
                <Input
                  id="flow-desc"
                  placeholder="Research with quality review"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>
            </div>
            {formError && <p role="alert" className="text-sm text-destructive">{formError}</p>}
            <div className="flex gap-2">
              <Button onClick={handleCreate} disabled={createFlow.isPending}>
                {createFlow.isPending ? 'Creating…' : 'Create flow'}
              </Button>
              <Button variant="ghost" onClick={() => setShowForm(false)}>Cancel</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {isLoading ? (
        <p className="text-muted-foreground text-sm">Loading flows…</p>
      ) : flows.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <GitBranch size={40} className="mx-auto mb-3 opacity-30" aria-hidden="true" />
          <p>No flows yet. Create one — node authoring lands when the YAML editor ships (R3.7).</p>
        </div>
      ) : (
        <ul className="space-y-3 list-none" role="list">
          {flows.map((f) => (
            <li key={f.id}>
              <Card>
                <CardContent className="flex items-center justify-between py-4">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <p className="font-medium">{f.displayName}</p>
                      <Badge variant={f.enabled ? 'default' : 'secondary'}>{f.enabled ? 'Enabled' : 'Disabled'}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">{f.apiName}</p>
                    {f.description && <p className="text-xs text-muted-foreground mt-0.5">{f.description}</p>}
                    <p className="text-xs text-muted-foreground mt-0.5">{f.nodes.length} nodes · {f.edges.length} edges</p>
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => deleteFlow.mutate(f.id)} aria-label={`Delete flow ${f.displayName}`}>
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
