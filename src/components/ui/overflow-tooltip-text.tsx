import { useState } from 'react';
import { useTextOverflow } from '@/hooks/use-text-overflow';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

export function OverflowTooltipText({
  text,
  maxLines = 1,
  className
}: {
  text: string;
  maxLines?: 1 | 2;
  className?: string;
}) {
  const { ref, checkOverflow } = useTextOverflow(maxLines === 1 ? 'horizontal' : 'both');
  const [openText, setOpenText] = useState<string | null>(null);
  const content = (
    <span
      ref={ref}
      tabIndex={text === '-' ? undefined : 0}
      className={cn('block min-w-0', maxLines === 1 ? 'truncate' : 'line-clamp-2', className)}
    >
      {text}
    </span>
  );
  if (text === '-') return content;
  return (
    <Tooltip
      open={openText === text}
      onOpenChange={(nextOpen) => setOpenText(nextOpen && checkOverflow() ? text : null)}
    >
      <TooltipTrigger asChild>{content}</TooltipTrigger>
      <TooltipContent side='top' className='max-w-80 whitespace-normal break-words'>
        {text}
      </TooltipContent>
    </Tooltip>
  );
}
