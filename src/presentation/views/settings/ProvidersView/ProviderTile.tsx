import { useState } from 'react';
import { cn } from '@/lib/utils';
import { providerColor, providerInitial } from '@/constants/providers';
import { PROVIDER_LOGO_URLS, MONO_BLACK_PROVIDERS } from '@/assets/providerLogos';
import type { LlmProvider } from '@/domain/types/provider.types';

interface ProviderTileProps {
  llmProvider: LlmProvider;
  connected: boolean;
  /** UserProvider.enabled — undefined when not connected. */
  providerEnabled?: boolean;
  /** Calls PATCH /api/user-providers/{id} to flip the enabled state. Only set when connected. */
  onToggleEnabled?: () => void;
  onClick: () => void;
}

/**
 * 10×10rem square provider tile.
 * Top-right: enable/disable toggle pill — only shown when connected, calls PATCH on click.
 * Bottom: connected status badge.
 */
export function ProviderTile({
  llmProvider,
  connected,
  providerEnabled,
  onToggleEnabled,
  onClick,
}: ProviderTileProps) {
  const [hovered, setHovered] = useState(false);
  const [toggling, setToggling] = useState(false);
  const { bg, fg } = providerColor(llmProvider.name);
  const logoUrl     = PROVIDER_LOGO_URLS[llmProvider.name];
  const isMonoBlack = MONO_BLACK_PROVIDERS.has(llmProvider.name);

  async function handleToggle(e: React.MouseEvent) {
    e.stopPropagation(); // don't open modal
    if (!onToggleEnabled || toggling) return;
    setToggling(true);
    try {
      await onToggleEnabled();
    } finally {
      setToggling(false);
    }
  }

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => e.key === 'Enter' && onClick()}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className={cn(
        'relative w-40 h-40 flex flex-col gap-2 rounded-2xl border-[1.5px] cursor-pointer select-none',
        'pt-4 px-3.5 pb-3 bg-card',
        'transition-[border-color,box-shadow] duration-[180ms]',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        // Border weight signals "is this provider connected" via the
        // palette: primary for connected (positive), destructive for
        // disconnected. Hover bumps the alpha + adds a soft shadow tinted
        // by the same token. Following palette only — no hardcoded hex.
        hovered
          ? connected
            ? 'border-primary/85 shadow-[0_4px_16px_color-mix(in_oklab,var(--color-primary)_12%,transparent)]'
            : 'border-destructive/85 shadow-[0_4px_16px_color-mix(in_oklab,var(--color-destructive)_12%,transparent)]'
          : connected
          ? 'border-primary/40'
          : 'border-destructive/40'
      )}
    >
      {/* Enable/disable toggle pill — top-right, only when connected */}
      {connected && (
        <button
          type="button"
          onClick={handleToggle}
          disabled={toggling}
          aria-pressed={providerEnabled}
          aria-label={providerEnabled ? 'Disable provider' : 'Enable provider'}
          className={cn(
            'absolute top-2.5 right-2.5 inline-flex items-center gap-1 rounded-full',
            'px-2 py-[3px] text-[10px] font-semibold border transition-colors duration-150',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
            'disabled:opacity-50 disabled:cursor-not-allowed',
            // Both states drive off palette tokens — primary (on) and
            // muted (off, semantic "disabled but recoverable"). No
            // hardcoded violet/green/red anywhere.
            providerEnabled
              ? 'bg-primary text-primary-foreground border-primary hover:bg-primary/90'
              : 'bg-muted text-muted-foreground border-border hover:bg-accent hover:text-accent-foreground',
          )}
        >
          <span
            className={cn(
              'h-1.5 w-1.5 rounded-full flex-shrink-0',
              providerEnabled ? 'bg-primary-foreground' : 'bg-muted-foreground'
            )}
            aria-hidden="true"
          />
          {toggling ? '…' : providerEnabled ? 'On' : 'Off'}
        </button>
      )}

      {/* Logo — 36×36 */}
      {logoUrl ? (
        <img
          src={logoUrl}
          alt={llmProvider.name}
          className={cn('h-9 w-9 flex-shrink-0 rounded-[8px] object-contain', isMonoBlack && 'invert')}
        />
      ) : (
        <div
          className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-[8px] text-[16px] font-bold"
          style={{ background: bg, color: fg }}
          aria-hidden="true"
        >
          {providerInitial(llmProvider.name)}
        </div>
      )}

      {/* Name + technical identifier */}
      <div className="flex flex-1 flex-col gap-[2px]">
        <span className="text-[13px] font-bold text-foreground leading-tight">
          {llmProvider.displayName}
        </span>
        <span className="text-[10.5px] leading-[1.3] text-muted-foreground">
          {llmProvider.name}
        </span>
      </div>

      {/* Connected badge — bottom. Connected = primary tint (positive,
          matches the border treatment above); Not-connected = destructive
          tint (matches the disconnected border). Pure palette tokens. */}
      <div className="flex items-center">
        <span
          className={cn(
            'inline-flex items-center gap-1.5 rounded-full px-2 py-[2px] text-[10px] font-semibold border flex-shrink-0',
            connected
              ? 'bg-primary/10 text-primary border-primary/30'
              : 'bg-destructive/10 text-destructive border-destructive/30',
          )}
        >
          {connected ? 'Connected ✓' : 'Not connected'}
        </span>
      </div>
    </div>
  );
}
