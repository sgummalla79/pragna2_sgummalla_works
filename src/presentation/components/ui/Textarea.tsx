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
        'w-full resize-y rounded-lg border-[1.5px] px-[13px] py-[10px]',
        'bg-[rgba(255,255,255,0.07)] text-[14px] text-foreground outline-none',
        'border-[rgba(255,255,255,0.12)]',
        'placeholder:text-[rgba(255,255,255,0.3)]',
        'transition-colors duration-150',
        'focus:border-[#c97040]',
        'disabled:cursor-not-allowed disabled:opacity-50',
        className
      )}
      {...props}
    />
  )
);
Textarea.displayName = 'Textarea';

export { Textarea };
