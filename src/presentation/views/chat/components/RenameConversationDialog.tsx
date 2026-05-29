import { useEffect, useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { Button } from '@/presentation/components/ui/Button';
import { Input } from '@/presentation/components/ui/Input';
import { Label } from '@/presentation/components/ui/Label';
import { useRenameConversation } from '@/presentation/hooks/conversations/useConversationMutations';

interface RenameConversationDialogProps {
  conversationId: string;
  currentTitle: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Modal for renaming a conversation.
 *
 * Driven from :class:`ConversationListItem` (and any future "rename"
 * affordance on the chat header). Mounted but invisible when ``open`` is
 * false — the parent owns visibility so the dialog re-mounts cleanly when
 * the user re-opens it.
 *
 * On submit:
 *   1. Title is trimmed; empty strings fall back to ``"Untitled chat"``
 *      so a no-op submit doesn't blank the row in the sidebar.
 *   2. The mutation invalidates the ``['conversations']`` query so the
 *      sidebar re-fetches and reflects the new title.
 *   3. Dialog closes on success; failures keep it open so the user can
 *      retry without losing what they typed.
 */
export function RenameConversationDialog({
  conversationId,
  currentTitle,
  open,
  onOpenChange,
}: RenameConversationDialogProps) {
  const [title, setTitle] = useState(currentTitle);
  const rename = useRenameConversation();

  // Reset the local input when the parent re-opens the dialog against a
  // different title (e.g. switching between two rows in the sidebar
  // without unmounting the dialog component).
  useEffect(() => {
    if (open) setTitle(currentTitle);
  }, [open, currentTitle]);

  async function handleSave() {
    const next = title.trim() || 'Untitled chat';
    try {
      await rename.mutateAsync({ id: conversationId, title: next });
      onOpenChange(false);
    } catch {
      // mutation.isError surfaces the message; keep dialog open.
    }
  }

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay
          className="fixed inset-0 z-[700] bg-foreground/40 backdrop-blur-sm"
        />
        <Dialog.Content
          className="
            fixed left-1/2 top-1/2 z-[701] -translate-x-1/2 -translate-y-1/2
            w-[420px] max-w-[calc(100vw-32px)]
            flex flex-col gap-4
            rounded-[14px] border border-border
            bg-popover p-6 shadow-2xl
          "
        >
          {/* Radix auto-wires aria-labelledby + aria-describedby from
              the Title + Description below — never set those attributes
              manually on Content, it suppresses the auto-detection and
              triggers the "missing title" dev warning. */}
          <Dialog.Title className="text-base font-bold text-foreground m-0">
            Rename conversation
          </Dialog.Title>
          <Dialog.Description className="text-[13px] text-foreground m-0 leading-relaxed">
            Set a new title for this chat. The change shows up in the
            sidebar immediately.
          </Dialog.Description>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="rename-conv-input" className="text-sm font-medium normal-case tracking-normal">Title</Label>
            <Input
              id="rename-conv-input"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  void handleSave();
                }
              }}
            />
            {rename.isError && (
              <p role="alert" className="text-[12px] text-[var(--color-error-text)] m-0">
                Couldn't save — please try again.
              </p>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <Dialog.Close asChild>
              <Button variant="ghost" size="sm" disabled={rename.isPending}>
                Cancel
              </Button>
            </Dialog.Close>
            <Button
              variant="default"
              size="sm"
              onClick={() => void handleSave()}
              disabled={rename.isPending}
              aria-busy={rename.isPending}
            >
              {rename.isPending ? 'Saving…' : 'Save'}
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
