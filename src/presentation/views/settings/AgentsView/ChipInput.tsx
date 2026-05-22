import { useState, type KeyboardEvent } from 'react';
import { X } from 'lucide-react';
import { Input } from '@/presentation/components/ui/Input';
import { Badge } from '@/presentation/components/ui/Badge';

interface Props {
  id?: string;
  values: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
  /** Friendly accessible label e.g. "Emit labels". Used in remove buttons. */
  label: string;
}

/**
 * Lightweight tag/chip input. Press Enter or comma to commit the current
 * draft; click ✕ on a chip to remove it. Duplicates and empty strings
 * are silently rejected.
 */
export function ChipInput({ id, values, onChange, placeholder, label }: Props) {
  const [draft, setDraft] = useState('');

  function commit(raw: string) {
    const next = raw.trim();
    if (!next || values.includes(next)) {
      setDraft('');
      return;
    }
    onChange([...values, next]);
    setDraft('');
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      commit(draft);
    } else if (e.key === 'Backspace' && draft === '' && values.length > 0) {
      // Quick-remove the last chip when the input is empty.
      onChange(values.slice(0, -1));
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5 rounded-md border border-border bg-input px-2 py-1.5 min-h-[2.75rem]">
      {values.map((v) => (
        <Badge key={v} variant="secondary" className="gap-1 pr-1">
          <span className="font-mono text-[11px]">{v}</span>
          <button
            type="button"
            onClick={() => onChange(values.filter((x) => x !== v))}
            aria-label={`Remove ${label} ${v}`}
            className="rounded p-0.5 hover:bg-muted"
          >
            <X size={10} aria-hidden="true" />
          </button>
        </Badge>
      ))}
      <Input
        id={id}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={() => commit(draft)}
        placeholder={values.length === 0 ? placeholder : undefined}
        className="flex-1 min-w-[120px] h-7 border-0 bg-transparent px-1 py-0 shadow-none focus-visible:ring-0 focus-visible:ring-offset-0"
      />
    </div>
  );
}
