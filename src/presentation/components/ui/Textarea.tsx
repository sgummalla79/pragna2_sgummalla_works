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
        'w-full resize-y rounded-lg border-[1.5px] border-input px-[13px] py-[10px]',
        'bg-transparent text-[14px] text-foreground outline-none',
        'placeholder:text-muted-foreground',
        'transition-colors duration-150',
        'focus:border-primary',
        'disabled:cursor-not-allowed disabled:opacity-50',
        className
      )}
      {...props}
    />
  )
);
Textarea.displayName = 'Textarea';

export { Textarea };
