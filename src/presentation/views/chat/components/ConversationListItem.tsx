import { useState, type MouseEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import * as Dialog from '@radix-ui/react-dialog';
import { MoreVertical, Pencil, Pin, PinOff, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { CHAT_PLACEHOLDER_TITLE } from '@/constants/api';
import { ROUTES } from '@/constants/routes';
import { Button } from '@/presentation/components/ui/Button';
import { useConversationUsage } from '@/presentation/hooks/conversations/useConversations';
import {
  useDeleteConversation,
  useSetPinned,
} from '@/presentation/hooks/conversations/useConversationMutations';
import { formatUsd } from '@/domain/utils/formatCost';
import type { Conversation } from '@/domain/types/conversation.types';
import { RenameConversationDialog } from './RenameConversationDialog';

interface ConversationListItemProps {
  conversation: Conversation;
}

/** Hard cap on visible characters in the sidebar row. Anything longer
 *  than this is truncated with a trailing ellipsis. */
const TITLE_MAX_CHARS = 24;

/**
 * A single row in the sidebar's "Recent" conversation list.
 *
 * Visual states:
 *   - **Idle:** secondary text colour, transparent background. Cost
 *     chip (when total > $0) shown at the right.
 *   - **Hover:** sidebar-accent background, kebab (⋮) menu trigger
 *     fades in to the right, replacing the cost chip.
 *   - **Active** (current ``/chat/:id`` matches): sidebar-primary
 *     background, foreground colour, bold; ``aria-current="page"``.
 *
 * The whole row is a `<Link>`. The kebab trigger sits inside the link
 * but calls ``preventDefault`` + ``stopPropagation`` so opening the
 * menu doesn't follow the link. The menu items (Edit, Pin/Unpin,
 * Delete) drive existing controlled dialogs / mutations.
 *
 * Delete is gated by an inline confirmation dialog driven from menu
 * state — unlike the older inline ConfirmButton flow this layout
 * cleanly stacks "open menu → pick action → confirm if destructive."
 */
export function ConversationListItem({ conversation }: ConversationListItemProps) {
  const { id: activeId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isActive = activeId === conversation.id;
  const [renameOpen, setRenameOpen] = useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const del = useDeleteConversation();
  const setPinned = useSetPinned();

  function openMenuClick(e: MouseEvent) {
    // The trigger sits inside the row's <Link>; stop both default link
    // nav AND bubbling so opening the menu doesn't switch conversation.
    e.preventDefault();
    e.stopPropagation();
  }

  function handleEdit() {
    setRenameOpen(true);
  }

  function handlePinToggle() {
    setPinned.mutate({ id: conversation.id, pinned: !conversation.pinned });
  }

  function handleDeleteRequest() {
    setConfirmDeleteOpen(true);
  }

  async function handleDeleteConfirm() {
    setDeleting(true);
    try {
      // Navigate FIRST when the deleted conversation is the one on screen.
      // Otherwise the session view stays mounted across the DELETE round-trip;
      // its hooks (messages, usage, open-episode) re-fetch after onSuccess
      // evicts the cache, hitting the just-deleted row → 404.
      if (isActive) navigate(ROUTES.CHAT);
      await del.mutateAsync(conversation.id);
      setConfirmDeleteOpen(false);
    } finally {
      setDeleting(false);
    }
  }

  // ``CHAT_PLACEHOLDER_TITLE`` ('New chat') signals "title hasn't
  // been generated yet" — the BE fires auto-title fire-and-forget at
  // eager-create time so this only renders during the ~1s window
  // between submit and the React Query refetch that picks up the
  // landed title. Distinct from the rename-dialog fallback's
  // 'Untitled chat' which signals user-initiated emptiness.
  const rawTitle = conversation.title ?? CHAT_PLACEHOLDER_TITLE;
  // Hard 27-char truncate followed by a single-character ellipsis.
  // Deterministic regardless of font / sidebar width — CSS `truncate`
  // would otherwise vary the visible cut-off as fonts re-render.
  const displayTitle =
    rawTitle.length > TITLE_MAX_CHARS
      ? `${rawTitle.slice(0, TITLE_MAX_CHARS)}…`
      : rawTitle;

  // R4 #4: per-conversation total USD shown in the sidebar. Reuses the
  // existing /usage endpoint via React Query so each row only fires
  // once per cache window (60s staleTime). We render nothing when the
  // cost is zero or still loading — keeps brand-new conversations
  // from showing a noisy "$0.00" chip.
  const { data: usage } = useConversationUsage(conversation.id);
  const totalCost = usage ? parseFloat(usage.totalCostUsd) : 0;
  const showCost = totalCost > 0;

  return (
    <>
      <Link
        to={`${ROUTES.CHAT}/${conversation.id}`}
        className={cn(
          'group relative flex items-center rounded-lg px-2.5 py-1 min-h-8 text-[14px] no-underline transition-colors duration-150',
          isActive
            ? 'font-semibold text-sidebar-primary-foreground bg-sidebar-primary'
            : 'font-medium text-sidebar-foreground/70 hover:text-sidebar-accent-foreground hover:bg-sidebar-accent',
        )}
        aria-current={isActive ? 'page' : undefined}
        title={rawTitle}
      >
        {/* Title — `pr-8` reserves a strip at the right that the cost
            chip / kebab live in (both absolutely positioned to the row,
            not the title, so their X never drifts with text length). */}
        <span className="flex-1 whitespace-nowrap pr-8">{displayTitle}</span>

        {/* Cost chip — absolute, anchored to the row's right edge,
            vertically centred. Fades out on hover so the kebab can
            take over the same visual slot without a layout shift. */}
        {showCost && (
          <span
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[11px] text-current tabular-nums opacity-60 group-hover:opacity-0 transition-opacity pointer-events-none"
            title={`Total cost so far: ${formatUsd(totalCost)}`}
            aria-label={`Total cost ${formatUsd(totalCost)}`}
          >
            {formatUsd(totalCost)}
          </span>
        )}

        {/* Kebab menu trigger — same anchor as the cost chip (row's
            right edge, vertically centred). Fixed X regardless of
            title length or cost chip width. */}
        <DropdownMenu.Root>
          <DropdownMenu.Trigger asChild>
            <button
              type="button"
              onClick={openMenuClick}
              aria-label="Conversation actions"
              className={cn(
                'absolute right-1 top-1/2 -translate-y-1/2',
                'flex h-6 w-6 items-center justify-center rounded text-current',
                'opacity-0 group-hover:opacity-100 transition-opacity',
                'hover:bg-sidebar-foreground/10',
                'data-[state=open]:opacity-100 data-[state=open]:bg-sidebar-foreground/10',
              )}
            >
              <MoreVertical size={14} />
            </button>
          </DropdownMenu.Trigger>

          <DropdownMenu.Portal>
            <DropdownMenu.Content
              side="bottom"
              align="end"
              sideOffset={4}
              className={cn(
                'z-[700] min-w-[180px] rounded-lg border border-border',
                'bg-popover p-1 shadow-2xl',
                'focus:outline-none',
              )}
              // Stop click events from bubbling into the parent <Link>
              // — Radix portals out of the DOM tree, but the trigger
              // is still inside the row.
              onClick={(e) => e.stopPropagation()}
            >
              <DropdownMenu.Item
                onSelect={handleEdit}
                className={cn(
                  'flex cursor-pointer items-center gap-2 rounded-md px-2.5 py-2 text-[13px]',
                  'text-foreground outline-none',
                  'data-[highlighted]:bg-accent',
                )}
              >
                <Pencil size={14} aria-hidden className="opacity-80" />
                Edit
              </DropdownMenu.Item>
              <DropdownMenu.Item
                onSelect={handlePinToggle}
                className={cn(
                  'flex cursor-pointer items-center gap-2 rounded-md px-2.5 py-2 text-[13px]',
                  'text-foreground outline-none',
                  'data-[highlighted]:bg-accent',
                )}
              >
                {conversation.pinned ? (
                  <>
                    <PinOff size={14} aria-hidden className="opacity-80" />
                    Unpin
                  </>
                ) : (
                  <>
                    <Pin size={14} aria-hidden className="-rotate-45 opacity-80" />
                    Pin
                  </>
                )}
              </DropdownMenu.Item>
              <DropdownMenu.Separator className="my-1 h-px bg-border" />
              <DropdownMenu.Item
                onSelect={handleDeleteRequest}
                className={cn(
                  'flex cursor-pointer items-center gap-2 rounded-md px-2.5 py-2 text-[13px]',
                  'text-destructive outline-none',
                  'data-[highlighted]:bg-destructive/10',
                )}
              >
                <Trash2 size={14} aria-hidden />
                Delete
              </DropdownMenu.Item>
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu.Root>
      </Link>

      <RenameConversationDialog
        conversationId={conversation.id}
        currentTitle={rawTitle}
        open={renameOpen}
        onOpenChange={setRenameOpen}
      />

      {/* Controlled confirm dialog for Delete. Lives outside the row's
          DropdownMenu so it stays mounted across menu open/close
          cycles; mirrors the markup of :class:`ConfirmButton`'s
          internal dialog. */}
      <Dialog.Root open={confirmDeleteOpen} onOpenChange={setConfirmDeleteOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-[700] bg-foreground/40 backdrop-blur-sm" />
          <Dialog.Content
            role="alertdialog"
            className={cn(
              'fixed left-1/2 top-1/2 z-[701] -translate-x-1/2 -translate-y-1/2',
              'w-[420px] max-w-[calc(100vw-32px)]',
              'flex flex-col gap-4',
              'rounded-[14px] border border-border bg-popover p-6 shadow-2xl',
            )}
          >
            <div className="flex flex-col gap-1.5">
              <Dialog.Title className="text-base font-bold text-foreground m-0">
                Delete this conversation?
              </Dialog.Title>
              <Dialog.Description className="text-[13px] text-foreground m-0 leading-relaxed">
                This permanently removes the chat and its message history.
                This action cannot be undone.
              </Dialog.Description>
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <Dialog.Close asChild>
                <Button variant="ghost" size="sm" disabled={deleting}>
                  Cancel
                </Button>
              </Dialog.Close>
              <Button
                variant="danger"
                size="sm"
                onClick={handleDeleteConfirm}
                disabled={deleting}
                aria-busy={deleting}
              >
                {deleting ? 'Delete…' : 'Delete'}
              </Button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </>
  );
}
