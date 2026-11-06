import type { ComponentProps, ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useOverlayPortalContainer } from '@/components/ui/use-overlay-portal-container';
import { useComposedRefs } from '@/lib/react/compose-refs';
import { cn } from '@/lib/utils';

export function CanvasToolbar({ children }: { children: ReactNode }) {
  return (
    <div
      role='group'
      aria-label='画布工具'
      className='nopan nowheel flex items-center rounded-md border bg-background/94 p-1 shadow-[0_4px_14px_color-mix(in_oklab,var(--foreground)_8%,transparent)] backdrop-blur-sm'
    >
      {children}
    </div>
  );
}

export function CanvasToolbarButton({
  label,
  tooltip = label,
  children,
  className,
  variant = 'ghost',
  ref,
  ...props
}: Omit<ComponentProps<typeof Button>, 'aria-label' | 'title' | 'size'> & {
  label: string;
  tooltip?: string;
}) {
  const { container, setTriggerNode } = useOverlayPortalContainer<HTMLButtonElement>(
    '[data-slot="canvas-content"], [data-slot="sheet-content"], [data-slot="dialog-content"], [role="dialog"]'
  );
  const buttonRef = useComposedRefs(ref, setTriggerNode);

  return (
    <Tooltip delayDuration={0}>
      <TooltipTrigger asChild>
        <Button
          {...props}
          aria-label={label}
          className={cn('size-8 shrink-0', className)}
          ref={buttonRef}
          size='icon'
          variant={variant}
        >
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent container={container} side='bottom' sideOffset={6}>
        {tooltip}
      </TooltipContent>
    </Tooltip>
  );
}
