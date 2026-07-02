'use client';

import * as React from 'react';
import { Combobox as ComboboxPrimitive } from '@base-ui/react/combobox';

import { Icons } from '@/components/icons';
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput
} from '@/components/ui/input-group';
import { cn } from '@/lib/utils';

const Combobox = ComboboxPrimitive.Root;

function ComboboxValue({ ...props }: ComboboxPrimitive.Value.Props) {
  return <ComboboxPrimitive.Value data-slot='combobox-value' {...props} />;
}

const ComboboxTrigger = React.forwardRef<HTMLButtonElement, ComboboxPrimitive.Trigger.Props>(
  function ComboboxTrigger({ className, children, ...props }, forwardedRef) {
    return (
      <ComboboxPrimitive.Trigger
        ref={forwardedRef}
        data-slot='combobox-trigger'
        className={cn("[&_svg:not([class*='size-'])]:size-4", className)}
        {...props}
      >
        {children}
        <Icons.chevronsUpDown
          data-slot='combobox-trigger-icon'
          className='pointer-events-none size-4 shrink-0 text-muted-foreground'
        />
      </ComboboxPrimitive.Trigger>
    );
  }
);

function ComboboxClear({ className, ...props }: ComboboxPrimitive.Clear.Props) {
  return (
    <ComboboxPrimitive.Clear
      data-slot='combobox-clear'
      render={<InputGroupButton variant='ghost' size='icon-xs' />}
      className={cn(className)}
      {...props}
    >
      <Icons.close className='pointer-events-none' />
    </ComboboxPrimitive.Clear>
  );
}

const ComboboxInput = React.forwardRef<
  HTMLInputElement,
  ComboboxPrimitive.Input.Props & {
    showTrigger?: boolean;
    showClear?: boolean;
  }
>(function ComboboxInput(
  { className, children, disabled = false, showTrigger = true, showClear = false, ...props },
  forwardedRef
) {
  return (
    <InputGroup className={cn('w-auto', className)}>
      <ComboboxPrimitive.Input
        ref={forwardedRef}
        render={<InputGroupInput disabled={disabled} />}
        {...props}
      />
      {showTrigger || showClear ? (
        <InputGroupAddon align='inline-end'>
          {showTrigger ? (
            <InputGroupButton
              size='icon-xs'
              variant='ghost'
              asChild
              data-slot='input-group-button'
              className='data-pressed:bg-transparent group-has-data-[slot=combobox-clear]/input-group:hidden'
              disabled={disabled}
            >
              <ComboboxTrigger />
            </InputGroupButton>
          ) : null}
          {showClear ? <ComboboxClear disabled={disabled} /> : null}
        </InputGroupAddon>
      ) : null}
      {children}
    </InputGroup>
  );
});

const ComboboxContent = React.forwardRef<
  HTMLDivElement,
  ComboboxPrimitive.Popup.Props &
    Pick<ComboboxPrimitive.Portal.Props, 'container'> &
    Pick<
      ComboboxPrimitive.Positioner.Props,
      'side' | 'align' | 'sideOffset' | 'alignOffset' | 'anchor'
    >
>(function ComboboxContent(
  {
    className,
    container,
    side = 'bottom',
    sideOffset = 6,
    align = 'start',
    alignOffset = 0,
    anchor,
    ...props
  },
  forwardedRef
) {
  return (
    <ComboboxPrimitive.Portal container={container}>
      <ComboboxPrimitive.Positioner
        side={side}
        sideOffset={sideOffset}
        align={align}
        alignOffset={alignOffset}
        anchor={anchor}
        className='z-50 isolate'
      >
        <ComboboxPrimitive.Popup
          ref={forwardedRef}
          data-slot='combobox-content'
          className={cn(
            'group/combobox-content relative z-50 w-(--anchor-width) max-w-(--available-width) origin-(--transform-origin) overflow-hidden rounded-md border bg-popover text-popover-foreground shadow-md outline-hidden duration-100 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95',
            className
          )}
          {...props}
        />
      </ComboboxPrimitive.Positioner>
    </ComboboxPrimitive.Portal>
  );
});

const ComboboxList = React.forwardRef<HTMLDivElement, ComboboxPrimitive.List.Props>(
  function ComboboxList({ className, ...props }, forwardedRef) {
    return (
      <ComboboxPrimitive.List
        ref={forwardedRef}
        data-slot='combobox-list'
        className={cn('max-h-80 overflow-y-auto p-1 data-empty:p-0', className)}
        {...props}
      />
    );
  }
);

const ComboboxItem = React.forwardRef<HTMLDivElement, ComboboxPrimitive.Item.Props>(
  function ComboboxItem({ className, children, ...props }, forwardedRef) {
    return (
      <ComboboxPrimitive.Item
        ref={forwardedRef}
        data-slot='combobox-item'
        className={cn(
          "relative flex w-full cursor-default items-center gap-2 rounded-sm py-1.5 pr-8 pl-2 text-sm outline-hidden select-none data-highlighted:bg-accent data-highlighted:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
          className
        )}
        {...props}
      >
        {children}
        <ComboboxPrimitive.ItemIndicator
          data-slot='combobox-item-indicator'
          render={
            <span className='pointer-events-none absolute right-2 flex size-4 items-center justify-center' />
          }
        >
          <Icons.check className='pointer-events-none size-4' />
        </ComboboxPrimitive.ItemIndicator>
      </ComboboxPrimitive.Item>
    );
  }
);

function ComboboxGroup({ className, ...props }: ComboboxPrimitive.Group.Props) {
  return (
    <ComboboxPrimitive.Group data-slot='combobox-group' className={cn(className)} {...props} />
  );
}

function ComboboxLabel({ className, ...props }: ComboboxPrimitive.GroupLabel.Props) {
  return (
    <ComboboxPrimitive.GroupLabel
      data-slot='combobox-label'
      className={cn('px-2 py-1.5 text-xs text-muted-foreground', className)}
      {...props}
    />
  );
}

function ComboboxEmpty({ className, ...props }: ComboboxPrimitive.Empty.Props) {
  return (
    <ComboboxPrimitive.Empty
      data-slot='combobox-empty'
      className={cn(
        'hidden w-full justify-center py-2 text-center text-sm text-muted-foreground group-data-empty/combobox-content:flex',
        className
      )}
      {...props}
    />
  );
}

function ComboboxSeparator({ className, ...props }: ComboboxPrimitive.Separator.Props) {
  return (
    <ComboboxPrimitive.Separator
      data-slot='combobox-separator'
      className={cn('-mx-1 my-1 h-px bg-border', className)}
      {...props}
    />
  );
}

function useComboboxAnchor() {
  return React.useRef<HTMLDivElement | null>(null);
}

export {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxGroup,
  ComboboxInput,
  ComboboxItem,
  ComboboxLabel,
  ComboboxList,
  ComboboxSeparator,
  ComboboxTrigger,
  ComboboxValue,
  useComboboxAnchor
};
