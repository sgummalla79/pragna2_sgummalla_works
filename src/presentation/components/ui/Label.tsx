import * as React from 'react';
import * as LabelPrimitive from '@radix-ui/react-label';
import { cn } from '@/lib/utils';

const Label = React.forwardRef<
  React.ElementRef<typeof LabelPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof LabelPrimitive.Root>
>(({ className, ...props }, ref) => (
  <LabelPrimitive.Root
    ref={ref}
    className={cn(
      // Compact admin-form style — matches the FlowEditor's row-2 field
      // labels (tiny uppercase, bright foreground). Settings + flow-
      // editor forms inherit this directly; user-facing forms (auth,
      // chat HITL, conversation rename) opt out by passing their own
      // `className` (e.g. `text-sm font-medium normal-case
      // tracking-normal`) so labels like "Email address" don't look
      // shouty on a centred login card.
      //
      // No padding override — keeps the label CONTROL's left edge
      // flush with the input CONTROL's left edge. (We deliberately do
      // NOT mirror the Input's internal px-[13px] here; that would push
      // the label TEXT inward, breaking the column alignment between
      // the label box and the input box.)
      'text-[10px] font-semibold uppercase tracking-wider leading-none text-foreground peer-disabled:cursor-not-allowed peer-disabled:opacity-70',
      className
    )}
    {...props}
  />
));
Label.displayName = LabelPrimitive.Root.displayName;

export { Label };
