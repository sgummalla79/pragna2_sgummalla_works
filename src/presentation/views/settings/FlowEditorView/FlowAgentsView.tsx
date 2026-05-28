/**
 * Flow-scoped agents list — the "Agents" surface, now nested UNDER a
 * flow (route `/settings/flows/:flowId/agents`).
 *
 * Agents are flow-owned (BE migration 0024): there is no global agent
 * list or standalone editor anymore. This is a read-only overview of the
 * agents declared in THIS flow's YAML; editing happens in the flow
 * editor's node panel, so each row links back into the editor.
 */

import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Pencil } from 'lucide-react';

import { useFlow } from '@/presentation/hooks/flows/useFlows';
import { Button } from '@/presentation/components/ui/Button';
import { ROUTES } from '@/constants/routes';
import { buildEditorGraph } from './buildEditorGraph';
import { type AgentNodeData, NODE_TYPE_AGENT } from './editorTypes';

export default function FlowAgentsView() {
  const { flowId = '' } = useParams<{ flowId: string }>();
  const { data: flow, isLoading } = useFlow(flowId);

  const editorPath = ROUTES.SETTINGS_FLOW_EDITOR.replace(':flowId', flowId);

  if (isLoading) {
    return <div className="p-8 text-sm text-muted-foreground">Loading flow…</div>;
  }

  const graph = flow?.definition ? buildEditorGraph(flow.definition) : null;
  const agents = (graph?.nodes ?? [])
    .filter((n) => n.type === NODE_TYPE_AGENT)
    .map((n) => n.data as AgentNodeData);

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div className="flex items-center gap-3">
          <Button asChild variant="ghost" size="icon" aria-label="Back to flow editor">
            <Link to={editorPath}>
              <ArrowLeft size={16} aria-hidden="true" />
            </Link>
          </Button>
          <div>
            <h1 className="text-base font-semibold">{flow?.displayName ?? 'Flow'} · Agents</h1>
            <p className="text-xs text-muted-foreground">
              Agents belong to this flow. Edit them in the flow editor's node panel.
            </p>
          </div>
        </div>
        <Button asChild size="sm" variant="outline">
          <Link to={editorPath}>Open editor</Link>
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {agents.length === 0 ? (
          <div className="rounded-md border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
            This flow has no agents yet. Open the editor and click "Add node" to create one.
          </div>
        ) : (
          <ul className="mx-auto max-w-3xl space-y-2" role="list">
            {agents.map((a) => (
              <li
                key={a.nodeId}
                className="flex items-center justify-between rounded-lg border border-border bg-card px-4 py-3"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{a.agent.displayName || a.agent.apiName}</span>
                    <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground">
                      {a.nodeId}
                    </code>
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                    <span className="rounded bg-muted px-1.5 py-0.5">{a.agent.userModel || 'no model'}</span>
                    {a.agent.emits.length > 0 && (
                      <span className="rounded bg-primary/15 px-1.5 py-0.5 text-primary">
                        emits: {a.agent.emits.join(', ')}
                      </span>
                    )}
                  </div>
                </div>
                <Button asChild variant="ghost" size="icon" aria-label={`Edit ${a.nodeId} in editor`}>
                  <Link to={editorPath}>
                    <Pencil size={15} aria-hidden="true" />
                  </Link>
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
