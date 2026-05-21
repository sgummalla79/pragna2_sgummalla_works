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
          className="fixed inset-0 z-[700] bg-black/60"
          style={{ backdropFilter: 'blur(4px)' }}
        />
        <Dialog.Content
          role="dialog"
          aria-labelledby="rename-conv-title"
          className="
            fixed left-1/2 top-1/2 z-[701] -translate-x-1/2 -translate-y-1/2
            w-[420px] max-w-[calc(100vw-32px)]
            flex flex-col gap-4
            rounded-[14px] border border-[rgba(255,255,255,0.1)]
            bg-[#212121] p-6
          "
          style={{ boxShadow: '0 24px 60px rgba(0,0,0,0.45)' }}
        >
          <Dialog.Title
            id="rename-conv-title"
            className="text-base font-bold text-[#ececea] m-0"
          >
            Rename conversation
          </Dialog.Title>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="rename-conv-input">Title</Label>
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
              <p role="alert" className="text-[12px] text-[#ef4444] m-0">
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
