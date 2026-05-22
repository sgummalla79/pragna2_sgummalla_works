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
        // Matches Input.tsx — `bg-input` fill, --color-border for the
        // edge, --color-ring on focus. Keeps the form palette coherent
        // (input + textarea + select trigger all read the same tokens).
        'w-full resize-y rounded-lg border border-border px-[13px] py-[10px]',
        'bg-input text-[14px] text-foreground outline-none',
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
