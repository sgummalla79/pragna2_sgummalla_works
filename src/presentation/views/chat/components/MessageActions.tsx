import { useState } from 'react';
import { Check, Copy, GitBranch, Pencil, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AssistantActions {
  role: 'assistant';
  onRegenerate: () => void;
  onCopy: () => Promise<void>;
}

interface UserActions {
  role: 'user';
  onEdit: () => void;
  onBranch: () => void;
  /** R4 #1. When false the Branch button is hidden — wired to a
   *  per-user preference (Settings → Profile). Defaults to true. */
  showBranch?: boolean;
}

type Props = (AssistantActions | UserActions) & {
  /** When true the row is shown unconditionally (useful during the
   *  active turn or while loading); otherwise it's revealed on hover
   *  of the parent `.group` container. Defaults to false. */
  alwaysVisible?: boolean;
};

/**
 * Hover-revealed action row for a chat turn (R4 #1).
 *
 * Two variants by role:
 *   - **assistant**: [↻ Regenerate] [📋 Copy]
 *   - **user**:      [✏ Edit] [↗ Branch]
 *
 * The component is intentionally stateless about *what* the actions do
 * — handlers are wired by the parent (`ChatMessage` / `ChatSurface`).
 * Copy is the one exception: we own the success state so the icon
 * briefly switches to a check, giving the user feedback without a
 * toast layer.
 *
 * Visibility uses Tailwind's `group` / `group-hover` idiom — the row
 * stays at opacity 0 by default and the parent's `.group` class
 * controls reveal. Inline-focus inside the row keeps it visible so the
 * action stays clickable while moving the cursor.
 */
export function MessageActions(props: Props) {
  const { role, alwaysVisible = false } = props;
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    if (props.role !== 'assistant') return;
    try {
      await props.onCopy();
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1200);
    } catch {
      // Clipboard failures (e.g. HTTPS gating) are silent — there's
      // nothing useful for the user to do here and a toast would feel
      // disproportionate.
    }
  };

  return (
    <div
      className={cn(
        'flex items-center gap-1 transition-opacity duration-150',
        alwaysVisible
          ? 'opacity-100'
          : 'opacity-0 group-hover:opacity-100 focus-within:opacity-100',
      )}
    >
      {role === 'assistant' ? (
        <>
          <ActionButton
            label="Regenerate"
            icon={<RefreshCw size={13} aria-hidden="true" />}
            onClick={(props as AssistantActions).onRegenerate}
          />
          <ActionButton
            label={copied ? 'Copied' : 'Copy'}
            icon={
              copied
                ? <Check size={13} aria-hidden="true" />
                : <Copy size={13} aria-hidden="true" />
            }
            onClick={handleCopy}
          />
        </>
      ) : (
        <>
          <ActionButton
            label="Edit"
            icon={<Pencil size={13} aria-hidden="true" />}
            onClick={(props as UserActions).onEdit}
          />
          {((props as UserActions).showBranch ?? true) && (
            <ActionButton
              label="Branch"
              icon={<GitBranch size={13} aria-hidden="true" />}
              onClick={(props as UserActions).onBranch}
            />
          )}
        </>
      )}
    </div>
  );
}

interface ActionButtonProps {
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
}

function ActionButton({ label, icon, onClick }: ActionButtonProps) {
  return (
    <button
      type="button"
      onClick={(e) => {
        // Stop propagation so the row click (if any handler is ever
        // attached at the message-bubble level) doesn't fire alongside
        // the action.
        e.stopPropagation();
        onClick();
      }}
      aria-label={label}
      title={label}
      className={cn(
        'inline-flex items-center justify-center h-7 w-7 rounded-md',
        'text-muted-foreground hover:text-foreground hover:bg-accent',
        'transition-colors',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40',
      )}
    >
      {icon}
    </button>
  );
}
