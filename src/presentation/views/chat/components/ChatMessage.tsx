import { useState } from 'react';
import type { ChatMessage as ChatMessageType } from '@/presentation/views/chat/hooks/useChatSession';
import type { Attachment } from '@/domain/types/attachment.types';
import { Button } from '@/presentation/components/ui/Button';
import { Textarea } from '@/presentation/components/ui/Textarea';
import { useServices } from '@/presentation/providers/ServiceContext';
import { AttachmentChip } from './AttachmentChip';
import { MessageActions } from './MessageActions';
import { ModelBadge } from './ModelBadge';
import { ToolCallBadge } from './ToolCallBadge';

export interface ChatMessageHandlers {
  /** Assistant: re-run the prior user turn against the current model.
   *  Parent handles truncate + re-submit; this just signals intent. */
  onRegenerate: (messageId: string) => void;
  /** Assistant: re-run the prior user turn against a different model
   *  (R4 #1 regen-with-model). Optional — when omitted the dropdown
   *  chevron hides. */
  onRegenerateWithModel?: (messageId: string, modelId: string) => void;
  /** Assistant: copy the rendered content to the clipboard. */
  onCopy: (content: string) => Promise<void>;
  /** User: truncate from this turn + re-submit with edited content. */
  onEdit: (messageId: string, newContent: string) => void;
  /** User: fork the conversation at this turn; parent navigates. */
  onBranch: (messageId: string) => void;
}

interface ChatMessageProps {
  message: ChatMessageType;
  /**
   * R4 #0. The `user_model_id` attributed to this assistant turn — the
   * parent looks it up from persisted-messages cache + conversation
   * fallback (for mid-stream turns). Ignored for non-assistant roles.
   */
  userModelId?: string | null;
  /**
   * R4 #1 message-controls. When omitted, the bubble renders without
   * any hover affordances (matches the pre-R4 surface — useful for
   * tests and non-chat contexts that mount ChatMessage).
   */
  handlers?: ChatMessageHandlers;
  /**
   * R4 #1. When true the Branch action shows up on user turns.
   * Defaults to true. Wired to a per-user preference in the chat
   * surface so power users can hide the affordance.
   */
  branchEnabled?: boolean;
  /**
   * R4 #1. Chat-eligible models to offer in the regen-with-model
   * dropdown on assistant turns. When undefined/empty the dropdown
   * chevron is suppressed.
   */
  availableModels?: Array<{ id: string; displayName: string }>;
  /**
   * R5. Attachments persisted alongside this user message. Empty for
   * non-user turns or for turns sent without attachments. Rendered
   * as a chip row below the bubble (clickable for image preview /
   * download).
   */
  attachments?: Attachment[];
}

/**
 * Render a single chat turn. ChatGPT / Claude.ai treatment:
 *   - User turns sit in a subtle grey bubble, right-aligned. Hover
 *     reveals Edit + Branch action buttons (R4 #1). Edit toggles the
 *     bubble into an inline editor (Textarea + Save/Cancel).
 *   - Assistant turns are bare text in the column flow — no bubble, no
 *     background. Hover reveals Regenerate + Copy action buttons.
 *     R4 #0 adds a small "by <model>" attribution chip under the turn.
 *   - Tool / system turns are suppressed (the relevant detail surfaces
 *     via assistant ``ToolCall*`` events; see :class:`ToolCallBadge`).
 */
export function ChatMessage({
  message,
  userModelId,
  handlers,
  branchEnabled = true,
  availableModels,
  attachments = [],
}: ChatMessageProps) {
  const { attachmentService } = useServices();
  // Inline-edit state is local to the user-turn bubble. Save calls the
  // parent handler (which truncates + re-submits); Cancel restores the
  // original content.
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(message.content);

  if (message.role === 'tool' || message.role === 'system') {
    return null;
  }

  const isUser = message.role === 'user';

  const enterEditMode = () => {
    setDraft(message.content);
    setEditing(true);
  };
  const cancelEdit = () => {
    setEditing(false);
    setDraft(message.content);
  };
  const submitEdit = () => {
    const next = draft.trim();
    if (!next || next === message.content || !handlers) {
      cancelEdit();
      return;
    }
    setEditing(false);
    handlers.onEdit(message.id, next);
  };

  return (
    <div
      className={`group flex w-full ${isUser ? 'justify-end' : 'justify-start'}`}
      data-role={message.role}
    >
      <div
        className={
          // 18px body copy (matches claude.ai / chatgpt convention) so
          // long responses read comfortably. text-card-foreground for
          // the brighter ~98% lightness token — see the chat-text
          // brightness rationale on the previous commit.
          isUser
            ? 'flex max-w-[80%] flex-col items-end gap-1.5'
            : 'flex w-full flex-col gap-1.5'
        }
      >
        {/* Bubble (or inline editor) */}
        {editing && isUser ? (
          <div className="w-full max-w-2xl rounded-2xl border border-border bg-input p-2">
            <Textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              autoFocus
              rows={Math.min(8, Math.max(2, draft.split('\n').length + 1))}
              className="text-[17px] leading-relaxed"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                  e.preventDefault();
                  submitEdit();
                }
                if (e.key === 'Escape') {
                  e.preventDefault();
                  cancelEdit();
                }
              }}
            />
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="ghost" size="sm" onClick={cancelEdit}>
                Cancel
              </Button>
              <Button size="sm" onClick={submitEdit} disabled={!draft.trim()}>
                Save &amp; submit
              </Button>
            </div>
          </div>
        ) : (
          <div
            className={
              isUser
                ? 'rounded-2xl bg-muted px-4 py-3 text-[18px] leading-relaxed text-card-foreground'
                : 'w-full text-[18px] leading-relaxed text-card-foreground'
            }
          >
            {/* R5: attachment chips above the message text on user
                turns. Inline image thumbnails (clicking opens the
                file in a new tab via the backend's content route);
                other files as filename chips with the same link
                behaviour. Expired attachments render with a struck-
                through filename style. */}
            {isUser && attachments.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-2">
                {attachments.map((a) => (
                  <a
                    key={a.id}
                    href={a.expired ? undefined : attachmentService.contentUrl(a.id)}
                    target="_blank"
                    rel="noreferrer"
                    className={a.expired ? 'pointer-events-none' : ''}
                  >
                    <AttachmentChip
                      filename={
                        a.expired ? `[expired] ${a.filename}` : a.filename
                      }
                      contentType={a.contentType}
                      errored={a.expired}
                      previewUrl={
                        a.expired ? undefined : attachmentService.contentUrl(a.id)
                      }
                    />
                  </a>
                ))}
              </div>
            )}
            {message.content && (
              <div className="whitespace-pre-wrap break-words">
                {message.content}
              </div>
            )}
            {message.role === 'assistant' && message.toolCalls && (
              <div className={message.content ? 'mt-1' : ''}>
                {message.toolCalls.map((call) => (
                  <ToolCallBadge key={call.id} call={call} />
                ))}
              </div>
            )}
          </div>
        )}

        {/* Footer: model attribution (assistant) + action row */}
        {!editing && (
          <div
            className={`flex items-center gap-2 ${isUser ? 'justify-end' : 'justify-start'}`}
          >
            {message.role === 'assistant' && (
              <ModelBadge userModelId={userModelId} />
            )}
            {handlers && (
              message.role === 'assistant' ? (
                <MessageActions
                  role="assistant"
                  onRegenerate={() => handlers.onRegenerate(message.id)}
                  onCopy={() => handlers.onCopy(message.content)}
                  onRegenerateWithModel={
                    handlers.onRegenerateWithModel
                      ? (modelId) => handlers.onRegenerateWithModel!(message.id, modelId)
                      : undefined
                  }
                  availableModels={availableModels}
                />
              ) : (
                <MessageActions
                  role="user"
                  onEdit={enterEditMode}
                  onBranch={() => handlers.onBranch(message.id)}
                  showBranch={branchEnabled}
                />
              )
            )}
          </div>
        )}
      </div>
    </div>
  );
}
