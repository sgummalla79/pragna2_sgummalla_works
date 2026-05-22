import { useMemo } from 'react';
import { useModels } from '@/presentation/hooks/models/useModels';

interface Props {
  /** The user_model id stamped on the assistant message at write-time
   *  by the backend (R4 #0). `null` / `undefined` renders nothing. */
  userModelId: string | null | undefined;
}

/**
 * Quiet "by Claude Sonnet 4.6" attribution rendered under assistant turns.
 *
 * Looks up the model in the user's existing :func:`useModels` cache —
 * the hook is already warm because the conversation header's
 * AgentPicker / model selectors share it, so this adds zero extra
 * round-trips. When the id doesn't resolve (model later archived,
 * historical pre-R4 turn with NULL id, transient cache miss), we
 * render nothing rather than a fallback placeholder — better empty
 * than wrong.
 *
 * Styling is intentionally muted (small font, muted-foreground color)
 * so the attribution feels like metadata rather than message content.
 */
export function ModelBadge({ userModelId }: Props) {
  const { data: models } = useModels();

  const displayName = useMemo(() => {
    if (!userModelId || !models) return null;
    const hit = models.find((m) => m.id === userModelId);
    return hit?.displayName ?? null;
  }, [models, userModelId]);

  if (!displayName) return null;

  return (
    <span className="text-[11px] text-muted-foreground select-none">
      by {displayName}
    </span>
  );
}
