import * as React from 'react';
import * as PopoverPrimitive from '@radix-ui/react-popover';
import { cn } from '@/lib/utils';

function Popover({ ...props }: React.ComponentProps<typeof PopoverPrimitive.Root>) {
  return <PopoverPrimitive.Root data-slot='popover' {...props} />;
}

function PopoverTrigger({ ...props }: React.ComponentProps<typeof PopoverPrimitive.Trigger>) {
  return <PopoverPrimitive.Trigger data-slot='popover-trigger' {...props} />;
}

type PopoverContentProps = React.ComponentProps<typeof PopoverPrimitive.Content> &
  Pick<React.ComponentProps<typeof PopoverPrimitive.Portal>, 'container'> & {
    finalFocus?: React.RefObject<HTMLElement | null>;
  };

function PopoverContent({
  className,
  container,
  finalFocus,
  align = 'center',
  onCloseAutoFocus,
  onInteractOutside,
  sideOffset = 4,
  ...props
}: PopoverContentProps) {
  const hasInteractedOutsideRef = React.useRef(false);
  const handleInteractOutside = React.useCallback<
    NonNullable<PopoverContentProps['onInteractOutside']>
  >(
    (event) => {
      onInteractOutside?.(event);
      if (!event.defaultPrevented) hasInteractedOutsideRef.current = true;
    },
    [onInteractOutside]
  );
  const handleCloseAutoFocus = React.useCallback(
    (event: Event) => {
      const hasInteractedOutside = hasInteractedOutsideRef.current;
      hasInteractedOutsideRef.current = false;
      onCloseAutoFocus?.(event);
      // 外部交互已转移焦点，遵循 Radix 的关闭语义，避免抢回焦点关闭新浮层。
      if (event.defaultPrevented || hasInteractedOutside || !finalFocus?.current) return;

      event.preventDefault();
      finalFocus.current.focus();
    },
    [finalFocus, onCloseAutoFocus]
  );

  return (
    <PopoverPrimitive.Portal container={container}>
      <PopoverPrimitive.Content
        data-slot='popover-content'
        align={align}
        onCloseAutoFocus={handleCloseAutoFocus}
        onInteractOutside={handleInteractOutside}
        sideOffset={sideOffset}
        className={cn(
          'bg-popover text-popover-foreground data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 z-50 w-72 origin-(--radix-popover-content-transform-origin) rounded-md border p-4 shadow-md outline-hidden',
          className
        )}
        {...props}
      />
    </PopoverPrimitive.Portal>
  );
}

function PopoverAnchor({ ...props }: React.ComponentProps<typeof PopoverPrimitive.Anchor>) {
  return <PopoverPrimitive.Anchor data-slot='popover-anchor' {...props} />;
}

export { Popover, PopoverTrigger, PopoverContent, PopoverAnchor };
