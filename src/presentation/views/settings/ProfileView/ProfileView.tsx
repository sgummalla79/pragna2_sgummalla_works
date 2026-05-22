import { GitBranch, RefreshCw } from 'lucide-react';
import { Label } from '@/presentation/components/ui/Label';
import { useChatPreferences } from '@/presentation/hooks/preferences/useChatPreferences';

/**
 * Profile / account settings view.
 *
 * Currently hosts the R4 #1 chat-UX toggles. The toggles persist in
 * ``localStorage`` (per-browser, not synced) — see
 * :func:`useChatPreferences` for the storage shape and rationale.
 *
 * Each toggle defaults to ON. Hiding an action just removes its
 * affordance from the message hover row; the underlying backend
 * primitive stays available.
 */
export default function ProfileView() {
  const { prefs, setPref } = useChatPreferences();

  return (
    <div className="p-4 md:p-8 max-w-3xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Profile</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Account settings and per-browser preferences.
        </p>
      </div>

      <section>
        <h2 className="text-sm font-semibold mb-2">Chat actions</h2>
        <p className="text-xs text-muted-foreground mb-4">
          Hide advanced affordances on the chat message hover row. Saved
          to this browser only.
        </p>

        <div className="space-y-3">
          <ToggleRow
            icon={<RefreshCw size={14} aria-hidden="true" />}
            label="Regenerate with a different model"
            description="Adds a dropdown chevron next to Regenerate so you can re-run a turn against a different chat-eligible model without changing the conversation's preference."
            checked={prefs.regenWithModelEnabled}
            onChange={(v) => setPref('regenWithModelEnabled', v)}
          />
          <ToggleRow
            icon={<GitBranch size={14} aria-hidden="true" />}
            label="Branch from a user message"
            description="Adds a Branch action on user-turn hover. Forks the conversation at that turn into a new conversation, leaving the original untouched."
            checked={prefs.branchEnabled}
            onChange={(v) => setPref('branchEnabled', v)}
          />
        </div>
      </section>
    </div>
  );
}

interface ToggleRowProps {
  icon: React.ReactNode;
  label: string;
  description: string;
  checked: boolean;
  onChange: (next: boolean) => void;
}

/** Minimal accessible checkbox row. Switch-style would need a Radix Switch
 *  pull — overkill for two flags. The native input is keyboard-friendly
 *  and the styling is theme-driven. */
function ToggleRow({ icon, label, description, checked, onChange }: ToggleRowProps) {
  return (
    <label className="flex items-start gap-3 p-3 rounded-lg border border-border bg-card cursor-pointer hover:border-primary/40 transition-colors">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 h-4 w-4 rounded border-border accent-primary cursor-pointer"
      />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground">{icon}</span>
          <Label className="font-medium cursor-pointer">{label}</Label>
        </div>
        <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
      </div>
    </label>
  );
}
