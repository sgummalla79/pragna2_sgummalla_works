import { Link } from 'react-router-dom';
import { Plus, Trash2, GitBranch, Pencil } from 'lucide-react';
import { useFlows, useDeleteFlow } from '@/presentation/hooks/flows/useFlows';
import { FEATURE_FLOW_BUILDER } from '@/constants/api';
import { ROUTES } from '@/constants/routes';
import { Button } from '@/presentation/components/ui/Button';
import { Badge } from '@/presentation/components/ui/Badge';
import { Card, CardContent } from '@/presentation/components/ui/Card';

/**
 * Flow listing. Authoring lives in the YAML editor at
 * /settings/flows/new and /settings/flows/:flowId/edit (R3.7+).
 */
export default function FlowBuilderView() {
  const { data: flows = [], isLoading } = useFlows();
  const deleteFlow = useDeleteFlow();

  if (!FEATURE_FLOW_BUILDER) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        <GitBranch size={40} className="mx-auto mb-3 opacity-30" aria-hidden="true" />
        <p>Flow builder is not enabled.</p>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Flows</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Multi-agent pipelines authored in YAML.
          </p>
        </div>
        <Button asChild size="sm">
          <Link to={ROUTES.SETTINGS_FLOW_EDITOR_NEW}>
            <Plus size={16} aria-hidden="true" />
            New flow
          </Link>
        </Button>
      </div>

      {isLoading ? (
        <p className="text-muted-foreground text-sm">Loading flows…</p>
      ) : flows.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <GitBranch size={40} className="mx-auto mb-3 opacity-30" aria-hidden="true" />
          <p>No flows yet. Create one to author a multi-agent pipeline.</p>
        </div>
      ) : (
        <ul className="space-y-3 list-none" role="list">
          {flows.map((f) => {
            const editPath = ROUTES.SETTINGS_FLOW_EDITOR.replace(':flowId', f.id);
            return (
              <li key={f.id}>
                <Card>
                  <CardContent className="flex items-center justify-between py-4">
                    <Link
                      to={editPath}
                      className="flex-1 no-underline text-foreground hover:opacity-80"
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <p className="font-medium">{f.displayName}</p>
                        <Badge variant={f.enabled ? 'default' : 'secondary'}>
                          {f.enabled ? 'Enabled' : 'Disabled'}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">{f.apiName}</p>
                      {f.description && (
                        <p className="text-xs text-muted-foreground mt-0.5">{f.description}</p>
                      )}
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {f.nodes.length} nodes · {f.edges.length} edges
                      </p>
                    </Link>
                    <div className="flex items-center gap-1 ml-2">
                      <Button
                        asChild
                        variant="ghost"
                        size="icon"
                        aria-label={`Edit ${f.displayName}`}
                      >
                        <Link to={editPath}>
                          <Pencil size={16} aria-hidden="true" />
                        </Link>
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => deleteFlow.mutate(f.id)}
                        aria-label={`Delete flow ${f.displayName}`}
                      >
                        <Trash2 size={16} aria-hidden="true" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
