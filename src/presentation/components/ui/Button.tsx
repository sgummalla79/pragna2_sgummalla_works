import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const buttonVariants = cva(
  // Base button text matches the compact form Label exactly — tiny
  // 10px uppercase with tracking-wider — so admin-form labels and CTAs
  // share one visual language. Size variants no longer override the
  // text-size (they used to bump text up to 12/14/16px); they only
  // control HEIGHT + padding now, so a "lg" button is taller with the
  // same tiny label, not a bigger label.
  // User-facing buttons that want sentence-case (e.g. chat-stop, send,
  // link-style breadcrumbs) opt out via their own `className`
  // (`normal-case tracking-normal text-sm`).
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-[10px] font-semibold uppercase tracking-wider transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)] disabled:pointer-events-none disabled:opacity-50 min-h-[44px] min-w-[44px] px-4 py-2',
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm',
        outline:
          'border border-primary text-primary bg-transparent hover:bg-primary/10',
        ghost: 'text-foreground hover:bg-accent hover:text-accent-foreground',
        danger: 'bg-destructive text-destructive-foreground hover:bg-destructive/90 shadow-sm',
        link: 'text-primary underline-offset-4 hover:underline',
      },
      size: {
        xs: 'h-7 px-2.5 min-h-[28px] gap-1',
        sm: 'h-9 px-3 min-h-[36px]',
        md: 'h-11 px-4',
        lg: 'h-12 px-6',
        icon: 'h-11 w-11 p-0',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'md',
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';
    return (
      <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />
    );
  }
);
Button.displayName = 'Button';

export { Button, buttonVariants };
