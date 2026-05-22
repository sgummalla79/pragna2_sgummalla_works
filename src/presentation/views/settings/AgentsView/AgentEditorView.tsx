import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Save } from 'lucide-react';
import { isAxiosError } from 'axios';

import { Button } from '@/presentation/components/ui/Button';
import { Input } from '@/presentation/components/ui/Input';
import { Label } from '@/presentation/components/ui/Label';
import { Textarea } from '@/presentation/components/ui/Textarea';
import {
  useCreateUserAgent,
  useUpdateUserAgent,
  useUserAgent,
} from '@/presentation/hooks/userAgents/useUserAgents';
import { useModels } from '@/presentation/hooks/models/useModels';
import type { UserAgent } from '@/domain/types/userAgent.types';
import { ROUTES } from '@/constants/routes';
import { ChipInput } from './ChipInput';

interface FormState {
  apiName: string;
  displayName: string;
  description: string;
  userModelId: string;
  systemPrompt: string;
  emits: string[];
  tools: string[];
}

const EMPTY: FormState = {
  apiName: '',
  displayName: '',
  description: '',
  userModelId: '',
  systemPrompt: '',
  emits: [],
  tools: [],
};

function agentToForm(agent: UserAgent | null | undefined): FormState {
  if (!agent) return { ...EMPTY };
  return {
    apiName: agent.apiName,
    displayName: agent.displayName,
    description: agent.description ?? '',
    userModelId: agent.userModelId,
    systemPrompt: agent.systemPrompt,
    emits: [...agent.emits],
    tools: [...agent.tools],
  };
}

/** Shallow equality for FormState — used to detect "dirty" state so
 *  Cancel can prompt before discarding edits. Arrays are compared by
 *  joined value (fine because chips are short strings). */
function isSameForm(a: FormState, b: FormState): boolean {
  return (
    a.apiName === b.apiName &&
    a.displayName === b.displayName &&
    a.description === b.description &&
    a.userModelId === b.userModelId &&
    a.systemPrompt === b.systemPrompt &&
    a.emits.join('|') === b.emits.join('|') &&
    a.tools.join('|') === b.tools.join('|')
  );
}

/**
 * Full-page user_agent editor — replaces the modal dialog so the form
 * has room to breathe (long system prompts, chip inputs, model picker).
 *
 * Routes:
 *   - `/settings/agents/new`             → create mode (params.agentId undefined)
 *   - `/settings/agents/:agentId/edit`   → edit mode
 *
 * Cancel behaviour: if the form is pristine → silent nav back to list.
 * If dirty → `window.confirm` before discarding. Route-blocking on
 * back-button / sidebar nav is intentionally NOT wired — parked for R6.
 */
export default function AgentEditorView() {
  const { agentId } = useParams<{ agentId?: string }>();
  const navigate = useNavigate();

  const { data: existingAgent, isLoading } = useUserAgent(agentId);
  const { data: models = [] } = useModels();
  const createAgent = useCreateUserAgent();
  const updateAgent = useUpdateUserAgent();

  const isEdit = Boolean(agentId);
  // Once seeded from the loaded agent, the baseline is what we compare
  // against to compute "dirty". It updates only on initial load + on
  // successful save (the latter happens by navigating away, so we don't
  // bother re-seeding here).
  const [baseline, setBaseline] = useState<FormState>(() => agentToForm(null));
  const [form, setForm] = useState<FormState>(() => agentToForm(null));
  const [formError, setFormError] = useState<string | null>(null);
  const [seeded, setSeeded] = useState(false);

  useEffect(() => {
    if (!isEdit) {
      // Create mode: seed once on mount.
      if (!seeded) {
        const empty = agentToForm(null);
        setBaseline(empty);
        setForm(empty);
        setSeeded(true);
      }
      return;
    }
    if (existingAgent && !seeded) {
      const seed = agentToForm(existingAgent);
      setBaseline(seed);
      setForm(seed);
      setSeeded(true);
    }
  }, [isEdit, existingAgent, seeded]);

  // Only models the user has flagged for flow use are eligible — agents
  // run inside the flow runtime, so they share the predicate with flow
  // nodes (provider.enabled AND model.enabled AND model.available_for_flows).
  const flowEligibleModels = useMemo(
    () => models.filter((m) => m.enabled && !m.archived && m.availableForFlows),
    [models],
  );

  const isPending = createAgent.isPending || updateAgent.isPending;
  const isDirty = !isSameForm(form, baseline);

  function handleCancel() {
    if (isDirty && !window.confirm('Discard unsaved changes?')) return;
    navigate(ROUTES.SETTINGS_AGENTS);
  }

  async function handleSave() {
    setFormError(null);

    if (!form.apiName.trim())     { setFormError('API name is required.'); return; }
    if (!form.displayName.trim()) { setFormError('Display name is required.'); return; }
    if (!form.userModelId)        { setFormError('Pick a model. Enable one for Flows first if the list is empty.'); return; }
    if (!form.systemPrompt.trim()) { setFormError('System prompt is required.'); return; }

    const payload = {
      apiName: form.apiName.trim(),
      displayName: form.displayName.trim(),
      description: form.description.trim() || null,
      userModelId: form.userModelId,
      systemPrompt: form.systemPrompt,
      emits: form.emits,
      tools: form.tools,
    };

    try {
      if (isEdit && existingAgent) {
        await updateAgent.mutateAsync({ id: existingAgent.id, payload });
      } else {
        await createAgent.mutateAsync(payload);
      }
      navigate(ROUTES.SETTINGS_AGENTS);
    } catch (err) {
      if (isAxiosError(err) && err.response?.status === 409) {
        setFormError(
          `An agent with api_name "${payload.apiName}" already exists. Pick a different api_name.`,
        );
        return;
      }
      setFormError("Couldn't save — please try again.");
    }
  }

  if (isEdit && isLoading) {
    return <div className="p-8 text-sm text-muted-foreground">Loading agent…</div>;
  }

  return (
    <div className="flex h-full flex-col">
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between border-b border-border bg-card px-4 py-3">
        <div className="flex items-center gap-3">
          <Button
            asChild
            variant="ghost"
            size="icon"
            aria-label="Back to agents"
          >
            <Link to={ROUTES.SETTINGS_AGENTS}>
              <ArrowLeft size={16} aria-hidden="true" />
            </Link>
          </Button>
          <div>
            <h1 className="text-base font-semibold">
              {isEdit
                ? existingAgent?.displayName ?? 'Edit agent'
                : 'New agent'}
            </h1>
            <p className="text-xs text-muted-foreground">
              Reusable agent definition. Flows reference it by api_name.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleCancel}
            disabled={isPending}
          >
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={() => void handleSave()}
            disabled={isPending || !isDirty}
            aria-busy={isPending}
          >
            <Save size={14} aria-hidden="true" />
            {isPending ? 'Saving…' : 'Save'}
          </Button>
        </div>
      </div>

      {/* ── Form ───────────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto p-4 md:p-8 space-y-6">

          <section className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="agent-api-name">API name</Label>
                <Input
                  id="agent-api-name"
                  placeholder="researcher"
                  value={form.apiName}
                  onChange={(e) => setForm({ ...form, apiName: e.target.value })}
                  disabled={isEdit}
                  aria-describedby="agent-api-name-hint"
                />
                <p id="agent-api-name-hint" className="text-[11px] text-muted-foreground">
                  URL-safe, unique. Used in YAML as{' '}
                  <code className="font-mono">agent: {form.apiName || 'researcher'}</code>.
                </p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="agent-display-name">Display name</Label>
                <Input
                  id="agent-display-name"
                  placeholder="Researcher"
                  value={form.displayName}
                  onChange={(e) => setForm({ ...form, displayName: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="agent-description">Description (optional)</Label>
              <Input
                id="agent-description"
                placeholder="Generates the primary draft."
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="agent-model">Model</Label>
              <select
                id="agent-model"
                value={form.userModelId}
                onChange={(e) => setForm({ ...form, userModelId: e.target.value })}
                className="flex h-11 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground"
              >
                <option value="">— pick a model —</option>
                {flowEligibleModels.map((m) => (
                  <option key={m.id} value={m.id}>{m.displayName}</option>
                ))}
              </select>
              {flowEligibleModels.length === 0 && (
                <p className="text-[11px] text-muted-foreground">
                  No models are enabled for Flows. Open Settings → Providers and toggle "Available for flows" on a model.
                </p>
              )}
            </div>
          </section>

          <section className="space-y-1.5">
            <Label htmlFor="agent-prompt">System prompt</Label>
            <Textarea
              id="agent-prompt"
              rows={14}
              placeholder={"You are a careful researcher.\nEnd your reply with <<emit:passed>> or <<emit:failed>>."}
              value={form.systemPrompt}
              onChange={(e) => setForm({ ...form, systemPrompt: e.target.value })}
              className="font-mono text-[12.5px]"
            />
          </section>

          <section className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="agent-emits">Emit labels</Label>
              <ChipInput
                id="agent-emits"
                label="emit"
                values={form.emits}
                onChange={(emits) => setForm({ ...form, emits })}
                placeholder="passed, failed (Enter to add)"
              />
              <p className="text-[11px] text-muted-foreground">
                Routing labels the agent may emit via <code>{'<<emit:NAME>>'}</code>. Empty = leaf node.
              </p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="agent-tools">Tools (optional)</Label>
              <ChipInput
                id="agent-tools"
                label="tool"
                values={form.tools}
                onChange={(tools) => setForm({ ...form, tools })}
                placeholder="skill api_names (Enter to add)"
              />
              <p className="text-[11px] text-muted-foreground">
                Skill <code>api_name</code>s the agent may invoke. R5 will plumb MCP servers through here.
              </p>
            </div>
          </section>

          {formError && (
            <p role="alert" className="text-sm text-destructive m-0">
              {formError}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
