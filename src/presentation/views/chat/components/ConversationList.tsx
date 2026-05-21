import { useConversations } from '@/presentation/hooks/conversations/useConversations';
import { ConversationListItem } from './ConversationListItem';

/**
 * Sidebar section listing the user's recent conversations.
 *
 * Renders one of four states:
 *   - **Loading:** quiet placeholder text. No spinner — the list is
 *     usually small enough that a spinner looks heavy.
 *   - **Error:** error-tinted message; user can refresh the page.
 *   - **Empty:** "No conversations yet" — the first-run state.
 *   - **Populated:** "Recent" header + one :class:`ConversationListItem`
 *     per row.
 *
 * Mounted by the chat :class:`Sidebar`. Stays out of the layout flow
 * when collapsed — :class:`Sidebar` doesn't render this component at all
 * in that case, so we don't need a separate collapsed visual here.
 */
export function ConversationList() {
  const { data: conversations, isLoading, isError } = useConversations(0);

  if (isLoading) {
    return (
      <div className="px-2.5 py-1.5 text-[12px] text-[#737373]">Loading…</div>
    );
  }

  if (isError) {
    return (
      <div className="px-2.5 py-1.5 text-[12px] text-[#fca5a5]">
        Couldn't load conversations.
      </div>
    );
  }

  if (!conversations || conversations.length === 0) {
    return (
      <div className="px-2.5 py-1.5 text-[12px] text-[#737373]">
        No conversations yet
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-0.5">
      <div className="px-2.5 pt-3 pb-1 text-[11px] uppercase tracking-wide text-[#737373]">
        Recent
      </div>
      {conversations.map((c) => (
        <ConversationListItem key={c.id} conversation={c} />
      ))}
    </div>
  );
}
