import * as React from 'react';
import { cn } from '@/lib/utils';

export type TextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement>;

/**
 * Multi-line text input — themed via semantic tokens (see docs/THEMES.md).
 * Matches :class:`Input` visually; use it whenever a multi-line variant
 * is needed.
 */
const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, ...props }, ref) => (
    <textarea
      ref={ref}
      className={cn(
        // Matches Input.tsx — `bg-input` fill, `--color-border` edge,
        // `--color-ring` focus halo, `text-card-foreground` for typed
        // content (brighter than `text-foreground` so values stand out
        // against the field fill).
        'w-full resize-y rounded-lg border border-border px-[13px] py-[10px]',
        'bg-input text-[14px] text-card-foreground outline-none',
        '[&:not(:placeholder-shown)]:font-semibold',
        'placeholder:text-muted-foreground',
        'transition-colors duration-150',
        'focus:border-primary focus:ring-2 focus:ring-ring/40',
        'disabled:cursor-not-allowed disabled:opacity-50',
        className
      )}
      {...props}
    />
  )
);
Textarea.displayName = 'Textarea';

export { Textarea };
