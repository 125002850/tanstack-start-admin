import type { ComponentProps, ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useOverlayPortalContainer } from '@/components/ui/use-overlay-portal-container';
import { cn } from '@/lib/utils';

export function CanvasElementToolbar({
  label,
  children,
  className
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      role='group'
      aria-label={label}
      className={cn(
        'nodrag nopan nowheel flex items-center gap-0.5 rounded-md border bg-background p-0.5 shadow-sm',
        className
      )}
      onPointerDown={(event) => event.stopPropagation()}
    >
      {children}
    </div>
  );
}

export function CanvasElementToolbarButton({
  label,
  children,
  className,
  onClick,
  ...props
}: Omit<ComponentProps<typeof Button>, 'title' | 'aria-label' | 'size' | 'variant'> & {
  label: string;
}) {
  const { container, setTriggerNode } = useOverlayPortalContainer<HTMLSpanElement>();

  return (
    <Tooltip delayDuration={0}>
      <TooltipTrigger asChild>
        <span ref={setTriggerNode} className='flex'>
          <Button
            {...props}
            type='button'
            aria-label={label}
            size='icon'
            variant='ghost'
            className={cn('size-7', className)}
            onClick={(event) => {
              event.stopPropagation();
              onClick?.(event);
            }}
          >
            {children}
          </Button>
        </span>
      </TooltipTrigger>
      <TooltipContent side='top' sideOffset={6} container={container} className='duration-75'>
        {label}
      </TooltipContent>
    </Tooltip>
  );
}
