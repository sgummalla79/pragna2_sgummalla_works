import { useMemo, useState } from 'react';
import { Check, Moon, Plus, Sun, Trash2 } from 'lucide-react';

import { Button } from '@/presentation/components/ui/Button';
import { Card, CardContent } from '@/presentation/components/ui/Card';
import { Badge } from '@/presentation/components/ui/Badge';
import { useUiStore } from '@/presentation/store/uiStore';
import type { Palette, ThemeMode } from '@/themes/types';
import { listPalettes, uninstallPalette } from '@/themes/registry';
import { ImportThemeDialog } from './ImportThemeDialog';

/**
 * Settings → Appearance.
 *
 * Two controls:
 *   1. Mode toggle (Light / Dark) — flips `data-theme` + reapplies palette.
 *   2. Palette grid — bundled palettes first, then installed ones from
 *      localStorage. Click a card to activate. Installed palettes show
 *      a delete button (with a confirm), bundled ones don't.
 *   3. "Install from TweakCN" button → opens :class:`ImportThemeDialog`.
 */
export default function AppearanceView() {
  const theme = useUiStore((s) => s.theme);
  const paletteId = useUiStore((s) => s.paletteId);
  const setTheme = useUiStore((s) => s.setTheme);
  const setPaletteId = useUiStore((s) => s.setPaletteId);
  const refreshPalette = useUiStore((s) => s.refreshPalette);

  const [importOpen, setImportOpen] = useState(false);
  // `paletteId` change triggers re-render; we list palettes each render
  // so localStorage adds/removes flow through without extra wiring.
  const palettes = useMemo(() => listPalettes(), [paletteId]);

  function handleUninstall(p: Palette) {
    if (!window.confirm(`Remove "${p.label}"?`)) return;
    uninstallPalette(p.id);
    // refreshPalette resolves the active palette again — if we just
    // removed the active one, it falls back to the bundled default.
    refreshPalette();
  }

  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Appearance</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Pick a light/dark mode and a palette. Install new palettes from{' '}
          <a
            href="https://tweakcn.com"
            target="_blank"
            rel="noreferrer"
            className="underline text-primary"
          >tweakcn.com</a>.
        </p>
      </div>

      {/* ── Mode toggle ────────────────────────────────────────────── */}
      <section className="mb-8">
        <h2 className="text-sm font-semibold mb-2">Mode</h2>
        <div className="inline-flex rounded-md border border-border bg-card p-1">
          <ModeButton
            active={theme === 'light'}
            onClick={() => setTheme('light')}
            icon={<Sun size={14} aria-hidden="true" />}
            label="Light"
          />
          <ModeButton
            active={theme === 'dark'}
            onClick={() => setTheme('dark')}
            icon={<Moon size={14} aria-hidden="true" />}
            label="Dark"
          />
        </div>
      </section>

      {/* ── Palette grid ──────────────────────────────────────────── */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold">Palette</h2>
          <Button size="sm" variant="outline" onClick={() => setImportOpen(true)}>
            <Plus size={14} aria-hidden="true" />
            Install from TweakCN
          </Button>
        </div>

        <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3 list-none" role="list">
          {palettes.map((p) => (
            <PaletteCard
              key={p.id}
              palette={p}
              mode={theme}
              active={p.id === paletteId}
              onActivate={() => setPaletteId(p.id)}
              onUninstall={() => handleUninstall(p)}
            />
          ))}
        </ul>
      </section>

      <ImportThemeDialog open={importOpen} onOpenChange={setImportOpen} />
    </div>
  );
}

function ModeButton({
  active, onClick, icon, label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={
        active
          ? 'inline-flex items-center gap-1.5 rounded-[5px] bg-primary px-3 py-1.5 text-[12.5px] font-medium text-primary-foreground'
          : 'inline-flex items-center gap-1.5 rounded-[5px] px-3 py-1.5 text-[12.5px] font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors'
      }
    >
      {icon}
      {label}
    </button>
  );
}

interface PaletteCardProps {
  palette: Palette;
  mode: ThemeMode;
  active: boolean;
  onActivate: () => void;
  onUninstall: () => void;
}

/** Per-palette preview card with five colour swatches. Swatches read
 *  the palette's tokens directly (not the runtime DOM) so the preview
 *  reflects each palette regardless of which one is active. */
function PaletteCard({
  palette, mode, active, onActivate, onUninstall,
}: PaletteCardProps) {
  const block = palette.theme.cssVars[mode];
  const swatches: { key: string; tooltip: string }[] = [
    { key: 'background', tooltip: 'background' },
    { key: 'card',       tooltip: 'card' },
    { key: 'primary',    tooltip: 'primary' },
    { key: 'accent',     tooltip: 'accent' },
    { key: 'border',     tooltip: 'border' },
  ];

  return (
    <li>
      <Card
        className={
          active
            ? 'relative border-primary ring-2 ring-primary/30 cursor-pointer'
            : 'relative cursor-pointer hover:border-primary/50'
        }
      >
        {/* Remove sits absolute so installed tiles match bundled tile heights
            exactly — the action footer used to add ~36px to installed cards. */}
        {!palette.bundled && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onUninstall(); }}
            aria-label={`Remove ${palette.label}`}
            title={`Remove ${palette.label}`}
            className="absolute right-2 top-2 z-10 inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-destructive transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)]"
          >
            <Trash2 size={13} aria-hidden="true" />
          </button>
        )}

        <CardContent className="py-4">
          <button
            type="button"
            onClick={onActivate}
            className="w-full text-left"
          >
            {/* Reserve room on the right for the absolute Remove button so
                long labels don't slip underneath it. */}
            <div className="flex items-start justify-between gap-2 mb-3 pr-8">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-medium truncate">{palette.label}</p>
                  {active && (
                    <Badge variant="default" className="gap-1 px-1.5 py-0">
                      <Check size={10} aria-hidden="true" />
                      Active
                    </Badge>
                  )}
                  {!palette.bundled && (
                    <Badge variant="secondary" className="text-[10px]">Installed</Badge>
                  )}
                </div>
                <p className="font-mono text-[11px] text-muted-foreground truncate">
                  {palette.id}
                </p>
                {/* Always render the description slot so bundled tiles
                    (which carry a one-liner) and pasted-from-TweakCN tiles
                    (which usually don't) have matching heights. min-h
                    reserves ~2 lines of text-xs; line-clamp keeps any long
                    description from blowing past the swatch row. */}
                <p className="text-xs text-muted-foreground mt-0.5 min-h-[2.25rem] line-clamp-2">
                  {palette.description ?? ' '}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              {swatches.map((s) => (
                <div
                  key={s.key}
                  title={`${s.tooltip}: ${block[s.key] ?? '(unset)'}`}
                  className="h-7 w-7 rounded-md border border-border"
                  style={{ background: block[s.key] ?? 'transparent' }}
                  aria-hidden="true"
                />
              ))}
              <span className="text-[10.5px] text-muted-foreground ml-1">
                {mode} preview
              </span>
            </div>
          </button>
        </CardContent>
      </Card>
    </li>
  );
}
