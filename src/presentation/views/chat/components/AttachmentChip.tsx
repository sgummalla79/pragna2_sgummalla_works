import { FileText, Image as ImageIcon, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Props {
  filename: string;
  contentType: string;
  /** Loading state while the upload is in flight. */
  uploading?: boolean;
  /** Error state when the upload failed (shown red, no remove button). */
  errored?: boolean;
  /** Click handler for the × button. Omitted in read-only contexts
   *  (chat history rendering of already-sent attachments). */
  onRemove?: () => void;
  /** Preview URL for image attachments. When present a thumbnail
   *  replaces the icon. */
  previewUrl?: string;
}

/**
 * R5. A single attachment displayed as a chip — used both in the
 * composer (before send, with × to remove) and in chat history
 * (after send, no remove button; clicking would download).
 *
 * Two visual variants based on content type:
 *   - Images get an inline thumbnail (32×32 cover-fit).
 *   - Everything else gets a generic file icon.
 */
export function AttachmentChip({
  filename,
  contentType,
  uploading,
  errored,
  onRemove,
  previewUrl,
}: Props) {
  const isImage = contentType.startsWith('image/');
  return (
    <div
      className={cn(
        'inline-flex items-center gap-2 rounded-md border px-2 py-1.5',
        'max-w-[220px] text-[12px]',
        errored
          ? 'border-destructive/40 bg-destructive/10 text-destructive'
          : 'border-border bg-card text-card-foreground',
        uploading && 'opacity-60',
      )}
      title={filename}
    >
      {/* Icon / thumbnail slot */}
      <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center overflow-hidden rounded">
        {isImage && previewUrl ? (
          <img
            src={previewUrl}
            alt={filename}
            className="h-full w-full object-cover"
          />
        ) : isImage ? (
          <ImageIcon size={14} aria-hidden="true" className="text-muted-foreground" />
        ) : (
          <FileText size={14} aria-hidden="true" className="text-muted-foreground" />
        )}
      </div>
      <span className="truncate flex-1">{filename}</span>
      {onRemove && !uploading && (
        <button
          type="button"
          onClick={onRemove}
          aria-label={`Remove ${filename}`}
          className={cn(
            'flex h-5 w-5 flex-shrink-0 items-center justify-center rounded',
            'text-muted-foreground hover:bg-accent hover:text-foreground',
            'transition-colors',
          )}
        >
          <X size={12} aria-hidden="true" />
        </button>
      )}
      {uploading && (
        <span className="text-[10px] text-muted-foreground">uploading…</span>
      )}
    </div>
  );
}
