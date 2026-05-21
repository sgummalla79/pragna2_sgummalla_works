import { useState } from 'react';
import { Settings } from 'lucide-react';
import { useModels, useUpdateModel } from '@/presentation/hooks/models/useModels';
import { useProviders, useRefreshModels } from '@/presentation/hooks/providers/useProviders';
import { formatCostPerMillion } from '@/domain/utils/formatCost';
import { cn } from '@/lib/utils';
import { Button } from '@/presentation/components/ui/Button';
import { Card, CardContent } from '@/presentation/components/ui/Card';
import { Separator } from '@/presentation/components/ui/Separator';
import type { Model } from '@/domain/types/model.types';
import type { UserProvider } from '@/domain/types/provider.types';

/**
 * Models settings page.
 *
 * Models are created automatically when a provider is connected or refreshed —
 * there is no manual register form here. Each model exposes three independent
 * toggles: Enabled, Chat, and Flows. Archived models are shown in muted style
 * with all toggles disabled.
 */
export default function ModelsView() {
  const { data: models = [], isLoading } = useModels();
  const { data: userProviders = [] } = useProviders();

  if (isLoading) {
    return (
      <div className="flex flex-col gap-7">
        <PageHeader />
        <p className="text-sm text-muted-foreground" aria-live="polite">Loading models…</p>
      </div>
    );
  }

  if (models.length === 0) {
    return (
      <div className="flex flex-col gap-7">
        <PageHeader />
        <div className="flex flex-col items-center gap-3 py-16 text-center text-muted-foreground">
          <Settings size={40} className="opacity-30" aria-hidden="true" />
          <p className="text-base font-semibold text-[#ececea]">No models yet</p>
          <p className="text-sm">Connect a provider in Settings → Providers to auto-discover models.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-7">
      <PageHeader />

      {userProviders.map((up) => {
        const providerModels = models.filter((m) => m.userProviderId === up.id);
        if (providerModels.length === 0) return null;
        return (
          <ProviderSection key={up.id} userProvider={up} models={providerModels} />
        );
      })}

      {/* Models whose provider was deleted but rows still exist (edge case) */}
      {(() => {
        const knownProviderIds = new Set(userProviders.map((up) => up.id));
        const orphaned = models.filter((m) => !knownProviderIds.has(m.userProviderId));
        if (orphaned.length === 0) return null;
        return (
          <section className="flex flex-col gap-3">
            <h3 className="text-sm font-semibold text-muted-foreground">Other models</h3>
            <ul className="flex flex-col gap-2 list-none">
              {orphaned.map((m) => <ModelRow key={m.id} model={m} />)}
            </ul>
          </section>
        );
      })()}
    </div>
  );
}

function PageHeader() {
  return (
    <div>
      <h2 className="text-xl font-bold text-[#ececea]">Models</h2>
      <p className="mt-1.5 text-sm text-muted-foreground">
        Models are auto-discovered when you connect a provider. Toggle availability per use-case.
      </p>
    </div>
  );
}

interface ProviderSectionProps {
  userProvider: UserProvider;
  models: Model[];
}

function ProviderSection({ userProvider, models }: ProviderSectionProps) {
  const refreshModels = useRefreshModels();
  const [refreshing, setRefreshing] = useState(false);

  async function handleRefresh() {
    setRefreshing(true);
    try {
      await refreshModels.mutateAsync(userProvider.id);
    } finally {
      setRefreshing(false);
    }
  }

  return (
    <section className="flex flex-col gap-3">
      {/* Provider header */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold capitalize text-[#ececea]">
          {userProvider.providerName}
          <span className="ml-2 text-xs font-normal text-muted-foreground">
            ({models.length} model{models.length !== 1 ? 's' : ''})
          </span>
        </h3>
        <Button
          variant="outline"
          size="sm"
          onClick={handleRefresh}
          disabled={refreshing}
          aria-busy={refreshing}
        >
          {refreshing ? 'Refreshing…' : 'Refresh models'}
        </Button>
      </div>

      <Separator />

      <ul className="flex flex-col gap-2 list-none">
        {models.map((m) => <ModelRow key={m.id} model={m} />)}
      </ul>
    </section>
  );
}

interface ModelRowProps {
  model: Model;
}

function ModelRow({ model }: ModelRowProps) {
  const updateModel = useUpdateModel();
  const [pendingField, setPendingField] = useState<string | null>(null);

  async function toggle(field: 'enabled' | 'availableForChat' | 'availableForFlows') {
    if (model.archived || pendingField) return;
    setPendingField(field);
    try {
      await updateModel.mutateAsync({ id: model.id, payload: { [field]: !model[field] } });
    } finally {
      setPendingField(null);
    }
  }

  return (
    <li>
      <Card className={cn(model.archived && 'opacity-60')}>
        <CardContent className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
          {/* Model identity */}
          <div className="flex flex-col gap-0.5 min-w-0">
            <div className="flex items-center gap-2">
              <p className="font-medium text-[#ececea] truncate">{model.displayName}</p>
              {model.archived && (
                <span className="flex-shrink-0 rounded-full border border-white/10 px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                  archived
                </span>
              )}
            </div>
            <p className="text-xs text-muted-foreground truncate">{model.modelName}</p>
            <p className="text-xs text-muted-foreground">
              In: {formatCostPerMillion(model.costPerInputToken)} · Out: {formatCostPerMillion(model.costPerOutputToken)}
            </p>
          </div>

          {/* Toggles */}
          <div className="flex items-center gap-2 flex-shrink-0">
            <ToggleChip
              label="Enabled"
              active={model.enabled}
              pending={pendingField === 'enabled'}
              disabled={model.archived || !!pendingField}
              onClick={() => toggle('enabled')}
            />
            <ToggleChip
              label="Chat"
              active={model.availableForChat}
              pending={pendingField === 'availableForChat'}
              disabled={model.archived || !!pendingField}
              onClick={() => toggle('availableForChat')}
            />
            <ToggleChip
              label="Flows"
              active={model.availableForFlows}
              pending={pendingField === 'availableForFlows'}
              disabled={model.archived || !!pendingField}
              onClick={() => toggle('availableForFlows')}
            />
          </div>
        </CardContent>
      </Card>
    </li>
  );
}

interface ToggleChipProps {
  label: string;
  active: boolean;
  pending: boolean;
  disabled: boolean;
  onClick: () => void;
}

function ToggleChip({ label, active, pending, disabled, onClick }: ToggleChipProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-pressed={active}
      aria-label={`${label}: ${active ? 'on' : 'off'}`}
      className={cn(
        'rounded-full border-[1.5px] px-3 py-1 text-xs font-medium transition-colors min-h-[32px]',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-brand-ring)]',
        'disabled:cursor-not-allowed disabled:opacity-60',
        active
          ? 'border-[var(--color-brand)]/50 bg-[var(--color-brand)]/10 text-[var(--color-brand)] hover:bg-[var(--color-brand)]/20'
          : 'border-white/10 bg-white/[0.04] text-muted-foreground hover:bg-white/10'
      )}
    >
      {pending ? '…' : label}
    </button>
  );
}
