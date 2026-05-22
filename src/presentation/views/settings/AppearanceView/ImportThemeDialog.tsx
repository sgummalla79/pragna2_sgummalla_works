import { useEffect, useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';

import { Button } from '@/presentation/components/ui/Button';
import { Label } from '@/presentation/components/ui/Label';
import { Textarea } from '@/presentation/components/ui/Textarea';
import { parseTweakCNTheme } from '@/themes/tweakcn';
import { installPalette } from '@/themes/registry';
import { useUiStore } from '@/presentation/store/uiStore';

interface ImportThemeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const PLACEHOLDER = `{
  "name": "my-theme",
  "cssVars": {
    "light": { "background": "oklch(...)", "foreground": "oklch(...)", ... },
    "dark":  { "background": "oklch(...)", "foreground": "oklch(...)", ... }
  }
}`;

/**
 * Install a TweakCN palette via paste-in JSON.
 *
 * Flow:
 *   1. User copies the **Code → JSON** export from tweakcn.com.
 *   2. Pastes into the textarea here.
 *   3. We validate the shape via :func:`parseTweakCNTheme`.
 *   4. Persist to localStorage via :func:`installPalette`.
 *   5. Switch the active palette to it so the user sees it immediately.
 *
 * TweakCN's "Copy as JSON" output is what we expect — exactly what the
 * ``shadcn add <url>`` CLI consumes. We don't fetch the URL ourselves
 * because TweakCN may serve CORS-restricted JSON; copy-paste sidesteps
 * that entirely.
 */
export function ImportThemeDialog({ open, onOpenChange }: ImportThemeDialogProps) {
  const setPaletteId = useUiStore((s) => s.setPaletteId);

  const [jsonText, setJsonText] = useState('');
  const [label, setLabel] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setJsonText('');
      setLabel('');
      setError(null);
    }
  }, [open]);

  function handleInstall() {
    setError(null);
    try {
      const theme = parseTweakCNTheme(jsonText.trim());
      const palette = installPalette({
        theme,
        label: label.trim() || theme.name,
      });
      setPaletteId(palette.id);
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not install theme.');
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
            Paste the JSON from <a
              href="https://tweakcn.com"
              target="_blank"
              rel="noreferrer"
              className="underline text-primary"
            >tweakcn.com</a> — choose a theme, click <strong>Code</strong>,
            copy the JSON, paste below, and Install.
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
              Defaults to the JSON's <code>name</code> field.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="theme-json">TweakCN JSON</Label>
            <Textarea
              id="theme-json"
              rows={12}
              value={jsonText}
              onChange={(e) => setJsonText(e.target.value)}
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
              <Button variant="ghost" size="sm">Cancel</Button>
            </Dialog.Close>
            <Button
              variant="default"
              size="sm"
              onClick={handleInstall}
              disabled={jsonText.trim().length === 0}
            >
              Install theme
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
