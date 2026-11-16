import type { ComponentProps } from 'react';
import type { Icons } from '@/components/icons';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useOverlayPortalContainer } from '@/components/ui/use-overlay-portal-container';
import { cn } from '@/lib/utils';

type JsonInputActionProps = Omit<
  ComponentProps<typeof Button>,
  'aria-label' | 'asChild' | 'children' | 'size' | 'variant'
> & {
  label: string;
  tooltip?: string;
  icon: typeof Icons.copy;
  count?: number;
};

export function JsonInputAction({
  label,
  tooltip = label,
  icon: Icon,
  count = 0,
  className,
  ...buttonProps
}: JsonInputActionProps) {
  const { container, setTriggerNode } = useOverlayPortalContainer<HTMLSpanElement>();

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className='inline-flex shrink-0' ref={setTriggerNode}>
          <Button
            {...buttonProps}
            aria-label={label}
            className={cn('relative size-8', className)}
            size='icon'
            variant='ghost'
          >
            <Icon aria-hidden='true' className='size-4' />
            {count > 0 ? (
              <Badge
                aria-hidden='true'
                className='pointer-events-none absolute top-0.5 right-0.5 h-3.5 min-w-3.5 rounded-full border-0 px-1 py-0 text-[9px] leading-none tabular-nums ring-2 ring-background'
              >
                {count}
              </Badge>
            ) : null}
          </Button>
        </span>
      </TooltipTrigger>
      <TooltipContent container={container}>{tooltip}</TooltipContent>
    </Tooltip>
  );
}
