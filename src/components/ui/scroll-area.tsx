import * as React from 'react';
import * as ScrollAreaPrimitive from '@radix-ui/react-scroll-area';

import { cn } from '@/lib/utils';

type ScrollAreaScrollbarProps = React.ComponentProps<
  typeof ScrollAreaPrimitive.ScrollAreaScrollbar
> & {
  [key: `data-${string}`]: string | number | undefined;
};

type ScrollAreaProps = React.ComponentProps<typeof ScrollAreaPrimitive.Root> & {
  horizontalScrollbarProps?: ScrollAreaScrollbarProps;
  viewportProps?: React.ComponentProps<typeof ScrollAreaPrimitive.Viewport> & {
    [key: `data-${string}`]: string | number | undefined;
  };
  viewportRef?: React.Ref<HTMLDivElement>;
  verticalScrollbarProps?: ScrollAreaScrollbarProps;
};

function ScrollArea({
  className,
  children,
  horizontalScrollbarProps,
  viewportProps,
  viewportRef,
  verticalScrollbarProps,
  ...props
}: ScrollAreaProps) {
  const { className: viewportClassName, ...restViewportProps } = viewportProps ?? {};
  const { className: horizontalScrollbarClassName, ...restHorizontalScrollbarProps } =
    horizontalScrollbarProps ?? {};
  const { className: verticalScrollbarClassName, ...restVerticalScrollbarProps } =
    verticalScrollbarProps ?? {};

  return (
    <ScrollAreaPrimitive.Root
      data-slot='scroll-area'
      className={cn('relative', className)}
      {...props}
    >
      <ScrollAreaPrimitive.Viewport
        ref={viewportRef}
        data-slot='scroll-area-viewport'
        className={cn(
          'focus-visible:ring-ring/50 size-full rounded-[inherit] transition-[color,box-shadow] outline-none focus-visible:ring-[3px] focus-visible:outline-1',
          viewportClassName
        )}
        {...restViewportProps}
      >
        {children}
      </ScrollAreaPrimitive.Viewport>
      <ScrollBar className={verticalScrollbarClassName} {...restVerticalScrollbarProps} />
      <ScrollBar
        orientation='horizontal'
        className={horizontalScrollbarClassName}
        {...restHorizontalScrollbarProps}
      />
      <ScrollAreaPrimitive.Corner />
    </ScrollAreaPrimitive.Root>
  );
}

function ScrollBar({ className, orientation = 'vertical', ...props }: ScrollAreaScrollbarProps) {
  return (
    <ScrollAreaPrimitive.ScrollAreaScrollbar
      data-slot='scroll-area-scrollbar'
      orientation={orientation}
      className={cn(
        'flex touch-none select-none',
        orientation === 'vertical' && 'h-full w-[var(--scroll-area-scrollbar-size)] py-px',
        orientation === 'horizontal' && 'h-[var(--scroll-area-scrollbar-size)] flex-col px-px',
        className
      )}
      {...props}
    >
      <ScrollAreaPrimitive.ScrollAreaThumb
        data-slot='scroll-area-thumb'
        className='relative flex-1 rounded-full'
      />
    </ScrollAreaPrimitive.ScrollAreaScrollbar>
  );
}

export { ScrollArea, ScrollBar };
