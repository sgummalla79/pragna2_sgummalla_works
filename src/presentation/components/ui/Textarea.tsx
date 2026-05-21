import * as React from 'react';
import { cn } from '@/lib/utils';

export type TextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement>;

/**
 * Multi-line text input — same visual spec as Input:
 * - Background:  rgba(255,255,255,0.07) translucent surface
 * - Border:      1.5px solid rgba(255,255,255,0.12), copper on focus
 * - Radius:      8px, padding 10px 13px, text 14px #ececea
 *
 * Use whenever you need a textarea that matches the Input component exactly.
 */
const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, ...props }, ref) => (
    <textarea
      ref={ref}
      className={cn(
        'w-full resize-y rounded-lg border-[1.5px] px-[13px] py-[10px]',
        'bg-[rgba(255,255,255,0.07)] text-[14px] text-[#ececea] outline-none',
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
