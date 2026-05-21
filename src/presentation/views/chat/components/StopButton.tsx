import { Square } from 'lucide-react';
import { Button } from '@/presentation/components/ui/Button';

interface StopButtonProps {
  /** Called when the user clicks Stop. Wired to ``ChatSessionApi.stop``. */
  onStop: () => void;
}

/**
 * Inline "Stop generating" button rendered while an agent run is in
 * flight. Replaces the Send button on the chat composer so users always
 * have one primary action — never both Send and Stop visible at once.
 *
 * The hook (:func:`useChatSession`) exposes ``stop()`` which aborts the
 * underlying ``HttpAgent.abortRun()`` and flips status back to ``idle``.
 */
export function StopButton({ onStop }: StopButtonProps) {
  return (
    <Button
      type="button"
      variant="outline"
      size="md"
      onClick={onStop}
      aria-label="Stop generating"
      className="self-stretch"
    >
      <Square size={14} fill="currentColor" />
      Stop
    </Button>
  );
}
