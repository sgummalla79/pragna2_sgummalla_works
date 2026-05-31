import { Fragment, useMemo } from 'react';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { Check, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useLlmProvidersWithRegistrations } from '@/presentation/hooks/providers/useProviders';
import type { Model } from '@/domain/types/model.types';

/**
 * Lightweight shape used internally for grouping. The full
 * ``LlmProviderWithRegistrations`` tree is flattened to ``(providerName,
 * providerDisplay, models[])`` for the dropdown layout.
 */
interface ProviderGroup {
  providerName: string;
  providerDisplay: string;
  models: Model[];
}

interface ModelPickerProps {
  /** Currently active user_model id, or ``null`` when the conversation
   *  hasn't been pinned to a specific model yet (rare — auto-create
   *  always stamps one). */
  userModelId: string | null;
  onModelChange: (userModelId: string) => void;
}

/**
 * Inline model picker for the chat composer.
 *
 * Trigger: a small pill rendering the currently active model's display
 * name. Dropdown: groups every chat-eligible model by provider, with the
 * active option checkmarked. (Extended thinking lives in its own
 * :class:`ThinkingToggle` beside the picker, not in this dropdown.)
 *
 * "Chat-eligible" = ``model.enabled && model.availableForChat &&
 * !model.archived`` AND the parent user_provider is ``enabled``.
 *
 * Selection semantics: the parent owns persistence. On model change the
 * parent PATCHes ``conversations.user_model_id``. The component is dumb.
 */
export function ModelPicker({
  userModelId,
  onModelChange,
}: ModelPickerProps) {
  const { data: providers = [], isLoading } =
    useLlmProvidersWithRegistrations();

  // Flatten into grouped chat-eligible models. A provider with multiple
  // registrations (rare today, future-proofing) contributes every
  // model from every enabled registration into one group.
  const groups = useMemo<ProviderGroup[]>(() => {
    const out: ProviderGroup[] = [];
    for (const p of providers) {
      const models: Model[] = [];
      for (const up of p.userProviders) {
        if (!up.enabled) continue;
        for (const m of up.models) {
          if (m.enabled && m.availableForChat && !m.archived) {
            models.push(m);
          }
        }
      }
      if (models.length > 0) {
        out.push({
          providerName: p.name,
          providerDisplay: p.displayName,
          models,
        });
      }
    }
    return out;
  }, [providers]);

  // Resolve the active model + its provider for the trigger label.
  const active = useMemo(() => {
    for (const g of groups) {
      for (const m of g.models) {
        if (m.id === userModelId) {
          return { model: m, providerDisplay: g.providerDisplay, providerName: g.providerName };
        }
      }
    }
    // Fallback when nothing is selected (or selected model isn't
    // chat-eligible anymore): show the first available model as the
    // soft default — keeps the trigger label populated even before the
    // user has explicitly picked anything.
    const first = groups[0];
    if (first && first.models.length > 0) {
      return {
        model: first.models[0],
        providerDisplay: first.providerDisplay,
        providerName: first.providerName,
      };
    }
    return null;
  }, [groups, userModelId]);

  if (isLoading || !active) {
    return null;
  }

  const triggerLabel = active.model.displayName;

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button
          type="button"
          aria-label="Switch model"
          className={cn(
            'inline-flex items-center gap-1.5 rounded-full px-3 py-1.5',
            'text-[12px] font-medium text-muted-foreground',
            'hover:bg-accent hover:text-foreground transition-colors',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)]',
            'data-[state=open]:bg-accent data-[state=open]:text-foreground',
          )}
        >
          <span className="truncate max-w-[24ch]">{triggerLabel}</span>
          <ChevronDown size={12} aria-hidden="true" />
        </button>
      </DropdownMenu.Trigger>

      <DropdownMenu.Portal>
        <DropdownMenu.Content
          side="top"
          align="start"
          sideOffset={8}
          className={cn(
            'z-[700] min-w-[260px] max-h-[60vh] overflow-y-auto',
            'rounded-lg border border-border bg-popover p-1 shadow-2xl',
            'focus:outline-none',
          )}
        >
          {groups.map((g, idx) => (
            <Fragment key={g.providerName}>
              {idx > 0 && (
                <DropdownMenu.Separator className="my-1 h-px bg-border" />
              )}
              <DropdownMenu.Label
                className="px-3 pt-2 pb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground"
              >
                {g.providerDisplay}
              </DropdownMenu.Label>
              {g.models.map((m) => {
                const isActive = m.id === active.model.id;
                return (
                  <DropdownMenu.Item
                    key={m.id}
                    onSelect={() => {
                      if (!isActive) onModelChange(m.id);
                    }}
                    className={cn(
                      'flex cursor-pointer items-center gap-2 rounded-md pl-6 pr-3 py-2 text-sm',
                      'text-foreground outline-none',
                      'data-[highlighted]:bg-accent',
                    )}
                  >
                    <span className="flex-1 truncate" title={m.modelName}>
                      {m.displayName}
                    </span>
                    {isActive && (
                      <Check size={14} aria-label="Currently active" className="opacity-80" />
                    )}
                  </DropdownMenu.Item>
                );
              })}
            </Fragment>
          ))}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
