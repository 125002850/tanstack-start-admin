import * as React from 'react';

import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

export function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className='text-xs font-medium text-muted-foreground uppercase tracking-wider'>
      {children}
    </span>
  );
}

export function FieldValue({
  children,
  className
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span className={cn('min-w-0 text-base font-medium tabular-nums', className)}>{children}</span>
  );
}

type FieldValueMaxLines = 1 | 2;

function OverflowTooltipValue({ text, maxLines }: { text: string; maxLines: FieldValueMaxLines }) {
  const textRef = React.useRef<HTMLSpanElement>(null);
  const [open, setOpen] = React.useState(false);

  const isOverflowing = React.useCallback(() => {
    const el = textRef.current;
    if (!el) return false;

    return el.scrollHeight > el.clientHeight + 1 || el.scrollWidth > el.clientWidth + 1;
  }, []);

  const handleOpenChange = React.useCallback(
    (nextOpen: boolean) => {
      setOpen(nextOpen && text !== '-' && isOverflowing());
    },
    [isOverflowing, text]
  );

  const textNode = (
    <span
      ref={textRef}
      className={cn('block min-w-0', maxLines === 1 ? 'truncate' : 'line-clamp-2')}
      tabIndex={text === '-' ? undefined : 0}
    >
      {text}
    </span>
  );

  if (text === '-') return textNode;

  return (
    <Tooltip open={open} onOpenChange={handleOpenChange}>
      <TooltipTrigger asChild>{textNode}</TooltipTrigger>
      <TooltipContent side='top' className='max-w-80 whitespace-normal break-words'>
        {text}
      </TooltipContent>
    </Tooltip>
  );
}

export function FieldItem({
  label,
  value,
  valueMaxLines
}: {
  label: string;
  value?: string | number | null;
  valueMaxLines?: FieldValueMaxLines;
}) {
  const displayValue = value ?? '-';

  return (
    <div className='group flex min-w-0 flex-col gap-1 rounded-[10px] border border-transparent bg-muted/40 px-3 py-2.5 transition-all hover:border-border hover:bg-muted/70'>
      <FieldLabel>{label}</FieldLabel>
      <FieldValue className={valueMaxLines ? 'block' : undefined}>
        {valueMaxLines ? (
          <OverflowTooltipValue text={String(displayValue)} maxLines={valueMaxLines} />
        ) : (
          displayValue
        )}
      </FieldValue>
    </div>
  );
}
