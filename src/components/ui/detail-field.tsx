import * as React from 'react';

import { OverflowTooltipText } from '@/components/ui/overflow-tooltip-text';
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
          <OverflowTooltipText text={String(displayValue)} maxLines={valueMaxLines} />
        ) : (
          displayValue
        )}
      </FieldValue>
    </div>
  );
}
