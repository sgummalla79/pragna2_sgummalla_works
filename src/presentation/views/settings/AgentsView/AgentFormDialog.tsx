import { useEffect, useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { isAxiosError } from 'axios';

import { Button } from '@/presentation/components/ui/Button';
import { Input } from '@/presentation/components/ui/Input';
import { Label } from '@/presentation/components/ui/Label';
import { Textarea } from '@/presentation/components/ui/Textarea';
import { useModels } from '@/presentation/hooks/models/useModels';
import {
  useCreateUserAgent,
  useUpdateUserAgent,
} from '@/presentation/hooks/userAgents/useUserAgents';
import type { UserAgent } from '@/domain/types/userAgent.types';
import { ChipInput } from './ChipInput';

interface AgentFormDialogProps {
  /** When set the dialog opens in edit mode and pre-fills from this agent.
   *  When null the dialog is in create mode. */
  agent: UserAgent | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

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

/** Pulled into a function so create + edit reset on re-open from the same field state. */
function agentToForm(agent: UserAgent | null): FormState {
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

export function AgentFormDialog({ agent, open, onOpenChange }: AgentFormDialogProps) {
  const isEdit = agent !== null;
  const { data: models = [] } = useModels();
  const createAgent = useCreateUserAgent();
  const updateAgent = useUpdateUserAgent();

  const [form, setForm] = useState<FormState>(() => agentToForm(agent));
  const [formError, setFormError] = useState<string | null>(null);

  // Only models the user has flagged for flow use are eligible — agents
  // run inside the flow runtime, so they share the predicate with flow
  // nodes (provider.enabled AND model.enabled AND model.available_for_flows).
  const flowEligibleModels = models.filter(
    (m) => m.enabled && !m.archived && m.availableForFlows,
  );

  // Re-seed the form when the parent re-opens with a different agent
  // (e.g. clicking through several rows in the list without unmount).
  useEffect(() => {
    if (open) {
      setForm(agentToForm(agent));
      setFormError(null);
    }
  }, [open, agent]);

  const isPending = createAgent.isPending || updateAgent.isPending;

  async function handleSave() {
    setFormError(null);

    if (!form.apiName.trim()) { setFormError('API name is required.'); return; }
    if (!form.displayName.trim()) { setFormError('Display name is required.'); return; }
    if (!form.userModelId) { setFormError('Pick a model. Enable one for Flows first if the list is empty.'); return; }
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
      if (isEdit) {
        await updateAgent.mutateAsync({ id: agent.id, payload });
      } else {
        await createAgent.mutateAsync(payload);
      }
      onOpenChange(false);
    } catch (err) {
      // 409 = api_name collision (uq_user_agents_user_id_api_name).
      if (isAxiosError(err) && err.response?.status === 409) {
        setFormError(
          `An agent with api_name "${payload.apiName}" already exists. Pick a different api_name.`,
        );
        return;
      }
      setFormError("Couldn't save — please try again.");
    }
  }

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay
          className="fixed inset-0 z-[700] bg-black/60"
          style={{ backdropFilter: 'blur(4px)' }}
        />
        <Dialog.Content
          className="
            fixed left-1/2 top-1/2 z-[701] -translate-x-1/2 -translate-y-1/2
            w-[640px] max-w-[calc(100vw-32px)]
            max-h-[calc(100vh-48px)] overflow-y-auto
            flex flex-col gap-4
            rounded-[14px] border border-border
            bg-popover p-6
          "
          style={{ boxShadow: '0 24px 60px rgba(0,0,0,0.45)' }}
        >
          <Dialog.Title className="text-base font-bold text-foreground m-0">
            {isEdit ? `Edit ${agent.displayName}` : 'New agent'}
          </Dialog.Title>
          <Dialog.Description className="text-[13px] text-muted-foreground m-0 leading-relaxed">
            Reusable agent definition. Flows reference it by its api_name; editing here propagates to every flow that uses it.
          </Dialog.Description>

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
                URL-safe, unique. Used in YAML as <code className="font-mono">agent: {form.apiName || 'researcher'}</code>.
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
              className="flex h-11 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
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

          <div className="space-y-1.5">
            <Label htmlFor="agent-prompt">System prompt</Label>
            <Textarea
              id="agent-prompt"
              rows={8}
              placeholder={"You are a careful researcher.\nEnd your reply with <<emit:passed>> or <<emit:failed>>."}
              value={form.systemPrompt}
              onChange={(e) => setForm({ ...form, systemPrompt: e.target.value })}
              className="font-mono text-[12.5px]"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
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
          </div>

          {formError && (
            <p role="alert" className="text-[12px] text-destructive m-0">
              {formError}
            </p>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <Dialog.Close asChild>
              <Button variant="ghost" size="sm" disabled={isPending}>
                Cancel
              </Button>
            </Dialog.Close>
            <Button
              variant="default"
              size="sm"
              onClick={() => void handleSave()}
              disabled={isPending}
              aria-busy={isPending}
            >
              {isPending ? 'Saving…' : isEdit ? 'Save' : 'Create agent'}
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
