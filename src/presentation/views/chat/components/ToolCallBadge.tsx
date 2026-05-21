import type { ChatToolCall } from '@/presentation/views/chat/hooks/useChatSession';

interface ToolCallBadgeProps {
  call: ChatToolCall;
}

/**
 * Inline renderer for a single tool call under an assistant turn.
 *
 * Shows the tool name, the (partial) JSON arguments as they stream in, and —
 * once the matching ``ToolCallResultEvent`` arrives — the string result.
 * The badge is intentionally low-contrast so it doesn't dominate the
 * assistant's prose; surface it more if the product later wants
 * generative-UI-style tool rendering.
 */
export function ToolCallBadge({ call }: ToolCallBadgeProps) {
  const argsPreview =
    call.args !== undefined
      ? JSON.stringify(call.args)
      : (call.argsBuffer || '…').trim();

  return (
    <div className="my-2 rounded-md border border-[#2a2a2a] bg-[#171717] px-3 py-2 text-[12px]">
      <div className="flex items-center gap-2">
        <span className="font-mono text-[11px] text-[var(--color-brand)]">
          tool
        </span>
        <span className="font-mono text-[12px] font-semibold text-[#ececea]">
          {call.name}
        </span>
        {!call.complete && (
          <span className="text-[11px] text-[#737373]">running…</span>
        )}
      </div>
      <pre className="mt-1 max-h-32 overflow-auto whitespace-pre-wrap font-mono text-[11px] text-[#a3a3a3]">
        {argsPreview}
      </pre>
      {call.result !== undefined && (
        <div className="mt-2 border-t border-[#2a2a2a] pt-2">
          <span className="text-[11px] uppercase tracking-wide text-[#737373]">
            result
          </span>
          <pre className="mt-1 max-h-32 overflow-auto whitespace-pre-wrap font-mono text-[12px] text-[#d4d4d4]">
            {call.result}
          </pre>
        </div>
      )}
    </div>
  );
}
