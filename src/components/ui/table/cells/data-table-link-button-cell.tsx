import * as React from 'react';

import { Button } from '@/components/ui/button';
import { DataTableOverflowTooltipText } from '@/components/ui/table/cells/data-table-overflow-tooltip-text';
import { cn } from '@/lib/utils';

interface DataTableLinkButtonCellProps {
  value?: React.ReactNode;
  className?: string;
  stopPropagation?: boolean;
  onClick: (event: React.MouseEvent<HTMLButtonElement>) => void;
}

function isEmptyValue(value: React.ReactNode) {
  return value == null || value === '';
}

function textValue(value: React.ReactNode): string | null {
  const type = typeof value;
  if (type === 'string' || type === 'number' || type === 'bigint') return String(value);
  return null;
}

export function DataTableLinkButtonCell({
  value,
  className,
  stopPropagation = true,
  onClick
}: DataTableLinkButtonCellProps) {
  if (isEmptyValue(value)) return '-';

  const tooltipText = textValue(value);

  return (
    <Button
      type='button'
      variant='link'
      className={cn(
        'h-auto max-w-full min-w-0 shrink justify-start overflow-hidden p-0 text-left font-medium',
        className
      )}
      onClick={(event) => {
        if (stopPropagation) {
          event.stopPropagation();
        }
        onClick(event);
      }}
    >
      {tooltipText ? (
        <DataTableOverflowTooltipText value={tooltipText} className='min-w-0 flex-1'>
          {tooltipText}
        </DataTableOverflowTooltipText>
      ) : (
        value
      )}
    </Button>
  );
}
