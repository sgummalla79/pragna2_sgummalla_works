import { useState } from 'react';
import { History } from 'lucide-react';
import { useConversations, useConversationUsage } from '@/presentation/hooks/conversations/useConversations';
import { formatUsd } from '@/domain/utils/formatCost';
import { formatTokens } from '@/domain/utils/formatTokens';
import { Button } from '@/presentation/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/presentation/components/ui/Card';
import { Separator } from '@/presentation/components/ui/Separator';

function UsagePanel({ conversationId }: { conversationId: string }) {
  const { data, isLoading } = useConversationUsage(conversationId);
  if (isLoading) return <p className="text-sm text-muted-foreground py-2">Loading usage…</p>;
  if (!data) return null;
  return (
    <div className="mt-3 space-y-2">
      <Separator />
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mt-2">Per-node cost</p>
      <ul className="list-none space-y-1">
        {data.records.map((r) => (
          <li key={r.id} className="flex justify-between text-xs text-muted-foreground">
            <span className="font-mono">{r.nodeId}</span>
            <span>{formatTokens(r.inputTokens + r.outputTokens)} tokens · {formatUsd(r.costUsd)}</span>
          </li>
        ))}
      </ul>
      <div className="flex justify-between text-sm font-medium pt-1">
        <span>Total</span>
        <span>{formatTokens(data.totalInputTokens + data.totalOutputTokens)} tokens · {formatUsd(data.totalCostUsd)}</span>
      </div>
    </div>
  );
}

export default function ConversationsView() {
  const [page, setPage] = useState(0);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const { data: conversations = [], isLoading } = useConversations(page);

  function toggleExpand(id: string) {
    setExpandedId((prev) => (prev === id ? null : id));
  }

  return (
    <div className="p-4 md:p-8 max-w-3xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Conversation History</h1>
        <p className="text-muted-foreground text-sm mt-1">Browse past conversations and view per-node token usage.</p>
      </div>

      {isLoading ? (
        <p className="text-muted-foreground text-sm">Loading conversations…</p>
      ) : conversations.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <History size={40} className="mx-auto mb-3 opacity-30" aria-hidden="true" />
          <p>No conversations yet. Start chatting!</p>
        </div>
      ) : (
        <>
          <ul className="space-y-3 list-none" role="list">
            {conversations.map((c) => (
              <li key={c.id}>
                <Card>
                  <CardContent className="py-4">
                    <button
                      onClick={() => toggleExpand(c.id)}
                      className="w-full text-left"
                      aria-expanded={expandedId === c.id}
                    >
                      <CardHeader className="p-0">
                        <CardTitle className="text-sm font-medium">
                          {c.title ?? 'Untitled conversation'}
                        </CardTitle>
                        <p className="text-xs text-muted-foreground">
                          {new Date(c.createdAt).toLocaleString()}
                        </p>
                      </CardHeader>
                    </button>
                    {expandedId === c.id && <UsagePanel conversationId={c.id} />}
                  </CardContent>
                </Card>
              </li>
            ))}
          </ul>
          <div className="flex justify-between mt-4">
            <Button variant="outline" onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={page === 0} size="sm">
              Previous
            </Button>
            <Button variant="outline" onClick={() => setPage((p) => p + 1)} disabled={conversations.length < 20} size="sm">
              Next
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
