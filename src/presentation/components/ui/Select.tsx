/**
 * shadcn-style Select built on top of Radix UI.
 *
 * Why not native `<select>`? Native selects have two cosmetic
 * problems we can't solve via CSS:
 *
 *   - The dropdown options popup is browser-rendered and uses
 *     system chrome (font, padding, hover colors). On dark
 *     themes it often shows a stark white panel that clashes.
 *   - The chevron is drawn by the browser, in a system color, with
 *     a size we can't control.
 *
 * Radix Select renders both the trigger and the popup as ordinary
 * DOM elements, so every surface reads from our palette tokens
 * (--color-background, --color-foreground, --color-accent, etc.).
 *
 * Usage mirrors shadcn:
 *
 *     <Select value={modelId} onValueChange={setModelId}>
 *       <SelectTrigger>
 *         <SelectValue placeholder="— pick a model —" />
 *       </SelectTrigger>
 *       <SelectContent>
 *         {models.map((m) => (
 *           <SelectItem key={m.id} value={m.id}>{m.displayName}</SelectItem>
 *         ))}
 *       </SelectContent>
 *     </Select>
 */
import * as React from 'react';
import * as SelectPrimitive from '@radix-ui/react-select';
import { Check, ChevronDown } from 'lucide-react';

import { cn } from '@/lib/utils';

const Select = SelectPrimitive.Root;
const SelectGroup = SelectPrimitive.Group;
const SelectValue = SelectPrimitive.Value;

const SelectTrigger = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Trigger>
>(({ className, children, ...props }, ref) => (
  <SelectPrimitive.Trigger
    ref={ref}
    className={cn(
      'flex h-11 w-full items-center justify-between rounded-lg',
      'border-[1.5px] border-input bg-transparent px-[13px] py-[10px]',
      'text-[14px] text-foreground',
      'placeholder:text-muted-foreground',
      'transition-colors duration-150',
      'focus:outline-none focus:border-primary',
      'disabled:cursor-not-allowed disabled:opacity-50',
      // `[&>span]:line-clamp-1` keeps the chosen value from wrapping
      // into a second line when the option label is long.
      '[&>span]:line-clamp-1',
      className,
    )}
    {...props}
  >
    {children}
    <SelectPrimitive.Icon asChild>
      <ChevronDown size={16} className="opacity-60" aria-hidden="true" />
    </SelectPrimitive.Icon>
  </SelectPrimitive.Trigger>
));
SelectTrigger.displayName = 'SelectTrigger';

const SelectContent = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Content>
>(({ className, children, position = 'popper', ...props }, ref) => (
  <SelectPrimitive.Portal>
    <SelectPrimitive.Content
      ref={ref}
      position={position}
      // The popup sits in a portal, so it doesn't inherit form-element
      // styling. All colors come from palette tokens; the popup is
      // visually distinct from the trigger via the popover surface +
      // a soft shadow.
      className={cn(
        'relative z-50 max-h-[--radix-select-content-available-height]',
        'min-w-[8rem] overflow-hidden rounded-lg border border-border',
        'bg-popover text-popover-foreground',
        'shadow-xl',
        // Radix animates open/close via data-state attrs.
        'data-[state=open]:animate-in data-[state=closed]:animate-out',
        'data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
        'data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95',
        // When opened above/below, mirror the slide direction.
        'data-[side=bottom]:slide-in-from-top-2',
        'data-[side=top]:slide-in-from-bottom-2',
        position === 'popper' && 'data-[side=bottom]:translate-y-1 data-[side=top]:-translate-y-1',
        className,
      )}
      {...props}
    >
      <SelectPrimitive.Viewport
        className={cn(
          'p-1',
          position === 'popper' && 'h-[var(--radix-select-trigger-height)] w-full min-w-[var(--radix-select-trigger-width)]',
        )}
      >
        {children}
      </SelectPrimitive.Viewport>
    </SelectPrimitive.Content>
  </SelectPrimitive.Portal>
));
SelectContent.displayName = 'SelectContent';

const SelectLabel = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Label>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Label>
>(({ className, ...props }, ref) => (
  <SelectPrimitive.Label
    ref={ref}
    className={cn('py-1.5 pl-8 pr-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground', className)}
    {...props}
  />
));
SelectLabel.displayName = 'SelectLabel';

const SelectItem = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Item>
>(({ className, children, ...props }, ref) => (
  <SelectPrimitive.Item
    ref={ref}
    className={cn(
      'relative flex w-full cursor-pointer select-none items-center',
      'rounded-md py-1.5 pl-8 pr-2 text-[13px] text-foreground outline-none',
      // `focus` covers keyboard nav + hover (Radix sets data-highlighted)
      'focus:bg-accent focus:text-accent-foreground',
      'data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
      className,
    )}
    {...props}
  >
    <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
      <SelectPrimitive.ItemIndicator>
        <Check size={14} aria-hidden="true" />
      </SelectPrimitive.ItemIndicator>
    </span>
    <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
  </SelectPrimitive.Item>
));
SelectItem.displayName = 'SelectItem';

const SelectSeparator = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Separator>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Separator>
>(({ className, ...props }, ref) => (
  <SelectPrimitive.Separator
    ref={ref}
    className={cn('-mx-1 my-1 h-px bg-border', className)}
    {...props}
  />
));
SelectSeparator.displayName = 'SelectSeparator';

export {
  Select,
  SelectGroup,
  SelectValue,
  SelectTrigger,
  SelectContent,
  SelectLabel,
  SelectItem,
  SelectSeparator,
};
