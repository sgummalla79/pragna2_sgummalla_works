import { useCallback, useRef, useState, type KeyboardEvent } from 'react';
import { Button } from '@/presentation/components/ui/Button';
import { Textarea } from '@/presentation/components/ui/Textarea';
import { StopButton } from './StopButton';

interface ChatInputProps {
  /** Called when the user submits a non-empty turn. */
  onSend: (text: string) => void;
  /** Called when the user clicks Stop. Only rendered when ``disabled``. */
  onStop?: () => void;
  /** Disable the input while a run is in flight. */
  disabled?: boolean;
  /** Placeholder copy; injected so the view can localise per agent. */
  placeholder?: string;
}

/**
 * Bottom chat composer.
 *
 * Behaviour:
 *   - ``Enter`` submits the current input; ``Shift+Enter`` inserts a newline.
 *   - Empty / whitespace-only submissions are silently ignored.
 *   - While ``disabled`` (the parent is in ``status === 'running'``) the
 *     textarea is disabled and the Send button is replaced by
 *     :class:`StopButton` so the user always has one primary action.
 *
 * The parent owns ``disabled`` and ``onStop`` — :class:`ChatInput` is a
 * dumb component with no awareness of the underlying agent lifecycle.
 */
export function ChatInput({
  onSend,
  onStop,
  disabled = false,
  placeholder = 'Send a message…',
}: ChatInputProps) {
  const [value, setValue] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const submit = useCallback(() => {
    const trimmed = value.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setValue('');
    textareaRef.current?.focus();
  }, [value, disabled, onSend]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        submit();
      }
    },
    [submit],
  );

  return (
    <div className="flex gap-2 border-t border-[#2a2a2a] bg-[#0d0d0d] px-4 py-3">
      <Textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        disabled={disabled}
        placeholder={placeholder}
        rows={2}
        className="resize-none"
        aria-label="Chat input"
      />
      {disabled && onStop ? (
        <StopButton onStop={onStop} />
      ) : (
        <Button
          type="button"
          onClick={submit}
          disabled={disabled || !value.trim()}
          className="self-stretch"
        >
          Send
        </Button>
      )}
    </div>
  );
}
