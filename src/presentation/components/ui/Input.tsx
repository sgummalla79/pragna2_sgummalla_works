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
        'w-full rounded-lg border-[1.5px] border-input px-[13px] py-[10px]',
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
Input.displayName = 'Input';

export { Input };
