import { useMemo, useState } from 'react';
import { Bot, Pencil, Plus, Trash2 } from 'lucide-react';
import { isAxiosError } from 'axios';

import { Button } from '@/presentation/components/ui/Button';
import { Badge } from '@/presentation/components/ui/Badge';
import { Card, CardContent } from '@/presentation/components/ui/Card';
import { useUserAgents, useDeleteUserAgent } from '@/presentation/hooks/userAgents/useUserAgents';
import { useModels } from '@/presentation/hooks/models/useModels';
import type { UserAgent } from '@/domain/types/userAgent.types';
import { AgentFormDialog } from './AgentFormDialog';

/**
 * Settings → Agents. Lists the user's reusable agent definitions and
 * lets them be created / edited / deleted. Flows reference these by
 * `apiName` inside the YAML editor.
 */
export default function AgentsView() {
  const { data: agents = [], isLoading } = useUserAgents();
  const { data: models = [] } = useModels();
  const deleteAgent = useDeleteUserAgent();

  const [editing, setEditing] = useState<UserAgent | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Resolve userModelId → model.displayName once for the whole list.
  const modelById = useMemo(
    () => new Map(models.map((m) => [m.id, m])),
    [models],
  );

  function handleCreate() {
    setEditing(null);
    setDialogOpen(true);
  }

  function handleEdit(agent: UserAgent) {
    setEditing(agent);
    setDialogOpen(true);
  }

  async function handleDelete(agent: UserAgent) {
    setDeleteError(null);
    if (!window.confirm(`Delete "${agent.displayName}"? Flows still referencing it will refuse the delete.`)) {
      return;
    }
    try {
      await deleteAgent.mutateAsync(agent.id);
    } catch (err) {
      // 409 = a flow_node still references this agent (FK ON DELETE RESTRICT).
      if (isAxiosError(err) && err.response?.status === 409) {
        setDeleteError(
          `"${agent.displayName}" is referenced by one or more flows. Remove or re-point those nodes first.`,
        );
        return;
      }
      setDeleteError("Couldn't delete — please try again.");
    }
  }

  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Agents</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Reusable agent definitions. Reference them from your flow YAML by their api_name.
          </p>
        </div>
        <Button onClick={handleCreate} size="sm">
          <Plus size={16} aria-hidden="true" />
          New agent
        </Button>
      </div>

      {deleteError && (
        <Card className="mb-4">
          <CardContent className="py-3">
            <p role="alert" className="text-sm text-destructive">{deleteError}</p>
          </CardContent>
        </Card>
      )}

      {isLoading ? (
        <p className="text-muted-foreground text-sm">Loading agents…</p>
      ) : agents.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <Bot size={40} className="mx-auto mb-3 opacity-30" aria-hidden="true" />
          <p>No agents yet. Create one and use it inside a flow.</p>
        </div>
      ) : (
        <ul className="space-y-3 list-none" role="list">
          {agents.map((a) => {
            const model = modelById.get(a.userModelId);
            return (
              <li key={a.id}>
                <Card>
                  <CardContent className="py-4">
                    <div className="flex items-start justify-between gap-3">
                      <button
                        type="button"
                        onClick={() => handleEdit(a)}
                        className="flex-1 text-left"
                      >
                        <div className="flex flex-wrap items-center gap-2 mb-1">
                          <p className="font-medium">{a.displayName}</p>
                          <span className="font-mono text-[11px] text-muted-foreground">
                            {a.apiName}
                          </span>
                          {model && (
                            <Badge variant="secondary">
                              {model.displayName}
                            </Badge>
                          )}
                        </div>
                        {a.description && (
                          <p className="text-xs text-muted-foreground">{a.description}</p>
                        )}
                        <div className="flex flex-wrap items-center gap-1 mt-1">
                          {a.emits.length === 0 ? (
                            <span className="text-[11px] text-muted-foreground italic">no emits (leaf node)</span>
                          ) : (
                            a.emits.map((emit) => (
                              <Badge key={emit} variant="outline" className="font-mono text-[10.5px]">
                                {emit}
                              </Badge>
                            ))
                          )}
                        </div>
                      </button>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleEdit(a)}
                          aria-label={`Edit ${a.displayName}`}
                        >
                          <Pencil size={16} aria-hidden="true" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(a)}
                          aria-label={`Delete ${a.displayName}`}
                        >
                          <Trash2 size={16} aria-hidden="true" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </li>
            );
          })}
        </ul>
      )}

      <AgentFormDialog
        agent={editing}
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) setEditing(null);
        }}
      />
    </div>
  );
}
