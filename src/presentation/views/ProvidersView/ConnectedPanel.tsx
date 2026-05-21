import { Button } from '@/presentation/components/ui/Button';
import { Separator } from '@/presentation/components/ui/Separator';
import { ModelGrid } from './ModelGrid';
import type { UserProvider } from '@/domain/types/provider.types';
import type { Model } from '@/domain/types/model.types';

interface ConnectedPanelProps {
  userProvider: UserProvider;
  models: Model[];
  disconnecting: boolean;
  error: string;
  refreshing: boolean;
  onDisconnect: () => void;
  onRefresh: () => void;
  onClose: () => void;
}

/**
 * Modal panel shown when the provider is already connected.
 * Shows a full model management grid — display name inline editable,
 * toggles (enabled / chat / flows) fire immediately.
 */
export function ConnectedPanel({
  userProvider,
  models,
  disconnecting,
  error,
  refreshing,
  onDisconnect,
  onRefresh,
}: ConnectedPanelProps) {
  return (
    <div className="flex flex-col gap-5 flex-1 min-h-0">
      {/* Status + Disconnect row */}
      <div className="flex items-center gap-3">
        <div className="flex flex-1 items-center gap-2 rounded-xl border border-green-500/30 bg-green-500/[0.08] px-4 py-2.5">
          <span className="text-green-500" aria-hidden="true">✓</span>
          <span className="text-sm font-semibold text-green-500">Connected</span>
          <span className="ml-auto text-[11px] text-[#737373] font-mono">{userProvider.providerName}</span>
        </div>
        <Button
          variant="danger"
          onClick={onDisconnect}
          disabled={disconnecting}
          aria-busy={disconnecting}
        >
          {disconnecting ? 'Removing…' : 'Disconnect'}
        </Button>
      </div>

      {error && (
        <p role="alert" className="text-[13px] text-[#ef4444]">{error}</p>
      )}

      <Separator />

      {/* Models header */}
      <div className="flex items-center justify-between">
        <div className="flex flex-col gap-0.5">
          <span className="text-sm font-bold text-[#ececea]">
            Models
            {models.length > 0 && (
              <span className="ml-2 text-[11px] font-normal text-[#737373]">
                {models.length} discovered
              </span>
            )}
          </span>
          <span className="text-[11px] text-[#737373]">
            Click display name to rename · Dots toggle on/off instantly
          </span>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={onRefresh}
          disabled={refreshing}
          aria-busy={refreshing}
        >
          {refreshing ? 'Refreshing…' : 'Refresh'}
        </Button>
      </div>

      {/* Model grid — fills remaining space and scrolls within it */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        <ModelGrid models={models} />
      </div>
    </div>
  );
}
