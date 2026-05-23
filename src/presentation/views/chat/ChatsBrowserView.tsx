import { useEffect, useMemo, useRef, useState } from 'react';
import { History, Search } from 'lucide-react';
import { Input } from '@/presentation/components/ui/Input';
import { useInfiniteConversations } from '@/presentation/hooks/conversations/useInfiniteConversations';
import { ConversationListItem } from './components/ConversationListItem';

/**
 * Main-panel chats browser.
 *
 * Renders inside the chat layout when the user clicks the sidebar's
 * "Chats" item. Pure UI surface — no URL of its own; toggling lives
 * in :class:`ChatView`'s local state.
 *
 *   - Title
 *   - Title-only search (client-side filter over what's already loaded;
 *     no backend ``?q=`` round-trip — keeps the surface snappy for
 *     typical chat counts).
 *   - Infinite-scroll list. An IntersectionObserver sentinel sits below
 *     the rendered rows; when it enters the viewport we ask for the
 *     next page. No "Load more" button — once you're on the page, just
 *     keep scrolling.
 */
export default function ChatsBrowserView() {
  const [query, setQuery] = useState('');
  const {
    data,
    isLoading,
    isError,
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
  } = useInfiniteConversations();

  const conversations = useMemo(
    () => data?.pages.flat() ?? [],
    [data],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return conversations;
    return conversations.filter((c) =>
      (c.title ?? 'Untitled chat').toLowerCase().includes(q),
    );
  }, [conversations, query]);

  // Intersection-observer sentinel for "load more on scroll". The
  // sentinel is a 1px div rendered after the last row; once it scrolls
  // into the visible area we fire ``fetchNextPage``.
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!hasNextPage) return;
    const el = sentinelRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !isFetchingNextPage) {
          fetchNextPage();
        }
      },
      { rootMargin: '200px' },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  return (
    <div className="flex-1 min-h-0 overflow-y-auto">
      <div className="mx-auto w-full max-w-3xl px-6 py-8">
        <header className="mb-6">
          <h1 className="text-2xl font-bold text-card-foreground">Chats</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Browse and search every conversation you&rsquo;ve had.
          </p>
        </header>

        <div className="relative mb-4">
          <Search
            size={16}
            aria-hidden
            className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none"
          />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search chats by title"
            aria-label="Search chats"
            className="pl-9"
          />
        </div>

        {isLoading ? (
          <p className="text-sm text-muted-foreground py-6">Loading conversations…</p>
        ) : isError ? (
          <p className="text-sm text-destructive py-6">Couldn&rsquo;t load conversations.</p>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <History size={40} className="mx-auto mb-3 opacity-30" aria-hidden />
            <p>
              {query.trim()
                ? `No chats match "${query.trim()}".`
                : 'No conversations yet. Start chatting!'}
            </p>
          </div>
        ) : (
          <>
            <ul className="flex flex-col gap-0.5 list-none m-0 p-0" role="list">
              {filtered.map((c) => (
                <li key={c.id}>
                  <ConversationListItem conversation={c} />
                </li>
              ))}
            </ul>
            <div ref={sentinelRef} aria-hidden className="h-px w-full" />
            {isFetchingNextPage && (
              <p className="text-sm text-muted-foreground py-4 text-center">
                Loading more…
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
