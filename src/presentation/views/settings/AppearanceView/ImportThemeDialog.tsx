import { useEffect, useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';

import { Button } from '@/presentation/components/ui/Button';
import { Label } from '@/presentation/components/ui/Label';
import { Textarea } from '@/presentation/components/ui/Textarea';
import { parseTweakCNInput } from '@/themes/tweakcn';
import { installPalette } from '@/themes/registry';
import { useUiStore } from '@/presentation/store/uiStore';

interface ImportThemeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const PLACEHOLDER = `Paste ANY of these:

· Install URL   →  https://tweakcn.com/r/themes/<name>.json
· CLI command   →  pnpm dlx shadcn@latest add https://tweakcn.com/r/themes/<name>.json
· CSS           →  :root { --background: oklch(...); ... } .dark { ... }
                   (TweakCN "Code" panel → "index.css" tab)
· JSON          →  { "name": "...", "cssVars": { "light": {...}, "dark": {...} } }`;

/**
 * Install a TweakCN palette via paste — any of four shapes:
 *
 *   - **Install URL** (`https://tweakcn.com/r/themes/<name>.json`) —
 *     we fetch + parse as JSON.
 *   - **CLI command** containing the URL (the pnpm / npm / yarn / bun
 *     tabs in TweakCN's Code panel) — we extract the URL.
 *   - **CSS** — what the Code panel's `index.css` tab shows by
 *     default; `:root { ... } .dark { ... }` blocks.
 *   - **JSON** — the underlying registry-item format (advanced).
 *
 * Validated via :func:`parseTweakCNInput`, persisted via
 * :func:`installPalette`, and made active immediately so the user
 * sees the new palette without leaving the dialog.
 */
export function ImportThemeDialog({ open, onOpenChange }: ImportThemeDialogProps) {
  const setPaletteId = useUiStore((s) => s.setPaletteId);

  const [text, setText] = useState('');
  const [label, setLabel] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setText('');
      setLabel('');
      setError(null);
      setBusy(false);
    }
  }, [open]);

  async function handleInstall() {
    setError(null);
    setBusy(true);
    try {
      // URL / CLI command paths fetch over the network — async; CSS and
      // JSON paths resolve immediately.
      const theme = await parseTweakCNInput(text.trim(), label.trim() || 'imported');
      const palette = installPalette({
        theme,
        label: label.trim() || theme.name,
      });
      setPaletteId(palette.id);
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not install theme.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay
          className="fixed inset-0 z-[700] bg-black/60"
          style={{ backdropFilter: 'blur(4px)' }}
        />
        <Dialog.Content
          className="
            fixed left-1/2 top-1/2 z-[701] -translate-x-1/2 -translate-y-1/2
            w-[640px] max-w-[calc(100vw-32px)]
            max-h-[calc(100vh-48px)] overflow-y-auto
            flex flex-col gap-4
            rounded-[14px] border border-border
            bg-popover p-6
          "
          style={{ boxShadow: '0 24px 60px rgba(0,0,0,0.45)' }}
        >
          <Dialog.Title className="text-base font-bold text-foreground m-0">
            Install a TweakCN theme
          </Dialog.Title>
          <Dialog.Description className="text-[13px] text-muted-foreground m-0 leading-relaxed">
            On <a
              href="https://tweakcn.com"
              target="_blank"
              rel="noreferrer"
              className="underline text-primary"
            >tweakcn.com</a>, pick a theme and click <strong>Code</strong>.
            Either copy the CLI command (top tabs) or open the{' '}
            <code className="font-mono text-[11.5px]">index.css</code> tab
            and copy the CSS. Paste below and Install.
          </Dialog.Description>

          <div className="space-y-1.5">
            <Label htmlFor="theme-label">Label (optional)</Label>
            <input
              id="theme-label"
              type="text"
              placeholder="e.g. Cozy night"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              className="flex h-11 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
            <p className="text-[11px] text-muted-foreground">
              Defaults to the theme's name. Shown in the palette grid.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="theme-input">URL · CLI command · CSS · JSON</Label>
            <Textarea
              id="theme-input"
              rows={12}
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={PLACEHOLDER}
              className="font-mono text-[11.5px]"
              spellCheck={false}
            />
          </div>

          {error && (
            <p role="alert" className="text-[12px] text-destructive m-0">
              {error}
            </p>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <Dialog.Close asChild>
              <Button variant="ghost" size="sm" disabled={busy}>Cancel</Button>
            </Dialog.Close>
            <Button
              variant="default"
              size="sm"
              onClick={() => void handleInstall()}
              disabled={busy || text.trim().length === 0}
              aria-busy={busy}
            >
              {busy ? 'Installing…' : 'Install theme'}
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
