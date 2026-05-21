import { useState, type MouseEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { MessageSquare, Pencil, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ROUTES } from '@/constants/routes';
import { ConfirmButton } from '@/presentation/components/ui/ConfirmButton';
import { useDeleteConversation } from '@/presentation/hooks/conversations/useConversationMutations';
import type { Conversation } from '@/domain/types/conversation.types';
import { RenameConversationDialog } from './RenameConversationDialog';

interface ConversationListItemProps {
  conversation: Conversation;
}

/**
 * A single row in the sidebar's "Recent" conversation list.
 *
 * Visual states:
 *   - **Idle:** secondary text colour, transparent background.
 *   - **Hover:** background brightens, rename + delete icons fade in.
 *   - **Active** (current ``/chat/:id`` matches): brand-tinted background,
 *     primary text colour, ``aria-current="page"``.
 *
 * The whole row is a `<Link>`. The two action icons (rename pencil,
 * delete trash) live inside the link but call ``preventDefault`` +
 * ``stopPropagation`` on click so they don't trigger navigation.
 *
 * Delete goes through :class:`ConfirmButton` so a misclick can't wipe
 * a thread.
 */
export function ConversationListItem({ conversation }: ConversationListItemProps) {
  const { id: activeId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isActive = activeId === conversation.id;
  const [renameOpen, setRenameOpen] = useState(false);
  const del = useDeleteConversation();

  function handleRenameClick(e: MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    setRenameOpen(true);
  }

  async function handleDelete() {
    await del.mutateAsync(conversation.id);
    // If the currently-open chat was deleted, bounce to the landing so
    // we're not left rendering a session view pointed at a dead id.
    if (isActive) navigate(ROUTES.CHAT);
  }

  const displayTitle = conversation.title ?? 'Untitled chat';

  return (
    <>
      <Link
        to={`${ROUTES.CHAT}/${conversation.id}`}
        className={cn(
          'group flex items-center gap-2 rounded-md px-2.5 py-1.5 text-[13px] no-underline transition-colors',
          'text-foreground hover:bg-accent hover:text-foreground',
          isActive && 'bg-primary/10 text-foreground',
        )}
        aria-current={isActive ? 'page' : undefined}
        title={displayTitle}
      >
        <MessageSquare size={14} aria-hidden className="shrink-0 opacity-60" />
        <span className="flex-1 truncate">{displayTitle}</span>

        <span
          className="flex items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100"
          onClick={(e) => e.preventDefault()} // safety net against accidental link nav
        >
          <button
            type="button"
            onClick={handleRenameClick}
            aria-label="Rename conversation"
            className="rounded p-1 hover:bg-accent text-foreground hover:text-foreground"
          >
            <Pencil size={12} />
          </button>
          <ConfirmButton
            size="xs"
            variant="ghost"
            className="!min-h-0 !min-w-0 !p-1 !h-auto !w-auto rounded text-foreground hover:text-destructive hover:bg-accent"
            aria-label="Delete conversation"
            confirmTitle="Delete this conversation?"
            confirmDescription="This permanently removes the chat and its message history. This action cannot be undone."
            confirmLabel="Delete"
            onConfirm={handleDelete}
          >
            <Trash2 size={12} />
          </ConfirmButton>
        </span>
      </Link>

      <RenameConversationDialog
        conversationId={conversation.id}
        currentTitle={displayTitle}
        open={renameOpen}
        onOpenChange={setRenameOpen}
      />
    </>
  );
}
