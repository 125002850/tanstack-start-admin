import * as React from 'react';

import { Button } from '@/components/ui/button';
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

export function DataTableLinkButtonCell({
  value,
  className,
  stopPropagation = true,
  onClick
}: DataTableLinkButtonCellProps) {
  if (isEmptyValue(value)) return '-';

  return (
    <Button
      type='button'
      variant='link'
      className={cn('h-auto min-w-0 justify-start p-0 text-left font-medium', className)}
      onClick={(event) => {
        if (stopPropagation) {
          event.stopPropagation();
        }
        onClick(event);
      }}
    >
      {value}
    </Button>
  );
}
