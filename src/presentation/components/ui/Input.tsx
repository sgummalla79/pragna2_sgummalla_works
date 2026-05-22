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
        // `bg-input` is the fill (newer shadcn convention — TweakCN
        // themes treat --input as the field surface, not just a border
        // color). Typed text uses card-foreground (~98% lightness)
        // rather than foreground (~80%) so values read crisp against
        // the input fill — matches TweakCN's preview convention.
        'w-full rounded-lg border border-border px-[13px] py-[10px]',
        'bg-input text-[14px] text-card-foreground outline-none',
        // Bold the value when the field has actual content; placeholder
        // stays at the default weight. `:not(:placeholder-shown)` is the
        // standard CSS way to detect "has user input" without a JS hook.
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
Input.displayName = 'Input';

export { Input };
