import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from 'react';
import { ArrowUp, Paperclip, Square } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useSkills } from '@/presentation/hooks/skills/useSkills';
import { useUploadAttachment } from '@/presentation/hooks/attachments/useUploadAttachment';
import type { Skill } from '@/domain/types/skill.types';
import type { Attachment } from '@/domain/types/attachment.types';
import { AttachmentChip } from './AttachmentChip';
import { SlashCommandPopover } from './SlashCommandPopover';

/** Max number of suggestions shown in the slash-command popover at once. */
const SLASH_MAX_ITEMS = 8;

/** R5 — content types the paperclip's accept= attribute filters to.
 *  Should mirror ATTACHMENT_ALLOWED_MIME_TYPES on the backend. */
const ATTACHMENT_ACCEPT = [
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/webp',
  'image/gif',
  'application/pdf',
  'text/plain',
  'text/markdown',
  'text/csv',
  '.md',
  '.csv',
].join(',');

/** Local-only state for one in-flight or staged upload. */
interface PendingAttachment {
  /** Stable client id (also used as React key). */
  clientKey: string;
  filename: string;
  contentType: string;
  /** Object URL for image preview (revoked on unstage). */
  previewUrl?: string;
  /** Server attachment after upload completes; null while uploading. */
  attachment: Attachment | null;
  uploading: boolean;
  errored?: boolean;
}

interface ChatInputProps {
  /**
   * Called when the user submits a non-empty turn. ``attachmentIds`` is
   * the list of staged attachment IDs that have completed upload — pass
   * them through to the pragna stream's ``forwarded_props``.
   */
  onSend: (text: string, attachmentIds: string[]) => void;
  /** Called when the user clicks Stop. Only rendered when ``disabled``. */
  onStop?: () => void;
  /** True while the parent run is in flight. */
  disabled?: boolean;
  /** Placeholder copy; injected so the view can localise per agent. */
  placeholder?: string;
  /**
   * R5. The conversation_id under which attachments upload. Passed to
   * ``POST /api/conversations/{id}/attachments``. Can refer to a
   * not-yet-existing conversation (landing-page uploads); the backend
   * defers the conversation_id link to send-time. Omit / null to hide
   * the paperclip entirely (e.g. on the unauth chat).
   */
  conversationId?: string | null;
  /**
   * R5. Capability hint for the active chat model. When ``vision`` is
   * false, image uploads are blocked client-side; when ``pdf`` is
   * false, PDFs are blocked. Text uploads always allowed. Both default
   * to ``true`` so older callers that don't pass capabilities keep
   * working — the backend is the authoritative gate.
   */
  modelCapabilities?: { vision: boolean; pdf: boolean };
  /**
   * Optional inline-attached content rendered ABOVE the textarea, inside
   * the rounded composer container. Use this for setup banners, file
   * chips, or any context that should visually belong to the composer
   * rather than sit on its own above. ChatLandingView passes its setup
   * banner here so the user reads "fix this first" without a separate
   * floating element above the input.
   */
  children?: ReactNode;
}

/**
 * Bottom chat composer — ChatGPT / Claude.ai style.
 *
 * A single rounded card that contains the optional banner slot, the
 * auto-growing textarea, and the send/stop button as a circular icon
 * nested at the bottom-right inside the container. No outer border
 * strip; the composer blends with the page surface in both themes via
 * semantic tokens.
 *
 * Behaviour:
 *   - ``Enter`` submits the current input; ``Shift+Enter`` inserts a newline.
 *   - Empty / whitespace-only submissions are silently ignored.
 *   - While ``disabled`` AND ``onStop`` is set (an in-flight run), the
 *     textarea stays editable so the user can draft the next turn while
 *     the current one streams; the send icon is replaced with a stop
 *     icon. When ``disabled`` is set without ``onStop`` (e.g. landing
 *     page without a connected provider), the textarea is truly disabled.
 *
 * The component is dumb — the parent owns ``disabled`` and ``onStop``.
 */
export function ChatInput({
  onSend,
  onStop,
  disabled = false,
  placeholder = 'Send a message…',
  conversationId,
  modelCapabilities = { vision: true, pdf: true },
  children,
}: ChatInputProps) {
  const [value, setValue] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── R5: attachment staging ──────────────────────────────────────────
  const [pending, setPending] = useState<PendingAttachment[]>([]);
  const [dragging, setDragging] = useState(false);
  const uploadMutation = useUploadAttachment();
  const attachmentsEnabled = Boolean(conversationId);

  const stageFiles = useCallback(
    (files: FileList | File[]) => {
      if (!attachmentsEnabled || !conversationId) return;
      Array.from(files).forEach((file) => {
        const isImage = file.type.startsWith('image/');
        const isPdf = file.type === 'application/pdf';
        // Client-side capability check. The backend is the authoritative
        // gate (and produces a clearer error), but bouncing the file
        // here saves the upload round-trip when we know it'll fail.
        if (isImage && !modelCapabilities.vision) {
          // eslint-disable-next-line no-alert
          window.alert(
            `Current model can't see images. Switch to a vision-capable model to attach ${file.name}.`,
          );
          return;
        }
        if (isPdf && !modelCapabilities.pdf) {
          // eslint-disable-next-line no-alert
          window.alert(
            `Current model can't read PDFs. Switch to a PDF-capable model to attach ${file.name}.`,
          );
          return;
        }
        const clientKey = `${file.name}-${file.size}-${Date.now()}-${Math.random()}`;
        const previewUrl = isImage ? URL.createObjectURL(file) : undefined;
        setPending((cur) => [
          ...cur,
          {
            clientKey,
            filename: file.name,
            contentType: file.type,
            previewUrl,
            attachment: null,
            uploading: true,
          },
        ]);
        uploadMutation.mutate(
          { conversationId, file },
          {
            onSuccess: (attachment) => {
              setPending((cur) =>
                cur.map((p) =>
                  p.clientKey === clientKey
                    ? { ...p, attachment, uploading: false }
                    : p,
                ),
              );
            },
            onError: () => {
              setPending((cur) =>
                cur.map((p) =>
                  p.clientKey === clientKey
                    ? { ...p, uploading: false, errored: true }
                    : p,
                ),
              );
            },
          },
        );
      });
    },
    [attachmentsEnabled, conversationId, modelCapabilities, uploadMutation],
  );

  const removePending = useCallback((clientKey: string) => {
    setPending((cur) => {
      const target = cur.find((p) => p.clientKey === clientKey);
      if (target?.previewUrl) URL.revokeObjectURL(target.previewUrl);
      return cur.filter((p) => p.clientKey !== clientKey);
    });
  }, []);

  // Revoke object URLs on unmount so the browser doesn't leak them
  // when the user navigates away with attachments still staged.
  useEffect(() => {
    return () => {
      setPending((cur) => {
        cur.forEach((p) => {
          if (p.previewUrl) URL.revokeObjectURL(p.previewUrl);
        });
        return cur;
      });
    };
  }, []);

  // ── R4 #2: slash-command discovery ──────────────────────────────────
  // Track an active `/` at the current cursor position (must be the
  // start of a word — start-of-string or preceded by whitespace).
  // The popover is rendered above the composer when active and there
  // are matching enabled skills; keyboard nav + Enter accept happen
  // inside the textarea's own keyDown handler so focus never moves.
  const { data: allSkills = [] } = useSkills();
  const [slashOpen, setSlashOpen] = useState(false);
  const [slashStart, setSlashStart] = useState(-1);
  const [slashQuery, setSlashQuery] = useState('');
  const [slashIndex, setSlashIndex] = useState(0);

  const filteredSkills = useMemo<Skill[]>(() => {
    if (!slashOpen) return [];
    const q = slashQuery.toLowerCase();
    return allSkills
      .filter((s) => s.enabled && s.name.toLowerCase().startsWith(q))
      .slice(0, SLASH_MAX_ITEMS);
  }, [allSkills, slashOpen, slashQuery]);

  // Detect / dismiss the popover whenever the value changes. The cursor
  // position is read off the live DOM element since the textarea owns
  // the selection — useState only tracks the text. Slash is "active"
  // when a `/` sits between the start of the current word and the
  // cursor, with no whitespace after it.
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    const cursor = el.selectionStart ?? value.length;
    // Walk backwards from the cursor: stop at the first whitespace
    // (word boundary) or the first `/`.
    let i = cursor - 1;
    while (i >= 0 && value[i] !== '/' && !/\s/.test(value[i])) i--;
    if (
      i >= 0 &&
      value[i] === '/' &&
      (i === 0 || /\s/.test(value[i - 1]))
    ) {
      const q = value.slice(i + 1, cursor);
      // The query must contain no whitespace — keeps the popover
      // closed for pasted text like "/foo bar".
      if (!/\s/.test(q)) {
        setSlashOpen(true);
        setSlashStart(i);
        setSlashQuery(q);
        setSlashIndex(0);
        return;
      }
    }
    setSlashOpen(false);
  }, [value]);

  const acceptSlash = useCallback(
    (skill: Skill) => {
      const before = value.slice(0, slashStart);
      const after = value.slice(slashStart + 1 + slashQuery.length);
      const next = `${before}/${skill.name} ${after}`;
      setValue(next);
      setSlashOpen(false);
      // Place cursor right after the inserted name (and trailing space)
      // so the user can keep typing the prompt without a manual click.
      const caret = before.length + 1 + skill.name.length + 1;
      requestAnimationFrame(() => {
        const el = textareaRef.current;
        if (!el) return;
        el.focus();
        el.setSelectionRange(caret, caret);
      });
    },
    [value, slashStart, slashQuery],
  );

  // Wait for any in-flight uploads before allowing send — partial
  // batches would result in the user seeing fewer attachments than
  // they staged.
  const uploadsInFlight = pending.some((p) => p.uploading);
  const readyAttachmentIds = pending
    .filter((p) => p.attachment && !p.errored)
    .map((p) => p.attachment!.id);

  const submit = useCallback(() => {
    const trimmed = value.trim();
    if (!trimmed || disabled || uploadsInFlight) return;
    onSend(trimmed, readyAttachmentIds);
    setValue('');
    // Revoke preview URLs + clear staging on successful send.
    pending.forEach((p) => {
      if (p.previewUrl) URL.revokeObjectURL(p.previewUrl);
    });
    setPending([]);
  }, [value, disabled, uploadsInFlight, onSend, readyAttachmentIds, pending]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      // Popover-aware key handling. ArrowUp/Down navigate, Enter/Tab
      // accept the highlighted skill, Escape closes. All only when the
      // popover is actually showing something — otherwise these keys
      // get their normal textarea behaviour.
      if (slashOpen && filteredSkills.length > 0) {
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          setSlashIndex((i) => (i + 1) % filteredSkills.length);
          return;
        }
        if (e.key === 'ArrowUp') {
          e.preventDefault();
          setSlashIndex((i) =>
            i === 0 ? filteredSkills.length - 1 : i - 1,
          );
          return;
        }
        if ((e.key === 'Enter' || e.key === 'Tab') && !e.shiftKey) {
          e.preventDefault();
          acceptSlash(filteredSkills[slashIndex]);
          return;
        }
        if (e.key === 'Escape') {
          e.preventDefault();
          setSlashOpen(false);
          return;
        }
      }
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        submit();
      }
    },
    [slashOpen, filteredSkills, slashIndex, acceptSlash, submit],
  );

  // Re-focus the textarea on the falling edge of ``disabled`` — first
  // mount lands focused, and after each run finalises the next turn is
  // one keystroke away.
  useEffect(() => {
    if (!disabled) textareaRef.current?.focus();
  }, [disabled]);

  // Auto-grow the textarea up to a sensible cap. Reset to ``auto`` first
  // so the height shrinks when the user deletes lines.
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
  }, [value]);

  const hasText = value.trim().length > 0;
  const showStop = disabled && Boolean(onStop);
  const canSend = hasText && !disabled && !uploadsInFlight;

  // Vertical padding only; horizontal containment + screen-edge
  // padding are owned by the parent so the composer can be aligned
  // pixel-perfect with the message column above it. See ChatSessionView
  // for the wrapping ``<div className="px-4"><div max-w-3xl/>>`` pair
  // that mirrors the message scroll-area's structure.
  return (
    <div className="py-3">
      <div
        className={cn(
          // `relative` anchors the slash-command popover above the
          // composer (it uses `absolute bottom-full`).
          'relative rounded-3xl border border-border bg-card shadow-sm',
          'transition-colors',
          'focus-within:border-input',
          // R5: drop-target affordance.
          dragging && attachmentsEnabled && 'ring-2 ring-primary ring-offset-1',
        )}
        onDragEnter={(e) => {
          if (!attachmentsEnabled) return;
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={(e) => {
          // dragLeave fires for every child element; only clear when
          // we actually leave the composer container.
          if (
            e.currentTarget.contains(e.relatedTarget as Node | null)
          ) {
            return;
          }
          setDragging(false);
        }}
        onDragOver={(e) => {
          if (!attachmentsEnabled) return;
          e.preventDefault();
        }}
        onDrop={(e) => {
          if (!attachmentsEnabled) return;
          e.preventDefault();
          setDragging(false);
          if (e.dataTransfer.files?.length) {
            stageFiles(e.dataTransfer.files);
          }
        }}
      >
        {slashOpen && filteredSkills.length > 0 && (
          <SlashCommandPopover
            items={filteredSkills}
            selectedIndex={slashIndex}
            onSelect={acceptSlash}
            onHoverIndex={setSlashIndex}
          />
        )}
        {children && <div className="px-4 pt-3">{children}</div>}

        {/* R5: staged-attachments row, only shown when there's at least one. */}
        {pending.length > 0 && (
          <div className="flex flex-wrap gap-1.5 px-4 pt-3">
            {pending.map((p) => (
              <AttachmentChip
                key={p.clientKey}
                filename={p.filename}
                contentType={p.contentType}
                uploading={p.uploading}
                errored={p.errored}
                previewUrl={p.previewUrl}
                onRemove={() => removePending(p.clientKey)}
              />
            ))}
          </div>
        )}

        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          // Keep the textarea editable during a streaming run so users
          // can draft the next message; only truly disable when there's
          // no stop affordance (i.e. provider gating, not active run).
          disabled={disabled && !showStop}
          placeholder={placeholder}
          rows={1}
          aria-label="Chat input"
          className={cn(
            'block w-full resize-none border-0 bg-transparent outline-none',
            // Compact inner padding so the placeholder hugs the top
            // edge of the composer. pt-2 (8px) + line-height(24) +
            // pb-2 (8px) = 40px content; min-h-11 (44px) leaves a
            // sliver of breathing room above the button row without
            // floating the placeholder.
            'px-4 pt-2 pb-2 text-[15px] leading-6 text-card-foreground',
            '[&:not(:placeholder-shown)]:font-semibold',
            'placeholder:text-muted-foreground',
            'min-h-11',
            'disabled:cursor-not-allowed disabled:opacity-60',
          )}
        />

        <div className="flex items-center justify-between px-4 pb-3 pt-1">
          {/* R5: paperclip + hidden file input. Hidden entirely when
              attachments aren't available for this composer mount. */}
          {attachmentsEnabled ? (
            <>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept={ATTACHMENT_ACCEPT}
                className="hidden"
                onChange={(e) => {
                  if (e.target.files) stageFiles(e.target.files);
                  // Allow re-picking the same file in succession.
                  e.target.value = '';
                }}
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                aria-label="Attach file"
                title="Attach file (images, PDF, .txt/.md/.csv)"
                className={cn(
                  'flex h-9 w-9 items-center justify-center rounded-full',
                  'text-muted-foreground hover:text-foreground hover:bg-accent',
                  'transition-colors',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)]',
                )}
              >
                <Paperclip size={16} aria-hidden="true" />
              </button>
            </>
          ) : (
            <span />
          )}

          {showStop ? (
            <button
              type="button"
              onClick={onStop}
              aria-label="Stop generating"
              className={cn(
                'flex h-9 w-9 items-center justify-center rounded-full',
                'bg-foreground text-background transition-opacity',
                'hover:opacity-90',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)]',
              )}
            >
              <Square size={14} fill="currentColor" />
            </button>
          ) : (
            <button
              type="button"
              onClick={submit}
              disabled={!canSend}
              aria-label="Send message"
              className={cn(
                'flex h-9 w-9 items-center justify-center rounded-full',
                'transition-colors',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)]',
                canSend
                  ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                  : 'bg-muted text-muted-foreground cursor-not-allowed',
              )}
            >
              <ArrowUp size={18} strokeWidth={2.5} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
