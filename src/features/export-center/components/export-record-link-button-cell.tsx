import * as React from 'react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface ExportRecordLinkButtonCellProps {
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

/** 导出记录编号入口；点击后打开领域详情，同时保留共享表格的溢出提示。 */
export function ExportRecordLinkButtonCell({
  value,
  className,
  stopPropagation = true,
  onClick
}: ExportRecordLinkButtonCellProps) {
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
      title={tooltipText ?? undefined}
      onClick={(event) => {
        if (stopPropagation) {
          event.stopPropagation();
        }
        onClick(event);
      }}
    >
      {tooltipText ? <span className='min-w-0 flex-1 truncate'>{tooltipText}</span> : value}
    </Button>
  );
}
