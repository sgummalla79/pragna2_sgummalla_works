import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { Check, ChevronDown } from 'lucide-react';
import { useAgents } from '@/presentation/hooks/agents/useAgents';
import { ROUTES } from '@/constants/routes';
import { cn } from '@/lib/utils';

interface AgentPickerProps {
  /**
   * Agent name currently driving the chat ("default" for the free-chat
   * agent, otherwise the flow name). Used both to highlight the active
   * option in the menu and to render the trigger label.
   */
  value: string;
}

/**
 * Per-conversation agent picker — lives in the chat header.
 *
 * Behaviour:
 *   - When only the default agent is available (a fresh account with no
 *     flows), renders as a static label. There's nothing to pick.
 *   - With multiple agents, renders as a Radix dropdown listing every
 *     agent the user can run. The currently-active one is checked.
 *   - Selecting an agent **always navigates to the landing surface**
 *     (``/chat?agent={name}``), even if the user "picks" the agent
 *     they're already on. This expresses the system's contract: agents
 *     are bound to a conversation at first-turn time and never swap
 *     mid-thread (the backend's resume-mismatch guard enforces this
 *     too — see ``pragna_run_agent`` for the 400 it raises).
 */
export function AgentPicker({ value }: AgentPickerProps) {
  const navigate = useNavigate();
  const { data: agents = [], isLoading } = useAgents();

  // Stable, single-pass derivation so we don't iterate ``agents`` twice
  // (once for the trigger, once for the menu).
  const { multiple } = useMemo(
    () => ({
      multiple: agents.length > 1,
    }),
    [agents],
  );

  const triggerLabel = value;

  // Loading-or-single-agent: render as a plain label. The chip styling
  // matches the inert "agentName" span the header used to render
  // pre-R2, so the layout doesn't shift when the picker would otherwise
  // be empty.
  if (isLoading || !multiple) {
    return (
      <span className="text-[12px] text-muted-foreground">{triggerLabel}</span>
    );
  }

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button
          type="button"
          aria-label="Switch agent"
          className={cn(
            'inline-flex items-center gap-1 rounded-md px-2 py-1',
            'text-[12px] text-muted-foreground',
            'hover:bg-accent hover:text-foreground transition-colors',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)]',
            'data-[state=open]:bg-accent data-[state=open]:text-foreground',
          )}
        >
          {triggerLabel}
          <ChevronDown size={12} aria-hidden="true" />
        </button>
      </DropdownMenu.Trigger>

      <DropdownMenu.Portal>
        <DropdownMenu.Content
          side="bottom"
          align="start"
          sideOffset={6}
          className={cn(
            'z-[700] min-w-[200px] rounded-lg border border-border',
            'bg-popover p-1 shadow-2xl',
            'focus:outline-none',
          )}
        >
          <DropdownMenu.Label className="px-3 py-1.5 text-[11px] uppercase tracking-wide text-muted-foreground">
            Start a new chat with
          </DropdownMenu.Label>
          {agents.map((agent) => {
            const isActive = agent.name === value;
            return (
              <DropdownMenu.Item
                key={agent.name}
                onSelect={() => {
                  // The "always navigate" contract — see component
                  // docstring. ``?agent=default`` is harmless to write
                  // even when 'default' is the natural fallback; it
                  // keeps the URL self-explanatory.
                  navigate(`${ROUTES.CHAT}?agent=${encodeURIComponent(agent.name)}`);
                }}
                className={cn(
                  'flex cursor-pointer items-center gap-2 rounded-md px-3 py-2 text-sm',
                  'text-foreground outline-none',
                  'data-[highlighted]:bg-accent',
                )}
              >
                <span className="flex-1 truncate" title={agent.description || undefined}>
                  {agent.name}
                </span>
                {isActive && (
                  <Check size={14} aria-label="Currently active" className="opacity-80" />
                )}
              </DropdownMenu.Item>
            );
          })}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
