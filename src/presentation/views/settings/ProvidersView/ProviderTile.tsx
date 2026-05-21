import { useState } from 'react';
import { cn } from '@/lib/utils';
import { providerColor, providerInitial } from '@/constants/providers';
import { PROVIDER_LOGO_URLS, MONO_BLACK_PROVIDERS } from '@/assets/providerLogos';
import type { LlmProvider } from '@/domain/types/provider.types';

interface ProviderTileProps {
  llmProvider: LlmProvider;
  connected: boolean;
  onClick: () => void;
}

/**
 * Provider tile card — mirrors the ps-tile structure from ProvidersSettings.vue.
 *
 * Shows the real SVG logo when available; falls back to the coloured initial.
 * Mono-black logos (openai, groq, perplexity) are inverted for the dark UI.
 * Layout: logo → body (name + sub-label, flex-1) → footer (status badge).
 */
export function ProviderTile({ llmProvider, connected, onClick }: ProviderTileProps) {
  const [hovered, setHovered] = useState(false);
  const { bg, fg } = providerColor(llmProvider.name);
  const logoUrl = PROVIDER_LOGO_URLS[llmProvider.name];
  const isMonoBlack = MONO_BLACK_PROVIDERS.has(llmProvider.name);

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => e.key === 'Enter' && onClick()}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className={cn(
        'relative flex flex-col gap-3 rounded-2xl border-[1.5px] cursor-pointer select-none',
        'pt-5 px-4 pb-3.5 bg-[#282828] min-h-[200px]',
        'transition-[border-color,box-shadow] duration-[180ms]',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-brand-ring)]',
        hovered
          ? 'border-[#c97040] shadow-[0_4px_16px_rgba(0,0,0,0.1)]'
          : connected
          ? 'border-[rgba(34,197,94,0.4)]'
          : 'border-[rgba(239,68,68,0.4)]'
      )}
    >
      {/* Logo — always 64×64 so every tile has an identical logo area */}
      {logoUrl ? (
        <img
          src={logoUrl}
          alt={llmProvider.name}
          className={cn('h-16 w-16 flex-shrink-0 rounded-[10px] object-contain', isMonoBlack && 'invert')}
        />
      ) : (
        <div
          className="flex h-16 w-16 flex-shrink-0 items-center justify-center rounded-[10px] text-[26px] font-bold"
          style={{ background: bg, color: fg }}
          aria-hidden="true"
        >
          {providerInitial(llmProvider.name)}
        </div>
      )}

      {/* Body — name + sub-label, grows to push footer to bottom */}
      <div className="flex flex-1 flex-col gap-[3px]">
        <span className="text-[14px] font-bold text-[#ececea]">
          {llmProvider.displayName}
        </span>
        <span className="text-[11.5px] leading-[1.4] text-[#737373]">
          {llmProvider.name}
        </span>
      </div>

      {/* Footer — status badge */}
      <div className="flex flex-wrap items-center gap-2">
        <span
          className={cn(
            'whitespace-nowrap rounded-full px-2.5 py-[3px] text-[11px] font-semibold flex-shrink-0',
            connected ? 'bg-[#22c55e] text-black' : 'bg-[#ef4444] text-white'
          )}
        >
          {connected ? 'Connected ✓' : 'Not connected'}
        </span>
      </div>
    </div>
  );
}
