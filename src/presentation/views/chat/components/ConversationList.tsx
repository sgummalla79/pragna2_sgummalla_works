import {
  useConversations,
  usePinnedConversations,
} from '@/presentation/hooks/conversations/useConversations';
import { ConversationListItem } from './ConversationListItem';

/**
 * Sidebar section listing the user's pinned + recent conversations.
 *
 * Loads two queries in parallel: pinned (no pagination — count is
 * always small) and the first page of all conversations. Pinned rows
 * are filtered out of the Recent group client-side so a row only
 * appears in one section at a time. Both groups share the same
 * :class:`ConversationListItem` row template.
 *
 * States:
 *   - **Loading:** quiet placeholder. No spinner — the list is small.
 *   - **Error:** error-tinted message; user can refresh.
 *   - **Empty (no pinned, no recent):** first-run hint.
 *   - **Populated:** "Pinned" group (if any) + "Recent" group.
 *
 * Mounted by the chat :class:`Sidebar` only when expanded.
 */
export function ConversationList() {
  const recent = useConversations(0);
  const pinned = usePinnedConversations();

  if (recent.isLoading || pinned.isLoading) {
    return (
      <div className="px-2.5 py-1.5 text-[12px] text-muted-foreground">Loading…</div>
    );
  }

  if (recent.isError || pinned.isError) {
    return (
      <div className="px-2.5 py-1.5 text-[12px] text-[var(--color-error-text)]">
        Couldn't load conversations.
      </div>
    );
  }

  const pinnedRows = pinned.data ?? [];
  // Drop pinned rows from the Recent group so a conversation only
  // appears in one section. The Recent endpoint isn't filtered server-
  // side (it serves both the sidebar AND the chats browser), so this
  // de-dup lives on the client.
  const pinnedIds = new Set(pinnedRows.map((c) => c.id));
  const recentRows = (recent.data ?? []).filter((c) => !pinnedIds.has(c.id));

  if (pinnedRows.length === 0 && recentRows.length === 0) {
    return (
      <div className="px-2.5 py-1.5 text-[12px] text-muted-foreground">
        No conversations yet
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-0.5">
      {pinnedRows.length > 0 && (
        <>
          <div className="px-2.5 pt-3 pb-1 text-[11px] uppercase tracking-wide text-muted-foreground">
            Pinned
          </div>
          {pinnedRows.map((c) => (
            <ConversationListItem key={c.id} conversation={c} />
          ))}
        </>
      )}
      {recentRows.length > 0 && (
        <>
          <div className="px-2.5 pt-3 pb-1 text-[11px] uppercase tracking-wide text-muted-foreground">
            Recent
          </div>
          {recentRows.map((c) => (
            <ConversationListItem key={c.id} conversation={c} />
          ))}
        </>
      )}
    </div>
  );
}
