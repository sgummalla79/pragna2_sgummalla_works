import * as React from 'react';
import { cn } from '@/lib/utils';

export type InputProps = React.InputHTMLAttributes<HTMLInputElement>;

/**
 * Base text input — flat surface, copper focus ring, themed via
 * semantic tokens (see docs/THEMES.md). Single source of truth for
 * input styling in the app; change here → updates everywhere.
 */
const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, disabled, ...props }, ref) => (
    <input
      ref={ref}
      disabled={disabled}
      className={cn(
        'w-full rounded-lg border-[1.5px] px-[13px] py-[10px]',
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
Input.displayName = 'Input';

export { Input };
