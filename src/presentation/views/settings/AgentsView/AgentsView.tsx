import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Bot, Pencil, Plus, Trash2 } from 'lucide-react';
import { isAxiosError } from 'axios';

import { Button } from '@/presentation/components/ui/Button';
import { Badge } from '@/presentation/components/ui/Badge';
import { Card, CardContent } from '@/presentation/components/ui/Card';
import { useUserAgents, useDeleteUserAgent } from '@/presentation/hooks/userAgents/useUserAgents';
import { useModels } from '@/presentation/hooks/models/useModels';
import { useFlows } from '@/presentation/hooks/flows/useFlows';
import type { UserAgent } from '@/domain/types/userAgent.types';
import type { Flow } from '@/domain/types/flow.types';
import { ROUTES } from '@/constants/routes';

/**
 * Settings → Agents. Lists reusable agent definitions. Create + edit
 * happen on a dedicated full-page route (:file:`AgentEditorView.tsx`)
 * so long fields (system prompt textarea, chip inputs) have room to
 * breathe. Delete is inline with a confirm + 409 handling.
 */
export default function AgentsView() {
  const { data: agents = [], isLoading } = useUserAgents();
  const { data: models = [] } = useModels();
  const { data: flows = [] } = useFlows();
  const deleteAgent = useDeleteUserAgent();

  const [deleteError, setDeleteError] = useState<string | null>(null);

  const modelById = useMemo(
    () => new Map(models.map((m) => [m.id, m])),
    [models],
  );

  // Bucket flows by every agent they reference. A flow that uses the
  // same agent on multiple nodes only counts once per agent (dedupe by
  // flow.id) — the pill is "which flows depend on this agent", not
  // "how many nodes". Listed here rather than asked from the BE because
  // the data is already loaded for the Flows page and the lookup is
  // O(flows × nodes), tiny in practice.
  const flowsByAgentId = useMemo(() => {
    const map = new Map<string, Flow[]>();
    for (const flow of flows) {
      const seen = new Set<string>();
      for (const node of flow.nodes) {
        if (seen.has(node.userAgentId)) continue;
        seen.add(node.userAgentId);
        const bucket = map.get(node.userAgentId) ?? [];
        bucket.push(flow);
        map.set(node.userAgentId, bucket);
      }
    }
    return map;
  }, [flows]);

  function editPath(id: string): string {
    return ROUTES.SETTINGS_AGENT_EDITOR.replace(':agentId', id);
  }

  function flowEditPath(id: string): string {
    return ROUTES.SETTINGS_FLOW_EDITOR.replace(':flowId', id);
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
    <div className="p-4 md:p-8 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Agents</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Reusable agent definitions. Reference them from your flow YAML by their api_name.
          </p>
        </div>
        <Button asChild size="sm">
          <Link to={ROUTES.SETTINGS_AGENT_EDITOR_NEW}>
            <Plus size={16} aria-hidden="true" />
            New agent
          </Link>
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
        <ul className="grid grid-cols-1 md:grid-cols-2 gap-3 list-none p-0" role="list">
          {agents.map((a) => {
            const model = modelById.get(a.userModelId);
            const usedByFlows = flowsByAgentId.get(a.id) ?? [];
            return (
              <li key={a.id}>
                <Card>
                  <CardContent className="py-4">
                    <div className="flex items-start justify-between gap-3">
                      <Bot
                        size={22}
                        className="shrink-0 mt-0.5 text-muted-foreground"
                        aria-hidden="true"
                      />
                      <div className="flex-1 min-w-0">
                        {/* Row 1 — name + apiName. Wrapped in the
                            card-wide Link so the heading routes to the
                            agent editor. */}
                        <Link
                          to={editPath(a.id)}
                          className="block text-foreground no-underline hover:opacity-80"
                        >
                          <div className="flex flex-wrap items-baseline gap-2 mb-1">
                            <p className="font-medium">{a.displayName}</p>
                            <span className="font-mono text-[11px] text-muted-foreground">
                              {a.apiName}
                            </span>
                          </div>
                        </Link>
                        {/* Row 2 — Description. Always rendered (with
                            "no description" fallback) so the grid's
                            card heights stay consistent. */}
                        <div className="flex flex-wrap items-baseline gap-1.5 mt-1.5">
                          <span className="text-xs font-semibold text-foreground">Description :</span>
                          {a.description ? (
                            <span className="text-xs text-muted-foreground">{a.description}</span>
                          ) : (
                            <span className="text-xs text-muted-foreground italic">no description</span>
                          )}
                        </div>
                        {/* Row 3 — Model. Emerald static pill. */}
                        <div className="flex flex-wrap items-baseline gap-1.5 mt-1.5">
                          <span className="text-xs font-semibold text-foreground">Model :</span>
                          {model ? (
                            <Badge className="border-transparent bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 font-mono text-[10.5px]">
                              {model.modelName}
                            </Badge>
                          ) : (
                            <span className="text-xs text-muted-foreground italic">unknown</span>
                          )}
                        </div>
                        {/* Row 4 — Emits. Emerald static pills. */}
                        <div className="flex flex-wrap items-baseline gap-1.5 mt-1.5">
                          <span className="text-xs font-semibold text-foreground">Emits :</span>
                          {a.emits.length === 0 ? (
                            <span className="text-xs text-muted-foreground italic">no emits (leaf node)</span>
                          ) : (
                            a.emits.map((emit) => (
                              <Badge
                                key={emit}
                                className="border-transparent bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 font-mono text-[10.5px]"
                              >
                                {emit}
                              </Badge>
                            ))
                          )}
                        </div>
                        {/* Row 5 — Flows referencing this agent.
                            Theme-primary clickable buttons — matches the
                            app-wide "buttons are theme-colored" language.
                            Outside the card-wide Link because each pill is
                            its own anchor (HTML disallows nested <a>). */}
                        <div className="flex flex-wrap items-baseline gap-1.5 mt-1.5">
                          <span className="text-xs font-semibold text-foreground">Flows :</span>
                          {usedByFlows.length === 0 ? (
                            <span className="text-xs text-muted-foreground italic">no flows</span>
                          ) : (
                            usedByFlows.map((flow) => (
                              <Link
                                key={flow.id}
                                to={flowEditPath(flow.id)}
                                className="no-underline"
                                title={`Open flow “${flow.displayName}”`}
                              >
                                <Badge
                                  className="border-transparent rounded-md px-2.5 py-1 bg-primary text-primary-foreground hover:bg-primary/90 active:bg-primary/80 shadow-sm hover:shadow active:scale-[0.97] transition-all font-mono text-[10.5px]"
                                >
                                  {flow.apiName}
                                </Badge>
                              </Link>
                            ))
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button
                          asChild
                          variant="ghost"
                          size="icon"
                          aria-label={`Edit ${a.displayName}`}
                        >
                          <Link to={editPath(a.id)}>
                            <Pencil size={16} aria-hidden="true" />
                          </Link>
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
    </div>
  );
}
