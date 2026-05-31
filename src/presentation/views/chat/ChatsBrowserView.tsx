import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { History, Search } from 'lucide-react';
import { ROUTES } from '@/constants/routes';
import { Button } from '@/presentation/components/ui/Button';
import { Input } from '@/presentation/components/ui/Input';
import { useInfiniteConversations } from '@/presentation/hooks/conversations/useInfiniteConversations';

/** Relative-time labels — fixed boundaries (math constants, not config). */
const MINUTE_MS = 60_000;
const HOUR_MS = 3_600_000;
const DAY_MS = 86_400_000;
const RELATIVE_DAY_CUTOFF = 30; // beyond this, show an absolute date

/**
 * Human-friendly "time ago" for a conversation's created_at — "10 hours
 * ago", "yesterday", "3 days ago", then an absolute date for older chats.
 */
function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < HOUR_MS) {
    const m = Math.max(1, Math.floor(diff / MINUTE_MS));
    return m === 1 ? '1 minute ago' : `${m} minutes ago`;
  }
  if (diff < DAY_MS) {
    const h = Math.floor(diff / HOUR_MS);
    return h === 1 ? '1 hour ago' : `${h} hours ago`;
  }
  const days = Math.floor(diff / DAY_MS);
  if (days === 1) return 'yesterday';
  if (days < RELATIVE_DAY_CUTOFF) return `${days} days ago`;
  return new Date(iso).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

interface ChatsBrowserViewProps {
  /** Start a brand-new chat (exits browse mode + routes to the landing). */
  onNewChat?: () => void;
}

/**
 * Main-panel chats browser.
 *
 * Renders inside the chat layout when the user clicks the sidebar's
 * "Chats" item (``ChatView.browseMode``). A clean, full-width list:
 *
 *   - Title + a "New chat" action.
 *   - Title-only search (client-side filter over what's already loaded).
 *   - Infinite-scroll rows, each showing the conversation title and a
 *     relative timestamp, separated by hairlines. An IntersectionObserver
 *     sentinel below the rows requests the next page on scroll.
 */
export default function ChatsBrowserView({ onNewChat }: ChatsBrowserViewProps) {
  const [query, setQuery] = useState('');
  const {
    data,
    isLoading,
    isError,
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
  } = useInfiniteConversations();

  const conversations = useMemo(() => data?.pages.flat() ?? [], [data]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return conversations;
    return conversations.filter((c) =>
      (c.title ?? 'Untitled chat').toLowerCase().includes(q),
    );
  }, [conversations, query]);

  // Intersection-observer sentinel for "load more on scroll".
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
        <header className="mb-6 flex items-center justify-between gap-4">
          <h1 className="text-3xl font-bold text-card-foreground">Chats</h1>
          {onNewChat && (
            <Button onClick={onNewChat} className="shrink-0">
              New chat
            </Button>
          )}
        </header>

        <div className="relative mb-2">
          <Search
            size={18}
            aria-hidden
            className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none"
          />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search chats…"
            aria-label="Search chats"
            className="h-12 pl-11 text-[15px]"
          />
        </div>

        {isLoading ? (
          <p className="text-sm text-muted-foreground py-6">
            Loading conversations…
          </p>
        ) : isError ? (
          <p className="text-sm text-destructive py-6">
            Couldn&rsquo;t load conversations.
          </p>
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
            <ul className="flex flex-col list-none m-0 p-0" role="list">
              {filtered.map((c) => (
                <li key={c.id} className="border-b border-border/50">
                  <Link
                    to={`${ROUTES.CHAT}/${c.id}`}
                    className={[
                      'group flex items-baseline gap-3 px-1 py-4 no-underline',
                      'transition-colors hover:bg-accent/40',
                    ].join(' ')}
                    title={c.title ?? 'Untitled chat'}
                  >
                    <span className="min-w-0 flex-1 truncate text-[15px] text-card-foreground">
                      {c.title?.trim() || 'Untitled chat'}
                    </span>
                    <span className="shrink-0 text-[13px] text-muted-foreground">
                      {relativeTime(c.createdAt)}
                    </span>
                  </Link>
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
