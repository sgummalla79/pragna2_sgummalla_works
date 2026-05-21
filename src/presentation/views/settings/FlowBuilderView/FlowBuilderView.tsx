import { useState } from 'react';
import { Plus, Trash2, GitBranch, Sparkles } from 'lucide-react';
import {
  useFlows,
  useCreateFlow,
  useDeleteFlow,
  useAddFlowNode,
  useAddFlowEdge,
} from '@/presentation/hooks/flows/useFlows';
import { useModels } from '@/presentation/hooks/models/useModels';
import { FEATURE_FLOW_BUILDER } from '@/constants/api';
import { EDGE_CONDITIONS } from '@/constants/edgeConditions';
import { Button } from '@/presentation/components/ui/Button';
import { Input } from '@/presentation/components/ui/Input';
import { Label } from '@/presentation/components/ui/Label';
import { Badge } from '@/presentation/components/ui/Badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/presentation/components/ui/Card';

/** Sample flow constants — kept inline so the seed payload is one diff. */
const SAMPLE_FLOW_NAME = 'research-helper';
const SAMPLE_FLOW_DESCRIPTION =
  'Single-node sample flow seeded so the R2 agent picker has a second agent to pick. Replace with a real multi-node flow when the visual builder ships in R3.';
const SAMPLE_NODE_ID = 'researcher';
const SAMPLE_AGENT_TYPE = 'researcher';
const FLOW_NODE_START = '__start__';
const FLOW_NODE_END = '__end__';

export default function FlowBuilderView() {
  const { data: flows = [], isLoading } = useFlows();
  const { data: models = [] } = useModels();
  const createFlow = useCreateFlow();
  const deleteFlow = useDeleteFlow();
  const addNode = useAddFlowNode();
  const addEdge = useAddFlowEdge();

  const [showForm, setShowForm] = useState(false);
  const [flowName, setFlowName] = useState('');
  const [flowDescription, setFlowDescription] = useState('');
  const [formError, setFormError] = useState('');
  const [sampleError, setSampleError] = useState('');
  const [sampleBusy, setSampleBusy] = useState(false);

  // The sample flow needs a model the user has explicitly opted into for
  // flows (matching the runtime predicate in FlowRegistry). If they haven't
  // toggled "Flows" on any model yet, the button is disabled with a hint.
  const firstFlowsModel = models.find(
    (m) => m.enabled && !m.archived && m.availableForFlows,
  );

  // Don't offer to seed the sample twice — if a flow with the canonical
  // name already exists, the button instead becomes a quiet status badge.
  const sampleAlreadyExists = flows.some((f) => f.name === SAMPLE_FLOW_NAME);

  async function handleCreateSample() {
    setSampleError('');
    if (!firstFlowsModel) {
      setSampleError(
        'Enable at least one model for "Flows" in Settings → Providers before seeding the sample.',
      );
      return;
    }
    setSampleBusy(true);
    try {
      // Three-step build: create flow → add one node → add the boundary
      // edges (__start__ → node → __end__) so LangGraph has an entry and
      // exit point. Anything less and FlowBuilder.build() throws and
      // FlowRegistry quietly skips the flow.
      const flow = await createFlow.mutateAsync({
        name: SAMPLE_FLOW_NAME,
        description: SAMPLE_FLOW_DESCRIPTION,
      });
      await addNode.mutateAsync({
        flowId: flow.id,
        payload: {
          nodeId: SAMPLE_NODE_ID,
          agentType: SAMPLE_AGENT_TYPE,
          userModelId: firstFlowsModel.id,
        },
      });
      await addEdge.mutateAsync({
        flowId: flow.id,
        payload: {
          fromNode: FLOW_NODE_START,
          toNode: SAMPLE_NODE_ID,
          condition: EDGE_CONDITIONS.DEFAULT,
        },
      });
      await addEdge.mutateAsync({
        flowId: flow.id,
        payload: {
          fromNode: SAMPLE_NODE_ID,
          toNode: FLOW_NODE_END,
          condition: EDGE_CONDITIONS.DEFAULT,
        },
      });
    } catch (e) {
      setSampleError(
        e instanceof Error
          ? `Couldn't seed the sample flow: ${e.message}`
          : "Couldn't seed the sample flow.",
      );
    } finally {
      setSampleBusy(false);
    }
  }

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
    if (!flowName.trim()) { setFormError('Flow name is required.'); return; }
    try {
      await createFlow.mutateAsync({ name: flowName.trim(), description: flowDescription.trim() || undefined });
      setShowForm(false);
      setFlowName(''); setFlowDescription('');
    } catch {
      setFormError('Failed to create flow. Name may already be in use.');
    }
  }

  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Flows</h1>
          <p className="text-muted-foreground text-sm mt-1">Multi-agent pipelines — configure nodes and edges.</p>
        </div>
        <div className="flex items-center gap-2">
          {/* Sample-flow shortcut — exposes the R2 agent picker without
              requiring the visual node/edge builder (R3). Hidden once the
              seeded flow exists so it doesn't double-create. */}
          {!sampleAlreadyExists && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleCreateSample}
              disabled={sampleBusy || !firstFlowsModel}
              title={
                firstFlowsModel
                  ? `Seeds a "${SAMPLE_FLOW_NAME}" flow using ${firstFlowsModel.displayName}`
                  : 'Enable a model for Flows first (Settings → Providers)'
              }
            >
              <Sparkles size={16} aria-hidden="true" />
              {sampleBusy ? 'Seeding…' : 'Create sample flow'}
            </Button>
          )}
          <Button onClick={() => setShowForm(!showForm)} size="sm">
            <Plus size={16} aria-hidden="true" />
            New flow
          </Button>
        </div>
      </div>

      {sampleError && (
        <Card className="mb-4">
          <CardContent className="py-3">
            <p role="alert" className="text-sm text-destructive">{sampleError}</p>
          </CardContent>
        </Card>
      )}

      {showForm && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-base">Create flow</CardTitle>
            <CardDescription>A flow is a directed graph of agent nodes.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="flow-name">Flow name</Label>
                <Input id="flow-name" placeholder="research-pipeline" value={flowName} onChange={(e) => setFlowName(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="flow-desc">Description (optional)</Label>
                <Input id="flow-desc" placeholder="Research with quality review" value={flowDescription} onChange={(e) => setFlowDescription(e.target.value)} />
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
          <p>No flows yet. Create one to build a multi-agent pipeline.</p>
        </div>
      ) : (
        <ul className="space-y-3 list-none" role="list">
          {flows.map((f) => (
            <li key={f.id}>
              <Card>
                <CardContent className="flex items-center justify-between py-4">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <p className="font-medium">{f.name}</p>
                      <Badge variant={f.enabled ? 'default' : 'secondary'}>{f.enabled ? 'Enabled' : 'Disabled'}</Badge>
                    </div>
                    {f.description && <p className="text-xs text-muted-foreground">{f.description}</p>}
                    <p className="text-xs text-muted-foreground mt-0.5">{f.nodes.length} nodes · {f.edges.length} edges</p>
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => deleteFlow.mutate(f.id)} aria-label={`Delete flow ${f.name}`}>
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
